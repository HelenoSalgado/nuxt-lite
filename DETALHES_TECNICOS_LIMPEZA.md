# 🔧 DETALHES TÉCNICOS - Plano de Limpeza nuxt-lite

## 1. DUPLICAÇÃO DE CÓDIGO - CONSOLIDAÇÃO DE META TAGS

### Problema Identificado

Duas implementações diferentes de `extractMetaTags()`:

#### Versão 1: `src/html/serialize.ts:324-346`
```typescript
export function extractMetaTags(html: string): PagePayload['meta'] {
  const meta: PagePayload['meta'] = { title: '', og: {}, twitter: {} }
  
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) meta.title = titleMatch[1]!.trim()
  
  const metaRe = /<meta\s+([^>]+)>/gi
  let m: RegExpExecArray | null
  while ((m = metaRe.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]!)
    const name = attrs.name || attrs.property
    const content = attrs.content || ''
    if (!name) continue
    if (name === 'description') meta.description = content
    else if (name.startsWith('og:')) (meta.og!)[name.slice(3)] = content
    else if (name.startsWith('twitter:')) (meta.twitter!)[name.slice(8)] = content
  }
  
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
  if (canonicalMatch) meta.canonical = canonicalMatch[1]
  
  return meta
}
```

#### Versão 2: `src/seo/metatags.ts:29+`
```typescript
export function extractMetaTags(html: string): ExtractedMeta {
  const meta: ExtractedMeta = {
    title: '',
    og: {},
    twitter: {},
    other: {},
  }
  
  const { document } = parseHTML(html)
  
  // Title
  const titleEl = document.querySelector('title')
  if (titleEl) meta.title = titleEl.textContent?.trim() || ''
  
  // Meta tags - diferentes abordagem
  // ... lógica diferente
}
```

### Diferenças Chave

| Aspecto | serialize.ts | metatags.ts |
|---------|--------------|-----------|
| Biblioteca | Regex puro | linkedom |
| Estrutura de saída | `PagePayload['meta']` | `ExtractedMeta` |
| Atributos extras | Nenhum | `other: {}` |
| Performance | Mais rápido | Mais seguro |
| Mantibilidade | Regex complexas | DOM parsing |

### Solução Recomendada

Criar `src/utils/meta-extractor.ts`:

```typescript
/**
 * meta-extractor.ts — Consolidated meta tag extraction
 * 
 * Provides single source of truth for extracting and normalizing
 * meta tags from HTML, supporting both regex and DOM parsing.
 */

export interface ExtractedMetaTags {
  title: string
  description?: string
  canonical?: string
  og: Record<string, string>
  twitter: Record<string, string>
  other: Record<string, string>
}

/**
 * Extract meta tags using regex (faster, for payload serialization)
 */
export function extractMetaTagsFast(html: string): ExtractedMetaTags {
  // ... current serialize.ts implementation
}

/**
 * Extract meta tags using DOM parsing (safer, for SEO analysis)
 */
export function extractMetaTagsSafe(html: string): ExtractedMetaTags {
  // ... adapt metatags.ts implementation
}

/**
 * Extract meta tags using appropriate method
 * Defaults to fast for production, safe for analysis
 */
export function extractMetaTags(
  html: string, 
  method: 'fast' | 'safe' = 'fast'
): ExtractedMetaTags {
  return method === 'fast' ? extractMetaTagsFast(html) : extractMetaTagsSafe(html)
}
```

### Impacto

- ✅ Uma implementação única
- ✅ Dois métodos especializados para casos de uso diferentes
- ✅ Facilita testes unitários
- ✅ Reduz duplicação: ~30 linhas economizadas

---

## 2. VARIÁVEIS NÃO UTILIZADAS

### 2.1 `cssRules` em module.ts:45

**Localização**: `src/module.ts:45`

```typescript
const cssRules: Map<string, string> | null = null  // ❌ NUNCA USADA
const globalUsedSelectors = new Set<string>()
const dataVMapping = new Map<string, string>()
const routeSymbols = new Map<string, any[]>()
const pageManifest: Record<string, { meta: any, domSize: number }> = {}
const seoReports = new Map<string, import('./seo/types').SeoReport>()
```

