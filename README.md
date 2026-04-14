# nuxt-lite

Módulo Nuxt para geração estática extrema, eliminando o Vue runtime do cliente e substituindo-o por um sistema de hidratação leve e acessível.

## Visão Geral

O **nuxt-lite** transforma seu site Nuxt em um SPA ultra-rápido que envia apenas o HTML estático e um script de **~5KB** (minificado e zipado) para o cliente. Ele mantém a experiência de navegação fluida (SPA) sem o custo de ~500KB do framework Vue/Nuxt completo no navegador.

### Principais Recursos (Refatorado)

- ✅ **Hidratação Instantânea:** Constrói o DOM a partir de payloads JSON extraídos durante o build.
- ✅ **Navegação SPA:** Intercepta links e realiza a troca de conteúdo com transições CSS nativas.
- ✅ **Prefetch Inteligente:** Usa `IntersectionObserver` para pré-carregar páginas conforme os links entram na viewport (respeita `Save-Data` e conexões lentas).
- ✅ **CSS Tree-shaking de Alta Fidelidade:** Usa `linkedom` para análise precisa de seletores usados em cada página.
- ✅ **Acessibilidade (A11y):** Gerencia automaticamente o foco do teclado após a navegação para garantir que usuários de leitores de tela percebam a mudança de conteúdo.
- ✅ **Normalização de Assets:** Corrige automaticamente caminhos de fontes e imagens no CSS inline para funcionarem em rotas aninhadas.
- ✅ **Safelist CSS:** Permite preservar classes adicionadas dinamicamente via JavaScript.

## Performance

| Métrica | Nuxt padrão | nuxt-lite |
|---|---|---|
| JS na primeira requisição | ~530 KB | **~5 KB** |
| Redução de JS | — | **99.1%** |
| SEO | ✅ Completo | ✅ Completo |
| Interatividade | ⚠️ Estático/JS Puro | ✅ SPA dinâmico |

## Instalação

```bash
npx nuxi module add nuxt-lite
```

Ou adicione manualmente ao `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: [
    '~~/nuxt-lite/src/module',  // Deve ser o PRIMEIRO módulo
  ],
  nuxtLite: {
    optimizeCss: 'inline', // 'inline' | 'file' | false
    safelist: ['is-active', 'menu-open'], // Classes dinâmicas a preservar
  },
})
```

## Configurações

| Opção | Padrão | Descrição |
|---|---|---|
| `optimizeCss` | `false` | Otimização de CSS: `true`/`'inline'` (por página) ou `'file'` (arquivo único global). |
| `safelist` | `[]` | Lista de classes ou seletores que NÃO devem ser removidos no tree-shaking. |
| `cleanHtml` | `true` | Remove artefatos Nuxt/Vue (`__NUXT_DATA__`, etc.) e limpa comentários SSR. |

## Como Funciona

### Build-time (Geração Estática)
1. Durante o `nuxt generate`, o módulo intercepta cada página gerada.
2. O HTML é parseado usando o **linkedom** (um parser DOM ultra-rápido para Node).
3. O conteúdo do `<main>` é extraído e transformado em uma árvore JSON compacta (`_payload.json`).
4. Scripts e estilos originais do Vue/Nuxt são removidos para garantir um HTML puro.
5. O runtime `lite.js` (escrito em TypeScript) é injetado no final do `<body>`.

### Client-side (Navegação)
1. Quando um link entra na tela, o `IntersectionObserver` inicia o prefetch do JSON daquela página.
2. Ao clicar, o runtime busca o JSON (geralmente já em cache) e reconstrói apenas o conteúdo variável.
3. Aplica transições CSS (respeitando `.page-enter-active`, etc.).
4. **Foco:** O runtime move o foco para o primeiro `<h1>` encontrado ou para o contêiner principal, seguindo boas práticas de acessibilidade.

## Estrutura de Páginas

Para que a navegação funcione, envolva o conteúdo variável no seu layout principal:

```vue
<!-- layouts/default.vue -->
<template>
  <div>
    <header>...</header>
    <main data-page-content> <!-- Atributo obrigatório ou tag <main> -->
      <slot />
    </main>
    <footer>...</footer>
  </div>
</template>
```

## Transições CSS

Defina as classes de transição no seu CSS global:

```css
.page-enter-active, .page-leave-active {
  transition: opacity 0.3s ease;
}
.page-enter-from, .page-leave-to {
  opacity: 0;
}
```

## Limitações

- **Apenas sites estáticos:** Projetado exclusivamente para `nuxt generate`.
- **Sem reatividade Vue no cliente:** Como o Vue runtime é removido, componentes que dependem de `ref`, `reactive` ou eventos Vue no navegador não funcionarão. Use JavaScript puro ou Web Components para interatividades leves.

## Licença

MIT
