# Análise Completa: nuxt-lite

## 1. Visão Geral

### 1.1 O Que É

**nuxt-lite** é um módulo Nuxt que substitui o Vue runtime (~228KB) por um script próprio de **~4KB** no bundle do cliente, mantendo funcionalidades essenciais como hidratação, navegação SPA com transições CSS e prefetch inteligente. O objetivo é reduzir em **99.2%** o JavaScript enviado ao cliente na primeira requisição, preservando SEO completo via SSR.

### 1.2 Propósito

| Problema | Solução |
|---|---|
| Nuxt padrão envia ~530KB de JS ao cliente | Runtime próprio de ~4KB |
| CSS não utilizado é enviado ao browser | Tree-shaking de CSS por página |
| Scripts Vue SSR são dead weight | Limpeza automática do HTML |
| Navegação entre páginas requer reload | SPA router customizado |

### 1.3 Métricas de Performance

| Métrica | Nuxt Padrão | nuxt-lite | Redução |
|---|---|---|---|
| JS na primeira requisição | ~530 KB | ~4 KB | **99.2%** |
| CSS | Múltiplos arquivos | 1 inline ou 1 arquivo | Variável |
| SEO | ✅ | ✅ (SSR completo) | — |
| Transições | ✅ | ✅ (CSS nativo) | — |

---

## 2. Arquitetura

### 2.1 Estrutura de Diretórios

```
nuxt-lite/src/
├── module.ts              # Entry point — defineNuxtModule, hook 'close'
├── types.ts               # ModuleOptions, CssMode, constantes, regex
├── index.ts               # Export público (NuxtLiteOptions)
├── css/
│   ├── parser.ts          # parseCssRules() — brace-counting, suporta @media aninhados
│   └── filter.ts          # filterCssBySelectors() — tree-shaking por seletores
├── html/
│   ├── extract.ts         # extractUsedSelectors() — classes, IDs, tags, data-*
│   ├── clean.ts           # stripExistingCss(), stripVueRuntime(), stripNuxtScripts()
│   └── process.ts         # processAllHtml() — orquestrador (6 fases)
├── fs/
│   └── index.ts           # collectAllCssFiles(), removeRedundantCssFiles()
└── runtime/
    ├── lite.js            # Runtime injetado (~4KB) — SPA, reatividade, prefetch
    └── server/
        ├── plugin.ts      # Nitro plugin — hook render:response
        └── tsconfig.json  # TS config para server runtime
```

### 2.2 Fluxo de Execução

```
nuxt generate
     ↓
Build estático do Nuxt (SSR completo)
     ↓
Hook 'close' do Nuxt
     ↓
┌─────────────────────────────────────────┐
│ processAllHtml() — 6 fases              │
│                                         │
│ 1. Coleta CSS do dist/                  │
│ 2. Coleta todos os HTMLs                │
│ 3. (modo file) Agrega seletores globais │
│ 4. Parse do CSS (cache único)           │
│ 5. Processa cada HTML:                  │
│    a. Extrai seletores usados           │
│    b. Filtra CSS (tree-shaking)         │
│    c. Remove CSS/Vue/Nuxt dead code     │
│    d. Injeta runtime lite minificado    │
│ 6. (modo file) Grava optimized.css      │
└─────────────────────────────────────────┘
     ↓
dist/ limpo e otimizado
```

### 2.3 Pipeline de Processamento (6 Fases)

| Fase | Descrição | Função |
|---|---|---|
| **1. Coleta CSS** | Varre `dist/` e coleta todos os `.css` | `collectAllCssFiles()` |
| **2. Coleta HTML** | Varre recursivamente todos os `.html` | `collectHtml()` |
| **3. Agregação** | Junta seletores de todas as páginas (modo `file`) | `extractUsedSelectors()` × N |
| **4. Parse CSS** | Parsing único com brace-counting | `parseCssRules()` |
| **5. Processamento** | Extrai, filtra, limpa e injeta por arquivo | `processFile()` |
| **6. Output** | Grava `css/optimized.css` e remove redundantes (modo `file`) | `removeRedundantCssFiles()` |

---

## 3. Componentes Detalhados

### 3.1 Entry Point (`module.ts`)