**Análise**: Inicializada como `null` e nunca referenciada. Provavelmente era intenção anterior, agora desnecessária.

**Ação**: Remover linha 45 completamente

### 2.2 Tipos Não Utilizados em types.ts

**Localização**: `src/types.ts:181-189`

```typescript
export interface ProcessResult {
  cleaned: number
  cssOptimized: number
}

export interface FileResult {
  cleaned: boolean
  cssOptimized: boolean
}
```

**Análise**: 
- Grep confirma não são importados em nenhum lugar
- Provavelmente remnantes de versão anterior
- Ocupam espaço, adicionam confusão

**Ação**: Remover ambos os tipos

### 2.3 Constantes Potencialmente Não Utilizadas

**Localização**: `src/types.ts:227-236`

```typescript
export const CSS_LINK_RE = /<link[^>]*rel="stylesheet"[^>]*href="[^"]*"[^>]*>\s*/g
export const STYLE_TAG_RE = /<style[^>]*>[\s\S]*?<\/style>\s*/g
export const VUE_RUNTIME_RE = /<script[^>]*type="module"[^>]*src="\/_nuxt\/[^"]*"[^>]*><\/script>/g
export const MODULEPRELOAD_RE = /<link[^>]*rel="modulepreload"[^>]*href="\/_nuxt\/[^"]*"[^>]*>/g
export const PREFETCH_RE = /<link[^>]*rel="(preload|prefetch)"[^>]*href="\/_nuxt\/[^"]*\.js[^"]*"[^>]*>/g
export const NUXT_DATA_RE = /<script[^>]*id="__NUXT_DATA__"[^>]*>[\s\S]*?<\/script>\s*/g
export const NUXT_CONFIG_RE = /<script[^>]*data-nuxt-data[^>]*>[\s\S]*?<\/script>\s*/g
export const TELEPORTS_RE = /<div id="teleports"><\/div>\s*/g
```

**Status**: Definidas mas **não importadas em nenhum lugar**

**Ação**: Remover ou documentar intenção de uso futuro com TODO comment

---

## 3. TRADUÇÃO DE COMENTÁRIOS PT-BR → EN

### Arquivos Afetados

#### 3.1 `src/html/serialize.ts:2-8`

**Antes**:
```typescript
/**
 * serialize.ts — Parser HTML → JSON hierárquico (árvore DOM completa)
 *
 * Converte o conteúdo do slot do layout em uma árvore JSON reconstruível:
 * { tag: 'div', attrs: { class: '...' }, children: [...] }
 *
 * Preserva: tags, atributos (SVG viewBox corrigido), textos, comentários
 */
```

**Depois**:
```typescript
/**
 * serialize.ts — HTML → Hierarchical JSON (Complete DOM tree)
 *
 * Converts layout slot content into a reconstructible JSON tree:
 * { tag: 'div', attrs: { class: '...' }, children: [...] }
 *
 * Preserves: tags, attributes (corrected SVG viewBox), text, comments
 */
```

#### 3.2 `src/html/serialize.ts:138-139`

**Antes**: `// Attribute Parser — com correção de viewBox`

**Depois**: `// Attribute Parser — with viewBox correction`

#### 3.3 `src/html/serialize.ts:149-151`

**Antes**:
```typescript
    // SSR entrega viewBox lowercase — restaurar
    if (lower === 'viewbox') name = 'viewBox'
```

**Depois**:
```typescript
    // SSR delivers viewBox lowercase — restore
    if (lower === 'viewbox') name = 'viewBox'
```

#### 3.4 `src/html/serialize.ts:162-163`

**Antes**: `// SVG attributes que precisam de camelCase`

**Depois**: `// SVG attributes that require camelCase`

#### 3.5 `src/html/process.ts:61`

**Antes**: `// Inserir no topo do head para evitar FOUC`

**Depois**: `// Insert at top of head to prevent FOUC`

### Verificação de Consistência

```bash
# Procurar por comentários em português
grep -r "á\|é\|í\|ó\|ú\|ã\|õ\|ç" src/ --include="*.ts" | grep -v "node_modules"

# Resultado esperado após limpeza: 0 ocorrências
```

