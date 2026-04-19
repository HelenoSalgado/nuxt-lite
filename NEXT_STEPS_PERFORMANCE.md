# Próximos Passos: Evolução de Performance e CSS do nuxt-lite

Após a conclusão com sucesso da reestruturação, limpeza de código e estabilização da fundação do módulo, as seguintes melhorias arquiteturais e de performance foram identificadas para o futuro:

## 1. Refinamento da Estratégia de CSS Crítico e Dinâmico

A estratégia ideal de "Inline Layout + Per-Page External Dynamic CSS" requer os seguintes ajustes para atingir Zero FOUC com máxima eficiência:
*   **CSS Crítico (Inline):** Extrair o CSS estático referente apenas ao layout global (Header, Footer, e estrutura fora do `<main>`) e injetá-lo inline.
*   **CSS Dinâmico (Externo/Por Página):** Isolar o CSS específico de conteúdo de cada rota e exportá-lo como um arquivo independente (ex: `dist/css/[route-name].css`), carregado de forma assíncrona (`media="print" onload="this.media='all'"`).
*   **Correção de Subtração (Selector Mapping):** Assegurar que ao utilizar short-hashing para os atributos `data-v`, a lógica de intersecção/subtração de regras não gere arquivos redundantes ou vaze estilos de página para o bloco crítico.

## 2. Otimização de Fontes e Renderização

*   **Preload Automático de Fontes:** Desenvolver um analisador para identificar `@font-face` ou URLs de fontes declaradas no CSS, injetando automaticamente as tags `<link rel="preload" as="font" crossorigin>` correspondentes no `<head>`. Isso mitigará significativamente o FOIT (Flash of Invisible Text).
*   **Font-Display Swap:** Forçar a inclusão e/ou substituição da regra `font-display: swap` em todas as declarações `@font-face` processadas.
*   **CSS Containment:** Explorar a injeção automática de `contain: content` ou `contain: strict` em containers estruturais (como o `<main>`), para reduzir o escopo do *Layout Calculation* do navegador.

## 3. Melhorias no Runtime (`lite.ts`)

*   **Speculative Prefetch:** Atualizar o script de runtime do cliente (`lite.ts`) para incluir prefetch especulativo dos payloads `_payload.json`. Utilizando um `IntersectionObserver` e `requestIdleCallback`, os payloads das rotas visíveis na tela poderão ser carregados antecipadamente, tornando a navegação de SPA instantânea.

## 4. Evolução do Pruning

*   **Allowlist do Sistema de Limpeza:** Garantir que novos diretórios gerados pelo módulo (como o `css/` dinâmico proposto) sejam adicionados à *allowlist* da função `pruneNuxtArtifacts` em `fs/index.ts`, para que não sejam deletados no momento final do build.