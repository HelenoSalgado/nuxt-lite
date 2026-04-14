# nuxt-lite

Módulo Nuxt que substitui o JavaScript do Vue/Nuxt no cliente por um runtime leve (~5KB minificado e gzip) que gerencia navegação SPA e troca de conteúdo via JSON.

## Visão Geral

O **nuxt-lite** é feito para `nuxt generate`. Durante o build, o conteúdo de cada página é extraído do HTML SSR e transformado em payloads JSON compactos. No cliente, um runtime mínimo em TypeScript reconstrói o DOM a partir desses payloads e intercepta cliques em links para fazer prefetch e troca de conteúdo — sem carregar o framework Vue (~500KB).

### O que faz

- **Payload JSON por página:** O conteúdo variável (dentro de `<main>` ou `[data-page-content]`) é serializado em `_payload.json` durante o build.
- **Runtime leve:** Um script em TypeScript (~5KB min+gzip) substitui o Vue runtime no cliente.
- **Navegação SPA:** Intercepta links, faz prefetch via `IntersectionObserver` e troca o conteúdo com transições CSS.
- **CSS por página:** Extrai apenas os seletores CSS usados em cada página usando `linkedom`. Classes adicionadas dinamicamente via JS podem ser preservadas com `safelist`.
- **Acessibilidade:** Move o foco para o `<h1>` ou container principal após navegação.
- **Limpeza do HTML:** Remove artefatos SSR do Nuxt/Vue (`__NUXT_DATA__`, comentários, scripts desnecessários).

### O que NÃO faz

- Não é hidratação Vue. O Vue runtime não está presente no cliente. Componentes que dependem de `ref`, `reactive` ou reatividade Vue no navegador não funcionam.
- Não funciona com SSR ou `nuxt dev`. É feito exclusivamente para `nuxt generate`.
- Não é substituto para apps que precisam de reatividade no cliente. Para interatividade leve, use JavaScript puro ou Web Components.

## Instalação

Adicione ao `nuxt.config.ts` (deve ser o **primeiro** módulo da lista):

```ts
export default defineNuxtConfig({
  modules: [
    '~~/nuxt-lite/src/module',
  ],
  nuxtLite: {
    optimizeCss: 'inline',     // 'inline' | 'file' | false
    safelist: ['is-active'],   // Classes a preservar no tree-shaking
  },
})
```

## Configurações

| Opção | Padrão | Descrição |
|---|---|---|
| `optimizeCss` | `false` | `'inline'`: CSS por página. `'file'`: arquivo global único. `false`: desativado. |
| `safelist` | `[]` | Classes ou seletores que NÃO devem ser removidos. |
| `cleanHtml` | `true` | Remove artefatos Nuxt/Vue do HTML final. |

## Estrutura de Páginas

O runtime substitui o conteúdo dentro de `<main>` ou `[data-page-content]`. Envolva o conteúdo variável no layout:

```vue
<!-- layouts/default.vue -->
<template>
  <div>
    <header>...</header>
    <main data-page-content>
      <slot />
    </main>
    <footer>...</footer>
  </div>
</template>
```

## Transições CSS

Defina as classes de transição no CSS global:

```css
.page-enter-active, .page-leave-active {
  transition: opacity 0.3s ease;
}
.page-enter-from, .page-leave-to {
  opacity: 0;
}
```

## Como Funciona

### Build-time
1. Durante `nuxt generate`, cada página HTML é parseada com `linkedom`.
2. O conteúdo de `<main>` é extraído e serializado em `_payload.json`.
3. Scripts e estilos do Vue/Nuxt são removidos do HTML.
4. O runtime buildado (`lite.min.js`) é injetado no `<body>`.
5. O CSS é analisado para extrair apenas os seletores usados naquela página.

### Client-side
1. `IntersectionObserver` monitora links na viewport e inicia prefetch dos payloads.
2. Ao clicar, o runtime busca o JSON e reconstrói o conteúdo.
3. Aplica transições CSS e move o foco para acessibilidade.

## Limitações

- **Apenas estático:** Funciona somente com `nuxt generate`.
- **Sem Vue no cliente:** Componentes com reatividade Vue não funcionam no navegador.
- **Layouts fixos:** Header, footer e navegação devem estar fora do `<main>` para não serem substituídos.

## Desenvolvimento

```bash
npm run dev              # Rodar playground em modo dev
npm run dev:build        # Build do playground
npm run build:runtime    # Build do runtime (esbuild)
npm run prepack          # Build completo para publicação
npm run test             # Rodar testes
```

## Licença

MIT
