# 📊 ANÁLISE: Oportunidades de Limpeza e Padronização - nuxt-lite

**Data**: 2026-04-19  
**Total de linhas**: 4.320 linhas TypeScript  
**Arquivos analisados**: 20 arquivos `.ts`

---

## 🎯 OPORTUNIDADES PRINCIPAIS

### 1. **PADRONIZAÇÃO DE COMENTÁRIOS** ⭐⭐⭐⭐⭐

#### 1.1 Mix de Idiomas (Português ❌ → Inglês ✅)
**Arquivos problemáticos**:
- `src/html/serialize.ts` linhas 2-8: Comentário em português
- `src/html/process.ts` linha 61: "Inserir no topo do head para evitar FOUC"
- Resto do código em inglês

**Impacto**: Confusão na manutenção, padrão inconsistente  
**Esforço**: 30 min  
**Ação**: Traduzir tudo para inglês

#### 1.2 Headers de Arquivo Inconsistentes
**Problema**: Diferentes estilos ou falta de documentação

**Padrão atual variável**:
```typescript
// serialize.ts
/**
 * serialize.ts — Parser HTML → JSON hierárquico (árvore DOM completa)
 * ...
 */

// clean.ts (sem header)
import { parseHTML } from 'linkedom'
```

**Padrão recomendado**:
```typescript
/**
 * module.ts — Main Nuxt module entry point
 * 
 * Handles module lifecycle, hooks configuration, and coordinates
 * CSS optimization, HTML processing, and SEO analysis during build.
 */
```

**Arquivos afetados**: `module.ts`, `html/clean.ts`, `css/parser.ts`, `fs/index.ts`

#### 1.3 Separadores de Seção Padronizados
**Usar consistentemente em todos os arquivos**:
```typescript
// ============================================================================
// Section Name
// ============================================================================
```

**Arquivos**: `types.ts`, `serialize.ts`, `parser.ts` (inconsistentes)

---

### 2. **CÓDIGO DUPLICADO** ⭐⭐⭐⭐

#### 2.1 Extração de Meta Tags (2 implementações!)
**Duplicação crítica**:
- `src/html/serialize.ts:324` - `extractMetaTags()` (para payload)
- `src/seo/metatags.ts` - `extractMetaTags()` (para análise SEO)
- Ambas parseiam o mesmo HTML, retornam estruturas similares

**Solução**: Criar `src/utils/meta.ts` com função consolidada

#### 2.2 Processamento de Data-v Attributes
**Duplicado em**:
- `src/html/clean.ts:41` - `stripDataVAttributes()` 
- `src/module.ts:193-200` - Mapeamento data-v (inline)

**Consolidar**: Uma função, um lugar

---

### 3. **VARIÁVEIS NÃO UTILIZADAS** ⭐⭐⭐⭐

#### 3.1 `cssRules` Nunca Usada
**Arquivo**: `src/module.ts:45`
```typescript
const cssRules: Map<string, string> | null = null  // ❌ Nunca referenciada!
```
**Ação**: Remover

#### 3.2 Tipos Não Utilizados
**Arquivo**: `src/types.ts`
- `ProcessResult` (linhas 181-184) - nunca importada
- `FileResult` (linhas 186-189) - nunca importada

**Ação**: Remover ou documentar uso futuro

---

### 4. **FUNÇÃO MUITO GRANDE** ⭐⭐⭐

#### 4.1 `processPageContent()` (107 linhas)
**Arquivo**: `src/html/process.ts:19-121`

**Responsabilidades múltiplas**:
1. Extração de seletores
2. Otimização CSS
3. Limpeza de Vue runtime
4. Limpeza de artefatos Nuxt
5. Injeção de color mode
6. Normalização de imagens
7. Processamento SVG
8. Limpeza de comentários SSR

**Recomendação**: Dividir em funções menores:
- `extractSelectors()` - já existe
- `injectColorMode()`
- `normalizeImages()`
- `cleanSsrComments()`
- `processSvgsInPage()`

---

### 5. **LÓGICA NO TYPES.TS** ⭐⭐

#### 5.1 Arquivo com Dupla Responsabilidade
**Arquivo**: `src/types.ts` (325 linhas)

**Contém**:
- Tipos (0-180): OK ✅
- Constantes (191-246): OK ✅
- Regex patterns (216-246): OK ✅
- **Funções lógica (250-325): ❌ Devem estar separadas**

**Funções que deveriam ir para `src/utils/options.ts`**:
- `resolveCssMode()`
- `resolveSeoMode()`
- `resolveSeoConfig()`
- `resolveSvgConfig()`
- `resolveColorConfig()`
- `findOutputDir()`

**Benefício**: Testes unitários destas funções mais fáceis

---

### 6. **IMPORTS DESORGANIZADOS** ⭐⭐

#### 6.1 Sem Agrupamento
**Exemplo** - `src/module.ts:1-10`:
```typescript
import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { ModuleOptions, ExtendedOptions } from './types'
import { resolveCssMode, findOutputDir, resolveSeoConfig, ... } from './types'
import { processPageContent } from './html/process'
// ... mais misturado
```

