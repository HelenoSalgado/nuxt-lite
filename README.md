# nuxt-lite

Módulo Nuxt para geração estática com hidratação leve, otimização de CSS e navegação SPA customizada.

## Visão Geral

Elimina o **Vue runtime** (~228KB) do bundle do cliente e o substitui por um script de **~4KB** que mantém:

- ✅ **Hidratação a partir do HTML estático** (SSR completo)
- ✅ **Navegação SPA com transições CSS nativas** (respeita `.page-enter-active`, etc.)
- ✅ **Prefetch nativo por hover** (`<link rel="prefetch">`, browser gerencia cache)
- ✅ **CSS tree-shaking** (apenas seletores usados por página)
- ✅ **SEO intacto** (HTML estático completo no SSR)

## Performance

| Métrica | Nuxt padrão | nuxt-lite |
|---|---|---|
| JS na primeira requisição | ~530 KB | ~4 KB |
| Redução de JS | — | **99.2%** |
| CSS | Vários arquivos | 1 inline ou 1 arquivo |
| SEO | ✅ | ✅ (SSR completo) |
| Transições | ✅ | ✅ (CSS nativo do projeto) |

## Instalação

```bash
npx nuxi module add nuxt-lite
```

Ou adicione manualmente ao `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: [
    '~~/nuxt-lite/src/module',  // deve ser o PRIMEIRO módulo
  ],
  nuxtLite: {
    optimizeCss: 'inline',
  },
})
```

## Configurações

| Opção | Padrão | Descrição |
|---|---|---|
| `optimizeCss` | `false` | Otimização de CSS: `true`/`'inline'` para tree-shake por página, `'file'` para arquivo único |
| `inlineStyles` | `false` | **Deprecated.** Use `optimizeCss` |
| `stripAttributes` | `['data-v-', '__vue_ssr__', 'data-server-rendered']` | Atributos Vue SSR a remover do HTML |
| `cleanHtml` | `true` | Se deve limpar o HTML (remover artefatos Nuxt/Vue do SSR) |

### Detalhes das Opções

#### `optimizeCss`

| Modo | Comportamento |
|---|---|
| `false` | Sem otimização (comportamento padrão do Nuxt/Vite) |
| `true` ou `'inline'` | Tree-shake CSS por página e injeta em `<style>` no `<head>` |
| `'file'` | Tree-shake globalmente e gera `/css/optimized.css` com `<link rel="preload">` + `<link rel="stylesheet">` |

#### `stripAttributes`
Lista de atributos que o Nuxt/Vue adiciona ao HTML durante o SSR e que não são mais necessários após a remoção do Vue runtime. Útil para reduzir o tamanho do HTML final.

#### `cleanHtml`
Quando ativado, remove tags `<script>` do bundle do Nuxt, links de `modulepreload` e `prefetch` que não são mais úteis para o runtime lite, garantindo um HTML limpo e focado em performance.

### Exemplos de Configuração

#### CSS inline (recomendado para sites pequenos/médios)

```ts
nuxtLite: {
  optimizeCss: 'inline',
}
```

#### CSS em arquivo único (ideal para sites grandes)

```ts
nuxtLite: {
  optimizeCss: 'file',
}
```

## Como Funciona

### CSS Tree-Shaking

1. **Coleta** todos os arquivos `.css` do `dist/_nuxt/`
2. **Extrai** classes, IDs, nomes de tags HTML e `data-*` de cada página
3. **Parseia** o CSS completo com brace-counting (suporta `@media` aninhados)
4. **Filtra** apenas os blocos CSS cujos seletores são usados na página
5. **Preserva** `@font-face`, `@keyframes`, transições Nuxt e seletores essenciais
6. **Minifica** em linha única (sem quebras)
7. **Remove** arquivos CSS redundantes do output

### Durante o `nuxt generate`:

1. **Tree-shake CSS** → injeta apenas seletores usados (inline ou arquivo)
2. **Remove Vue runtime** → `<script type="module" src="/_nuxt/...">`
3. **Remove modulepreload** → `<link rel="modulepreload" href="/_nuxt/...">`
4. **Remove prefetch de JS** → `<link rel="preload/prefetch" href="/_nuxt/*.js">`
5. **Remove artefatos Nuxt** → `__NUXT_DATA__`, configs, teleports
6. **Injeta runtime lite** → ~4KB inline antes do `</body>`

