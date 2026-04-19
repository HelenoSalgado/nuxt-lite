# Relatório de Análise e Correções: Módulo nuxt-lite

Este documento detalha as falhas identificadas no módulo `nuxt-lite` após a análise da compilação estática (`npm run generate`) e a inspeção do código-fonte do módulo.

## 1. Falhas Identificadas no Módulo

### 1.1. Falha na Remoção do Runtime do Nuxt
O módulo falha em remover os scripts principais do Nuxt quando o diretório de assets é customizado.
- **Causa:** O código em `clean.ts` busca por scripts contendo `/_nuxt/`, mas o projeto está configurado com `buildAssetsDir: "nuxt"`.
- **Correção:** O módulo deve ler `nuxt.options.app.buildAssetsDir` para identificar corretamente os scripts a serem removidos.

### 1.2. Incompatibilidade com Seletores de Atributo (CSS)
O filtro de CSS (`filter.ts`) não reconhece seletores de atributo, como `[data-v-xxxx]`.
- **Causa:** A função `selectorMatches` apenas verifica classes, IDs e tags.
- **Impacto:** Seletores de escopo do Vue (`data-v`) podem ser removidos indevidamente ou mantidos de forma inconsistente.
- **Correção:** Adicionar suporte a `RegExp` para identificar e validar seletores de atributo no conjunto de seletores usados.

### 1.3. Otimização de Atributos de Escopo (`data-v`)
O HTML final e o CSS ainda utilizam seletores de atributo longos e redundantes (`data-v-xxxx`).
- **Problema:** Cada elemento carrega um atributo de ~15 bytes que se repete centenas de vezes.
- **Estratégia de Correção (Short-Hashing):**
    1. **Mapeamento:** Criar um dicionário de tradução durante a análise (ex: `702d788f` -> `s1`).
    2. **Substituição no HTML:** Converter o atributo `data-v-702d788f` em uma classe curta `.s1`.
    3. **Substituição no CSS:** Atualizar os seletores no CSS otimizado para utilizarem a classe `.s1` em vez do seletor de atributo.
    4. **Remoção Seletiva:** Se um hash `data-v` não possuir nenhuma regra correspondente no CSS final, ele deve ser removido do HTML sem substituição, eliminando "estilo morto".
- **Benefício:** Redução drástica no tamanho do HTML e ganho marginal em performance de parsing CSS pelo browser.

### 1.4. Conflito de Payloads e Preloads
O Nuxt está gerando preloads para seus próprios arquivos `_payload.json` (com hashes), que competem com os payloads gerados pelo `nuxt-lite`.
- **Causa:** Funcionalidades experimentais do Nuxt (como `sharedPrerenderData`) continuam injetando links de `preload`.
- **Correção:** O módulo deve remover agressivamente todos os links de `preload`/`prefetch` que apontem para arquivos JSON de payload do Nuxt original.

### 1.5. Suporte Limitado a CSS Moderno (Nesting)
O parser de CSS (`parser.ts`) é rudimentar e pode corromper regras que utilizam nesting nativo ou sintaxes complexas.
- **Correção:** Melhorar o contador de chaves ou utilizar um parser mais robusto para garantir que blocos aninhados sejam mantidos ou planificados corretamente.

---

## 2. Configuração Esperada do Nuxt

Para que o `nuxt-lite` opere sem interferências e atinja a performance máxima, a seguinte configuração é recomendada no `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  // Desabilitar preloads automáticos de dados que o Nuxt Lite não utiliza
  experimental: {
    sharedPrerenderData: false, // Evita injeção de payloads redundantes
    renderJsonPayloads: false,  // O Nuxt Lite usa seu próprio formato JSON
    extractAsyncDataHandlers: true, // Útil para limpar o bundle servidor/client
  },

  // Garantir que estilos globais não sejam inlined pelo Nuxt, 
  // permitindo que o Nuxt Lite faça a extração cirúrgica.
  features: {
    inlineStyles: false
  },

  // Configuração ideal do Nuxt Lite
  nuxtLite: {
    optimizeCss: 'file', // 'file' para cache persistente ou 'inline' para 0-request CSS
    cleanHtml: true,
    optimizeSvg: true,
    // ...
  }
})
```

## 3. Plano de Ação para o Módulo

1. **Refatorar `clean.ts`**: Tornar a remoção de scripts dinâmica baseada na configuração do Nuxt.
2. **Atualizar `filter.ts`**: Adicionar suporte a seletores de atributo `[...]`.
3. **Adicionar limpeza de `data-v`**: Novo método em `clean.ts` para higienizar o DOM final.
4. **Interceptar Preloads em `process.ts`**: Adicionar lógica para remover qualquer link de fetch/json injetado pelo motor de prerender padrão do Nuxt.