```ts
defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-lite',
    configKey: 'nuxtLite',
    compatibility: { nuxt: '^4.0.0' },
  },
  defaults: { optimizeCss: false, inlineStyles: false },
  setup(options, nuxt) {
    if (nuxt.options.dev) return  // ← Zero impacto no dev
    nuxt.hook('close', async () => { /* processa dist/ */ })
  },
})
```

**Características:**
- Compatibilidade: **Nuxt ^4.0.0**
- **Zero impacto em desenvolvimento** — só executa em produção (`nuxt generate`)
- Hook `'close'` — roda após o `nuxt generate` terminar
- Lê `lite.js`, resolve modo CSS e chama `processAllHtml()`

### 3.2 CSS Parser (`css/parser.ts`)

- Usa **brace-counting** (não regex) para suportar `@media` aninhados
- Extrai seletores e blocos CSS para `Map<string, string>`
- Preserva automaticamente:
  - `@font-face`, `@keyframes`, `@charset`, `@import`
  - Seletores essenciais (`html`, `body`, `:root`, `.dark`, `h1-h6`, etc.)
  - Transições Nuxt (`.page-enter-*`, `.page-leave-*`)

### 3.3 CSS Filter (`css/filter.ts`)

- `filterCssBySelectors()` — filtra regras baseado em `Set<string>` de seletores usados
- `selectorMatches()` — matching rápido via Set lookups
- Lida com seletores compostos, pseudo-classes, IDs

### 3.4 HTML Extractor (`html/extract.ts`)

Extrai do HTML:
- Classes (`class="..."`)
- IDs (`id="..."`)
- Atributos `data-*`
- Nomes de tags HTML

Sempre preserva `ESSENTIAL_SELECTORS` (definido em `types.ts`).

### 3.5 HTML Cleaner (`html/clean.ts`)

| Função | Remove |
|---|---|
| `stripExistingCss()` | `<link rel="stylesheet">`, `<style>` |
| `stripVueRuntime()` | `<script type="module" src="/_nuxt/...">`, `modulepreload`, `prefetch` |
| `stripNuxtScripts()` | `__NUXT_DATA__`, configs, teleports, **unwrap do `<div id="__nuxt">`** |

**Nota:** Usa regex-based cleaning (mais rápido, mas potencialmente frágil para HTML malformado).

### 3.6 Runtime Lite (`runtime/lite.js`) — ~4KB

#### Sistema Reativo Customizado

```js
function reactive(obj) {
  return new Proxy(obj, {
    set(t, p, v) {
      const old = t[p]; t[p] = v;
      if (old !== v) subs.get(p)?.forEach(fn => fn(v, old));
      subs.get('*')?.forEach(fn => fn(v, old));
      return true;
    }
  });
}
function on(prop, fn) { /* registra callback */ }
```

#### Navegação SPA

1. Intercepta cliques em `<a href="/">`
2. Busca HTML via `fetch()`
3. Aplica transição CSS de saída (`page-leave-*`)
4. Troca conteúdo (`swapContent`)
5. Aplica transição CSS de entrada (`page-enter-*`)
6. Atualiza `history.pushState`
7. `scrollTo({ top: 0 })`

#### Prefetch por Hover

- `mouseover` em links → `setTimeout(100ms)` → `prefetchHTML(href)`
- `mouseout` → cancela timeout
- Cache via `Map` evita refetch

#### Estado Global

```js
window.__NUXT_LITE_STATE__ = reactive({ page: '/' })
window.__NuxtLite = { reactive, on }
```

---

## 4. Modos de CSS (`optimizeCss`)

| Modo | Comportamento | Uso Ideal |
|---|---|---|
| `false` (padrão) | Sem otimização CSS | Compatibilidade com comportamento Nuxt |
| `true` / `'inline'` | Tree-shake por página, injeta `<style>` no `<head>` | Sites pequenos/médios |
| `'file'` | Tree-shake global, gera `/css/optimized.css` | Sites grandes, cache HTTP |

### Exemplo de Output — Modo `inline`

```html
<head>
  <style>body{margin:0}.container{max-width:1200px}...</style>
</head>
```

### Exemplo de Output — Modo `file`

```html
<head>
  <link rel="preload" href="/css/optimized.css" as="style">
  <link rel="stylesheet" href="/css/optimized.css">
</head>
```

---