---

## 4. PADRÃO DE HEADERS DE ARQUIVO

### Padrão Recomendado

Todos os arquivos > 20 linhas devem ter header:

```typescript
/**
 * module-name.ts — Brief, one-line description
 * 
 * Longer description explaining:
 * - What this module does
 * - Main public exports
 * - Key concepts or algorithms used
 * 
 * @example
 * ```ts
 * import { functionName } from './module-name'
 * ```
 */
```

### Arquivos Que Precisam de Header

| Arquivo | Linhas | Status | Ação |
|---------|--------|--------|------|
| `module.ts` | 365 | ❌ Sem | Adicionar |
| `types.ts` | 325 | ⚠️ Parcial | Melhorar |
| `html/process.ts` | 121 | ✅ Sim | OK |
| `html/serialize.ts` | 384 | ✅ Sim | Melhorar (PT-BR) |
| `html/clean.ts` | 96 | ❌ Sem | Adicionar |
| `html/extract.ts` | 54 | ❌ Sem | Adicionar |
| `css/parser.ts` | 99 | ❌ Sem | Adicionar |
| `css/filter.ts` | ? | ? | Verificar |
| `fs/index.ts` | 135 | ❌ Sem | Adicionar |
| `seo/metatags.ts` | ? | ? | Verificar |
| `seo/report.ts` | ? | ? | Verificar |

### Exemplo: Header para `html/clean.ts`

```typescript
/**
 * clean.ts — HTML cleaning and attribute normalization
 * 
 * Provides functions to strip Vue/Nuxt runtime artifacts,
 * remove obsolete attributes, and normalize HTML output
 * for optimized production builds.
 * 
 * Key functions:
 * - stripExistingCss() - Remove CSS links and style tags
 * - stripVueRuntime() - Remove Vue module scripts
 * - stripNuxtScripts() - Remove Nuxt artifacts
 * - stripDataVAttributes() - Remove scoped Vue attrs
 */

import { parseHTML } from 'linkedom'

// ============================================================================
// CSS Cleanup
// ============================================================================

export function stripExistingCss(document: Document): void {
  // ...
}
```

---

## 5. PADRÃO DE SEPARADORES DE SEÇÃO

### Padrão Atual (Inconsistente)

```typescript
// Tipo 1 (tipos.ts)
// ============================================================================
// Public API — module configuration for nuxt.config.ts
// ============================================================================

// Tipo 2 (parser.ts, ser, serialize.ts)
// ============================================================================
// Section Name
// ============================================================================

// Tipo 3 (comentários soltos)
// Just a random comment
function something() { }
```

### Padrão Uniforme a Implementar

```typescript
/**
 * Sempre 80 caracteres de '=' 
 * Comentário em inglês em maiúsculas ou Title Case
 * Linha em branco após
 */

// ============================================================================
// Section Name
// ============================================================================

```

### Script para Validação

```bash
#!/bin/bash
# Verificar separadores não uniformes
grep -r "// =[^=]" src/ --include="*.ts" | grep -v "80 chars"
grep -r "^//\s*\w" src/ --include="*.ts" | grep -v "============" | wc -l
```

---

## 6. ORGANIZAÇÃO DE IMPORTS

### Ordem Recomendada

Aplicar a todos os arquivos:

```typescript
// ============================================================================
// Node stdlib (ordenado alfabeticamente)
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// ============================================================================
// External dependencies (ordenado alfabeticamente)
// ============================================================================
import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { parseHTML } from 'linkedom'

// ============================================================================
// Type imports (use type keyword, ordenado alfabeticamente)
// ============================================================================
import type { Nuxt } from 'nuxt/schema'
import type { ModuleOptions, ExtendedOptions } from './types'
import type { SeoReport } from './seo/types'

// ============================================================================
// Local imports - utils (antes de features)
// ============================================================================
import { resolveCssMode, findOutputDir } from './utils/options'

// ============================================================================
// Local imports - features (por ordem de uso)
// ============================================================================
import { processPageContent } from './html/process'
import { collectAllCssFiles, removeRedundantCssFiles } from './fs'
```

