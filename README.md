# nuxt-lite

Módulo Nuxt para geração estática com hidratação leve, otimização de CSS e navegação SPA customizada.

## Visão Geral

Elimina o **Vue runtime** (228KB) do bundle do cliente e o substitui por um script de **~4KB** que mantém:

- ✅ **Hidratação a partir de `__NUXT_DATA__`** (formato compacto do Nuxt)
- ✅ **Navegação SPA com transições CSS nativas** (respeita `.page-enter-active`, etc.)
- ✅ **Prefetch inteligente** (IntersectionObserver, sob demanda)
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

### `optimizeCss`

| Modo | Comportamento |
|---|---|
| `false` | Sem otimização (comportamento padrão do Nuxt/Vite) |
| `true` ou `'inline'` | Tree-shake CSS por página e injeta em `<style>` no `<head>` |
| `'file'` | Tree-shake globalmente e gera `/css/optimized.css` com `<link rel="preload">` + `<link rel="stylesheet">` |

#### Exemplo: CSS inline (recomendado para sites pequenos/médios)

```ts
nuxtLite: {
  optimizeCss: 'inline',
}
```

Cada página recebe apenas o CSS que usa, injetado diretamente no HTML — zero requests bloqueantes.

#### Exemplo: Arquivo único (recomendado para sites grandes)

```ts
nuxtLite: {
  optimizeCss: 'file',
}
```

Gera um único `/css/optimized.css` com preload de alta prioridade. Ideal quando o CSS inline ficaria muito grande.

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

1. **Extrai `__NUXT_DATA__`** → salva como `payload.json` por rota
2. **Tree-shake CSS** → injeta apenas seletores usados (inline ou arquivo)
3. **Remove Vue runtime** → `<script type="module" src="/_nuxt/...">`
4. **Remove modulepreload** → `<link rel="modulepreload" href="/_nuxt/...">`
5. **Remove prefetch de JS** → `<link rel="preload/prefetch" href="/_nuxt/*.js">`
6. **Injeta runtime lite** → ~4KB inline antes do `</body>`

### No cliente:

1. **Primeira carga** → HTML estático renderizado instantaneamente (zero JS bloqueante)
2. **Runtime carrega** → lê `__NUXT_DATA__` e prepara navegação
3. **Navegação** → intercepta links, busca HTML novo, troca conteúdo com transição CSS nativa
4. **Prefetch** → carrega rotas visíveis no viewport (lazy, baixa prioridade)

## Estrutura de Arquivos Gerados

```
dist/
├── index.html                    # HTML estático + CSS inline + runtime
├── manuscritos/
│   └── ao-redor-do-portao/
│       ├── index.html            # HTML estático + CSS inline + runtime
│       └── payload.json          # Dados serializados do Nuxt
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
```ts
// Acessível via window.__NuxtLite
const { reactive, on } = window.__NuxtLite

const state = reactive({ page: '/' })
on('page', (newPage) => console.log('Navegou para:', newPage))
```

### Estado Global
```ts
window.__NUXT_LITE_STATE__.page  // rota atual
```

### Transição de Páginas

Respeita as classes CSS configuradas no projeto (ex: `.page-enter-active`, `.page-leave-from`). O runtime lê a duração da transição via `getComputedStyle` e usa `transitionend` para sincronização precisa.

### Prefetch Lazy

- IntersectionObserver com `rootMargin: 200px`
- Só observa links próximos ao viewport
- Fetch com `priority: 'low'` para não competir com navegação
- Cada link é observado apenas uma vez (unobserve após prefetch)

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
│   ├── clean.ts           # stripCss, stripVueRuntime, extractPayload
│   └── process.ts         # processAllHtml + processFile
├── fs/
│   └── index.ts           # collectAllCssFiles, removeRedundantCssFiles
└── runtime/
    └── lite.js            # Runtime injetado (~4KB)
```

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Preparar módulo
npm run dev:prepare

# Rodar playground
npm run dev

# Build do módulo
npm run prepack
```

## License

MIT