## 5. Configuração

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '~~/nuxt-lite/src/module',  // deve ser o PRIMEIRO módulo
  ],
  nuxtLite: {
    optimizeCss: 'inline',  // 'inline' | 'file' | false
  },
})
```

### Opções Completas

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `optimizeCss` | `boolean \| 'inline' \| 'file'` | `false` | Tree-shaking CSS |
| `inlineStyles` | `boolean` | `false` | **Deprecated** — use `optimizeCss` |
| `stripAttributes` | `string[]` | `['data-v-', '__vue_ssr__', 'data-server-rendered']` | Atributos SSR a remover |
| `cleanHtml` | `boolean` | `true` | Limpar artefatos Nuxt/Vue |
| `payloadExtraction` | `boolean` | `true` | Extrair `__NUXT_DATA__` para JSON |
| `hydration` | `boolean` | `true` | Habilitar runtime SPA |
| `prefetchRoutes` | `boolean` | `true` | Prefetch por hover/viewport |

---

## 6. Análise de Portabilidade

### 6.1 Vantagens para Portabilidade

| Aspecto | Avaliação | Detalhe |
|---|---|---|
| **Zero dependências de runtime** | ✅ Excelente | Apenas `@nuxt/kit` e `diff` — nenhum binding nativo |
| **TypeScript puro** | ✅ Excelente | Sem features experimentais, TS ~6.0.2 |
| **ESM nativo** | ✅ Excelente | `"type": "module"` no package.json |
| **Sem I/O fora do dist/** | ✅ Excelente | Só lê/escreve dentro do diretório de output |
| **Sem stateful global no build** | ✅ Excelente | Funções auxiliares sem side effects |
| **Compatibilidade Nuxt** | ⚠️ Limitada | Apenas Nuxt `^4.0.0` |
| **Node.js version** | ⚠️ Não especificada | CI usa Node 20, mas não há `.nvmrc` ou `engines` |
| **Sistema de arquivos** | ⚠️ Unix-style | Paths com `/` — pode ter problemas no Windows |

### 6.2 Dependências

#### Produção

| Pacote | Versão | Propósito |
|---|---|---|
| `@nuxt/kit` | `^4.4.2` | API para criação de módulos Nuxt |
| `diff` | `^8.0.4` | Importado mas **não visivelmente usado** no código atual |

#### Desenvolvimento

| Pacote | Versão | Propósito |
|---|---|---|
| `nuxt` | `^4.4.2` | Framework Nuxt para playground |
| `@nuxt/module-builder` | `^1.0.2` | Build do módulo |
| `@nuxt/test-utils` | `^4.0.0` | Testes E2E |
| `vitest` | `^4.1.3` | Runner de testes |
| `@nuxt/eslint-config` | `^1.15.2` | ESLint flat config |
| `typescript` | `~6.0.2` | Type checking |
| `vue-tsc` | `^3.2.6` | Type checking Vue |
| `changelogen` | `^0.6.2` | CHANGELOG automático |

### 6.3 Riscos de Portabilidade

| Risco | Severidade | Mitigação |
|---|---|---|
| **Paths Unix-style** | Média | Usar `path.join()` / `path.resolve()` consistentemente (já parcialmente feito) |
| **Dependência de `nuxt generate`** | Alta | Não funciona com `nuxt build` (servidor Nitro) — apenas static sites |
| **Regex-based HTML cleaning** | Média | Frágil para HTML malformado; sem parser DOM no build |
| **`diff` não utilizado** | Baixa | Dependência fantasma — aumenta bundle desnecessariamente |
| **Sem especificação de Node** | Baixa | Adicionar `"engines": { "node": ">=20" }` ao package.json |

---

## 7. Limitações Conhecidas

### 7.1 Limitações de Design

| Limitação | Impacto | Workaround |
|---|---|---|
| **Apenas `nuxt generate`** | Não funciona com SSR dinâmico | Usar apenas para sites estáticos |
| **Zero runtime no dev** | Não é testável em desenvolvimento | Dependência total do `nuxt generate` para testar |
| **Regex-based cleaning** | Pode quebrar com HTML não padrão | Manter HTML bem-formado; considerar parser DOM |
| **JS minification manual** | Não ofusca, só remove comentários/whitespace | Adequado para runtime próprio; não usar para código de terceiros |
| **Sem suporte a `<script setup>` dinâmico** | Componentes com JS assíncrono podem não hidratar | Limitar a conteúdo estático |

### 7.2 Discrepâncias README vs Código

| Documentado | Implementado | Status |
|---|---|---|
| `IntersectionObserver` com `rootMargin: 200px` | **Não implementado** — só prefetch por hover | ⚠️ Bug |
| `prefetchRoutes` como opção | **Não lido** no `module.ts` | ⚠️ Bug |
| Extração de `payload.json` | **Não visível** no código atual | ⚠️ Incompleto |
| CSS `optimizeCss: 'file'` gera arquivo | ✅ Implementado | ✅ OK |

### 7.3 Limitações do Runtime

| Recurso | Suporte |
|---|---|
| Navegação SPA | ✅ Links internos (`href="/..."`) |
| Transições CSS | ✅ Via `getComputedStyle` |
| Prefetch por hover | ✅ Com debounce de 100ms |
| Prefetch por viewport | ❌ Não implementado |
| Botão voltar/avançar | ✅ Via `popstate` |
| Meta tags dinâmicas | ✅ `title`, `description`, `canonical` |
| Hidratação Vue | ❌ Sem Vue no cliente — zero reatividade de componentes |
| Formulários complexos | ⚠️ Funcionam, mas sem validação Vue |
| Links externos | ✅ Fallback para `window.location.href` |
| Downloads/arquivos | ✅ Ignora `.pdf`, `.jpg`, etc. |

---

## 8. Qualidade de Código

### 8.1 Pontos Fortes

| Aspecto | Avaliação |
|---|---|
| **Arquitetura funcional pura** | Funções auxiliares sem side effects — fácil de testar |
| **Separação de responsabilidades** | Parser, filter, extract, clean, process — cada um com propósito único |
| **Tipagem TypeScript** | Interfaces claras (`ModuleOptions`, `CssMode`, `ExtendedOptions`) |
| **Constantes imutáveis** | `Object.freeze()` em `ESSENTIAL_SELECTORS`, `SKIP_CSS_FILES` |
| **Zero impacto no dev** | `if (nuxt.options.dev) return` — seguro para desenvolvedores |
| **Testes E2E** | Vitest + `@nuxt/test-utils` com fixture mínima |
| **CI/CD** | GitHub workflow com lint + test |

### 8.2 Pontos de Melhoria

| Item | Prioridade | Sugestão |
|---|---|---|
| **`diff` não utilizado** | Alta | Remover da `dependencies` ou implementar feature de diff |
| **IntersectionObserver faltando** | Alta | Implementar ou remover do README |
| **`prefetchRoutes` não lido** | Média | Ler a opção no módulo e conectar ao runtime |
| **Especificação de Node** | Média | Adicionar `"engines": { "node": ">=20" }` |
| **Testes insuficientes** | Média | Adicionar testes unitários para parser CSS, extractor HTML, etc. |
| **Minificação JS rudimentar** | Baixa | Considerar `esbuild` ou `terser` para código de produção |
| **Sem `.nvmrc` / `.node-version`** | Baixa | Adicionar para consistência de ambiente |

---

## 9. Casos de Uso Ideais

### ✅ Recomendado Para

| Cenário | Por Quê |
|---|---|
| **Sites estáticos** (blogs, portfolios, landing pages) | SEO + performance extrema |
| **Documentação técnica** | Conteúdo estático, navegação SPA |
| **Sites institucionais** | Pouca interatividade, necessidade de SEO |
| **Projetos com Lighthouse crítico** | 99.2% menos JS = score alto |
| **Edge hosting** (Cloudflare Pages, Vercel Edge) | Bundle mínimo = cold start rápido |

### ❌ Não Recomendado Para

| Cenário | Por Quê |
|---|---|
| **Aplicações SPA complexas** | Sem Vue runtime = zero reatividade de componentes |
| **Dashboards com estado** | Sem store Vuex/Pinia no cliente |
| **E-commerce com carrinho dinâmico** | Sem hidratação Vue para interatividade |
| **Projetos com `<script setup>` assíncrono** | Componentes não hidratam no cliente |
| **Sites com SSR dinâmico** | Só funciona com `nuxt generate` |

---

## 10. Comparativo com Alternativas

| Feature | nuxt-lite | Nuxt padrão | Astro | Nuxt Prerender |
|---|---|---|---|---|
| JS inicial | **~4KB** | ~530KB | ~0KB (ilhas) | ~530KB |
| SEO | ✅ | ✅ | ✅ | ✅ |
| SPA navigation | ✅ | ✅ | ❌ (MPA) | ❌ (MPA) |
| CSS tree-shaking | ✅ | ⚠️ Parcial | ✅ | ⚠️ Parcial |
| Vue no cliente | ❌ | ✅ | Parcial (ilhas) | ✅ |
| Complexidade | Baixa | Alta | Média | Alta |
| Ecossistema | Nuxt | Nuxt | Astro | Nuxt |

---

## 11. Guia de Integração

### 11.1 Instalação Rápida

```bash
# Copie o diretório nuxt-lite para a raiz do seu projeto Nuxt
cp -r /path/to/nuxt-lite ./nuxt-lite