### Arquivos Principais a Reformatar

1. `src/module.ts` - 10 imports desordenados
2. `src/html/process.ts` - 8 imports
3. `src/seo/metatags.ts` - 12+ imports
4. `src/fs/index.ts` - 3 imports (pequeno, mas aplicar padrão)

---

## 7. REFACTORING DE FUNÇÕES GRANDES

### 7.1 `processPageContent()` - 102 linhas

**Arquivo**: `src/html/process.ts:19-121`

**Divisão proposta**:

```
processPageContent(html, options, runtimeSrc, dataVMapping)
  ├── extractSelectors() → usedSelectors ✅ JÁ EXISTE
  ├── optimizeCSS()
  ├── stripRuntimeArtifacts()
  │   ├── stripVueRuntime()
  │   ├── stripNuxtScripts()
  │   └── stripDataVAttributes()
  ├── injectColorMode()
  ├── normalizeImages()
  ├── processSvgs()
  └── cleanSSRComments()

return { html, usedSelectors, symbols }
```

**Implementação**:

```typescript
/**
 * Main orchestration function (simplified)
 */
export function processPageContent(
  html: string,
  options: ExtendedOptions,
  runtimeSrc: string,
  dataVMapping?: Map<string, string>
): PageProcessResult {
  const { document } = parseHTML(html)
  const usedSelectors = extractUsedSelectors(html, options.safelist)

  if (options._cssMode !== 'none') {
    optimizeCSS(document, options._cssMode)
  }

  stripRuntimeArtifacts(document, options._buildAssetsDir, dataVMapping)
  
  if (options._colorResolved.enabled) {
    injectColorMode(document, options._colorResolved)
  }

  normalizeImages(document)

  let finalHtml = document.toString()

  let pageSymbols: Map<string, SvgSymbol> | undefined
  if (options._svgResolved.enabled) {
    const result = processSvgs(finalHtml, options._svgResolved.minOccurrences)
    finalHtml = result.html
    pageSymbols = result.symbols
  }

  finalHtml = cleanSSRComments(finalHtml)

  return { html: finalHtml, usedSelectors, symbols: pageSymbols }
}

// Novas funções helpers
function optimizeCSS(document: Document, cssMode: CssMode): void {
  stripExistingCss(document)
  if (cssMode === 'file') {
    injectOptimizedCssLink(document)
  }
}

function stripRuntimeArtifacts(
  document: Document,
  buildAssetsDir: string,
  dataVMapping?: Map<string, string>
): void {
  stripVueRuntime(document, buildAssetsDir)
  stripNuxtScripts(document)
  if (dataVMapping) stripDataVAttributes(document, dataVMapping)
}

// ... etc
```

---

## 8. CHECKLIST DE VALIDAÇÃO

### Antes de Commit

```bash
# Build deve passar
npm run build

# Testes devem passar
npm run test

# Lint deve passar
npm run lint

# Não deve haver imports não utilizados
npm run lint -- --check-unused-imports

# TypeScript strict
npx tsc --noEmit

# Verificar comentários em português
grep -r "[áéíóúãõç]" src/ --include="*.ts" | wc -l  # Deve ser 0

# Verificar variáveis não utilizadas
npm run lint -- --check-unused-vars

# Verificar dead code
npx knip
```

---

## 9. TIMELINE ESTIMADA

| Fase | Tarefa | Tempo | Status |
|------|--------|-------|--------|
| 1 | Remover variáveis/tipos não usados | 30 min | 🟢 |
| 1 | Traduzir comentários PT-BR | 30 min | 🟢 |
| 2 | Adicionar headers de arquivo | 60 min | 🟠 |
| 2 | Padronizar separadores | 45 min | 🟠 |
| 2 | Reorganizar imports | 90 min | 🟠 |
| 3 | Consolidar meta tags | 120 min | 🟡 |
| 3 | Refatorar processPageContent | 120 min | 🟡 |
| 4 | Testes e validação | 60 min | 🟡 |
| **TOTAL** | | **~8h** | |

---

**Próximo**: Executar Fase 1 com commits atômicos
