# Análise de Falhas e Plano de Implementação: CSS Crítico v2

## 1. Diagnóstico de Falhas (Sessão Anterior)

### 1.1. Inversão Conceitual
A falha mais grave foi a interpretação errônea do que constitui o CSS Crítico. No contexto deste projeto:
- **CSS Crítico (Layout):** É o CSS "estático" que compõe o Header, Footer e estrutura global (tudo fora do `<main>`). **Deve ser INLINE.**
- **CSS Dinâmico (Página):** É o CSS específico do conteúdo de cada rota. **Deve ser EXTERNO (arquivo por página).**
Eu implementei exatamente o oposto, inlinando a página e externalizando o layout.

### 1.2. Falha de Subtração (Selector Mapping)
A tentativa de remover o CSS crítico do arquivo externo falhou porque a função `filterCssToMap` transforma seletores (ex: `[data-v-hash]` -> `.s1`). Ao tentar subtrair as regras usando as chaves dos Maps após essa transformação, as chaves não coincidiam perfeitamente, gerando redundância ou arquivos vazios.

### 1.3. Conflito com o Sistema de Limpeza (Pruning)
O módulo possui uma função `pruneNuxtArtifacts` que remove diretórios não reconhecidos após o build. Como a nova pasta `css/` não estava na "allowlist" de preservação, ela era deletada milissegundos após ser criada, fazendo com que o site ficasse sem estilos externos.

### 1.4. Ineficiência de Extração
A lógica de extração de seletores foi executada de forma redundante e não isolou cirurgicamente os filhos do `<main>`, resultando em um vazamento de estilos de página para o bloco crítico.

---

## 2. Plano de Implementação Definitive

### 2.1. Definições Técnicas
- **Estratégia:** `Inline Layout + Per-Page External Dynamic CSS`.
- **Objetivo:** Zero FOUC (Flash of Unstyled Content) no layout e carregamento assíncrono do conteúdo.
- **Regra de Ouro:** Nenhuma regra CSS pode existir simultaneamente no HTML (inline) e no arquivo `.css` (externo).

### 2.2. Fluxo de Execução

#### Fase 1: Coleta de Dados (`nitro:config` hook)
1. Durante o prerender de cada página, extrair:
   - `GlobalLayoutSelectors`: Todos os seletores do HTML **exceto** os descendentes de `<main>`.
   - `GlobalUsedSelectors`: Todos os seletores da página (para controle global).
2. Acumular esses dados em `Set`s globais no `module.ts`.

#### Fase 2: Pós-Processamento (`close` hook)
1. **Preparação de Regras:**
   - Parsear todo o CSS do projeto.
   - Criar o `GlobalCriticalRules` (Map) filtrando as regras globais pelos `GlobalLayoutSelectors`.
2. **Processamento por Página:**
   Para cada arquivo HTML gerado:
   - Identificar seletores usados na página (`CurrentUsed`).
   - **Inlining:** Filtrar `GlobalCriticalRules` pelo `CurrentUsed` e injetar em `<style data-nl-critical>`.
   - **Externalização:**
     - Criar `PageDynamicRules` filtrando as regras totais pelos seletores da página.
     - **Subtração Atômica:** Remover de `PageDynamicRules` qualquer entrada que esteja em `GlobalCriticalRules`.
     - Gravar em `dist/css/[route-name].css`.
   - **Injeção de Link:** Inserir o `<link>` com carregamento não-bloqueante (`media="print" onload="this.media='all'"`).

### 2.3. Alterações em Arquivos de Suporte
- **`fs/index.ts`**: Adicionar `'css'` ao array de diretórios ignorados pelo `pruneNuxtArtifacts`.
- **`html/extract.ts`**: Refinar a lógica de exclusão para que, ao ignorar o `<main>`, as classes do próprio container `<main>` ainda sejam coletadas para o layout, mas seus filhos não.

### 2.4. Validação Esperada
- `dist/index.html` deve ter layout inline e link para `/css/index.css`.
- `dist/css/index.css` deve conter apenas estilos do conteúdo central, sem repetir fontes ou estilos de header/footer.
- O tempo de carregamento deve mostrar o layout estilizado antes mesmo do download do CSS externo.