### No cliente:

1. **Primeira carga** → HTML estático renderizado instantaneamente (zero JS bloqueante)
2. **Runtime carrega** → prepara sistema reativo e navegação SPA
3. **Navegação** → intercepta links, busca HTML novo (cache do browser se prefetched), troca conteúdo com transição CSS nativa
4. **Prefetch** → injeta `<link rel="prefetch" as="document">` no hover — browser gerencia prioridade e cache

## Estrutura de Arquivos Gerados

```
dist/
├── index.html                    # HTML estático + CSS inline + runtime
├── sobre/
│   └── index.html                # HTML estático + CSS inline + runtime
└── _nuxt/
    └── *.css                     # (removidos se optimizeCss: 'inline')
```

Ou no modo `file`:

```
dist/
├── index.html                    # HTML estático + <link rel="preload"> + <link>
├── css/
│   └── optimized.css             # CSS tree-shaken de todas as páginas
└── _nuxt/
    └── *.css                     # (removidos)
```

## Runtime Lite (~4KB)

O script injetado fornece:

### Sistema Reativo
```js
// Acessível via window.__NuxtLite
const { reactive, on } = window.__NuxtLite

const state = reactive({ page: '/' })
on('page', (newPage) => console.log('Navegou para:', newPage))
```

### Estado Global
```js
window.__NUXT_LITE_STATE__.page  // rota atual
```

### Transição de Páginas

Respeita as classes CSS configuradas no projeto (ex: `.page-enter-active`, `.page-leave-from`). O runtime lê a duração da transição via `getComputedStyle` e usa `transitionend` para sincronização precisa.

### Prefetch Nativo por Hover

- Injeta `<link rel="prefetch" as="document">` no `<head>` ao passar o mouse
- **Browser gerencia prioridade** — não compete com a navegação atual
- **Cache HTTP nativo** — quando o usuário clica, o `fetch()` já encontra a página em cache
- **Respeita `Save-Data`** — browsers em modo economia ignoram automaticamente
- **Sem cache customizado** — menos código, menos bugs

## Estrutura de Páginas

Para que a navegação SPA funcione corretamente, cada página deve ter um container de conteúdo identificável. O runtime procura por:

1. Elemento com atributo `data-page-content`
2. Ou tag `<main>` como fallback

```vue
<template>
  <main data-page-content>
    <h1>Título da Página</h1>
    <p>Conteúdo da página...</p>
  </main>
</template>
```

### Transições CSS Obrigatórias

Defina estas classes no CSS do projeto para que as transições funcionem:

```css
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}
```

O runtime detecta automaticamente a duração via `getComputedStyle`. Se nenhuma transição for encontrada, usa 400ms como fallback.

## Estrutura do Módulo

```
nuxt-lite/src/
├── module.ts              # Entry point — hook close do Nuxt
├── types.ts               # ModuleOptions, constantes, regex, helpers
├── index.ts               # NuxtLiteOptions (export público)
├── css/
│   ├── parser.ts          # parseCssRules + extractInnerSelectors
│   └── filter.ts          # filterCssBySelectors + selectorMatches
├── html/
│   ├── extract.ts         # extractUsedSelectors (HTML → Set)
│   ├── clean.ts           # stripCss, stripVueRuntime, stripNuxtScripts
│   └── process.ts         # processAllHtml + processFile
├── fs/
│   └── index.ts           # collectAllCssFiles, removeRedundantCssFiles
└── runtime/
    ├── lite.js            # Runtime injetado (~4KB)
    └── server/
        └── plugin.ts      # Nitro plugin (headers customizados)
```

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Preparar módulo
npm run dev:prepare

# Rodar playground
npm run dev

# Build estático para testar o runtime lite
npm run dev:build && npx nuxt generate playground

# Build do módulo
npm run prepack
```

## Limitações Conhecidas

- **Apenas `nuxt generate`**: Não funciona com `nuxt build` (servidor Nitro). Projetado para sites estáticos.
- **Zero runtime no dev**: O módulo só atua em produção. Não interfere no desenvolvimento.
- **Sem Vue no cliente**: Componentes Vue que dependem de reatividade no cliente não funcionam após navegação SPA. Ideal para conteúdo estático.
- **HTML bem-formado**: A limpeza usa regex. HTML malformado pode causar problemas.

## License

MIT