**Padrão recomendado**:
```typescript
// Node stdlib
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// External dependencies
import { defineNuxtModule, createResolver } from '@nuxt/kit'

// Type imports
import type { ModuleOptions, ExtendedOptions } from './types'
import type { SeoReport } from './seo/types'

// Local imports - utils
import { resolveCssMode, findOutputDir, resolveSeoConfig, resolveSvgConfig, resolveColorConfig } from './types'

// Local imports - modules
import { processPageContent } from './html/process'
import { generateSpriteContainer } from './html/svg'
import { collectAllCssFiles, removeRedundantCssFiles, pruneNuxtArtifacts } from './fs'
```

**Arquivos principais**: `module.ts`, `seo/metatags.ts`, `html/process.ts`

---

### 7. **NOMENCLATURA INCONSISTENTE** ⭐⭐

#### 7.1 Prefixos sem Padrão Claro
**Inconsistência**:
- `strip*` - remove/modifica (`stripDataVAttributes`, `stripVueRuntime`)
- `extract*` - retorna dados (`extractUsedSelectors`, `extractMetaTags`)
- `process*` - transforma (`processPageContent`, `processSvgs`)
- `collect*` - agrupa (`collectAllCssFiles`)
- `generate*` - cria (`generateSpriteContainer`, `generateColorModeScript`)

**Status atual**: Uso é consistente com intenção ✅  
**Ação necessária**: Apenas documentar este padrão no README dev

---

### 8. **CÓDIGO COMENTADO / VAGO** ⭐⭐

#### 8.1 Comentários Incompletos
**Arquivo**: `src/module.ts:56-57`
```typescript
// Hook: nitro:config — intercept HTML, inject SLOT markers and process page
if (!route || typeof route.contents !== 'string') return
if (!route.route || route.skip) return
if (route.route.startsWith('/_nuxt') || route.route.startsWith('/__') || route.route.startsWith('/_ipx/')) return
// ... (check if HTML) ...  // ❌ Incompleto
```

**Ação**: Remover comentários vágos

#### 8.2 Especulação no Código
**Arquivo**: `src/html/clean.ts:92-94`
```typescript
// Remove Vue SSR comment markers
// linkedom might not fully support comment selection via querySelector,
// we might need a tree walker or regex for final cleanup of comments if needed.
```

**Ação**: Remover especulação ou testar e documentar

---

## 📋 CHECKLIST DE LIMPEZA

### Fase 1: Quick Wins (30-45 min) 🟢
- [ ] Remover `cssRules` não usada em `module.ts:45`
- [ ] Remover tipos `ProcessResult` e `FileResult` em `types.ts`
- [ ] Remover comentários vágos/incompletos
- [ ] Traduzir comentários em português para inglês

### Fase 2: Consolidação (2-3h) 🟠
- [ ] Adicionar headers de arquivo padronizados
- [ ] Padronizar separadores de seção (80 chars)
- [ ] Reorganizar imports (agrupar por tipo)
- [ ] Consolidar `extractMetaTags()` duplicada

### Fase 3: Refactoring (3-4h) 🟠
- [ ] Mover funções de `types.ts` → `utils/options.ts`
- [ ] Dividir `processPageContent()` em funções menores
- [ ] Extrair `utils/meta.ts` para consolidação

### Fase 4: Documentação (1-2h) 🟡
- [ ] Adicionar JSDoc para funções internas importantes
- [ ] Documentar padrões de nomenclatura
- [ ] Adicionar exemplos em comentários complexos

---

## 🎯 IMPACTO ESPERADO

| Métrica | Antes | Depois | Ganho |
|---------|-------|--------|-------|
| Linhas sem deadcode | 4.320 | 4.250 | -70 (-1.6%) |
| Duplicação | 3 funções | 0 | -100% |
| Imports > 80 chars | 6 linhas | 0 | -100% |
| Consistência comentários | 65% | 100% | +35% |
| Arquivos sem header | 5 | 0 | -100% |
| Funções > 100 linhas | 2 | 1 | -50% |

---

## 📚 RECOMENDAÇÕES ADICIONAIS

### Pattern: Função de Resolução de Opções
Considerar extrair em `src/core/resolve-options.ts`:
```typescript
export function resolveModuleOptions(rawOptions: ModuleOptions): ExtendedOptions {
  return {
    ...rawOptions,
    _cssMode: resolveCssMode(rawOptions),
    _seoMode: resolveSeoMode(rawOptions),
    // ... mais
  }
}
```

### Pattern: Hooks Separados
Considerar após módulo ficar < 200 linhas:
```typescript
export default defineNuxtModule({
  setup(options, nuxt) {
    setupPrerenderHook(nuxt, extendedOptions)
    setupBuildFinalizeHook(nuxt, extendedOptions)
  }
})
```

### Testes para Dead Code
Adicionar ao CI:
```bash
npm run lint -- --check-for-unused-imports
npm run build && npm run check-bundle-size
```

---

**Status**: ✅ Análise concluída  
**Próximo passo**: Implementar Fase 1 (Quick Wins)