# Adicione ao nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '~~/nuxt-lite/src/module',  // PRIMEIRO
  ],
  nuxtLite: {
    optimizeCss: 'inline',
  },
})

# Generate estático
npx nuxt generate
```

### 11.2 Requisitos do Projeto Host

- **Nuxt ^4.0.0** (obrigatório)
- **Node.js >= 20** (recomendado)
- **Site estático** (`nuxt generate`, não `nuxt build`)
- HTML bem-formado (devido ao regex-based cleaning)

### 11.3 CSS Transitions Obrigatórios

Para que a navegação SPA funcione com transições, o projeto deve definir:

```css
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
```

O runtime detecta automaticamente a duração via `getComputedStyle`.

### 11.4 Estrutura de Páginas

Páginas devem usar `[data-page-content]` ou `<main>` para o runtime identificar o container de navegação:

```vue
<template>
  <main data-page-content>
    <NuxtPage />
  </main>
</template>
```

---

## 12. Roadmap Sugerido

| Prioridade | Item | Impacto |
|---|---|---|
| 🔴 Crítico | Implementar `IntersectionObserver` ou remover do README | Consistência documentação |
| 🔴 Crítico | Remover `diff` das dependências ou implementar feature | Reduzir bundle |
| 🟡 Alta | Adicionar testes unitários (parser CSS, extractor HTML) | Confiabilidade |
| 🟡 Alta | Conectar opção `prefetchRoutes` ao runtime | Feature completa |
| 🟢 Média | Especificar `"engines"` no package.json | Portabilidade |
| 🟢 Média | Adicionar `.nvmrc` ou `.node-version` | Consistência |
| 🟢 Média | Migrar minificação para `esbuild` | Qualidade do output |
| 🔵 Baixa | Suporte a Windows (testar paths) | Portabilidade cross-platform |

---

## 13. Conclusão

### 13.1 Resumo Executivo

O **nuxt-lite** é um módulo bem arquitetado que cumpre sua promessa principal: **reduzir 99.2% do JS no cliente** para sites estáticos Nuxt. Sua arquitetura funcional pura, separação de responsabilidades e zero impacto no dev são excellentes.

### 13.2 Veredito de Portabilidade

| Critério | Score | Comentário |
|---|---|---|
| **Portabilidade** | ⭐⭐⭐⭐☆ | Paths Unix-style e falta de `.nvmrc` são os únicos pontos fracos |
| **Documentação** | ⭐⭐⭐☆☆ | README completo, mas discrepâncias com código prejudicam confiança |
| **Confiabilidade** | ⭐⭐⭐☆☆ | Testes E2E mínimos; faltam testes unitários |
| **Manutenibilidade** | ⭐⭐⭐⭐⭐ | Código limpo, tipado, funcional e bem separado |
| **Utilidade** | ⭐⭐⭐⭐⭐ | Propósito claro e executado com excelência |

### 13.3 Recomendação Final

**Use para:** Sites estáticos, blogs, documentações, landing pages — onde performance extrema é crítica.

**Evite para:** Aplicações SPA complexas, dashboards, e-commerce dinâmico — onde reatividade Vue é essencial.

**Antes de produzir:** Corrija as discrepâncias README/código (IntersectionObserver, `prefetchRoutes`, `diff`) e adicione testes unitários para garantir confiabilidade a longo prazo.
