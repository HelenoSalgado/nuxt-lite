# 📚 RECOMENDAÇÕES - Padrões e Boas Práticas nuxt-lite

## 1. PADRÕES DE COMENTÁRIOS

### 1.1 Header de Arquivo

**Obrigatório para arquivos > 30 linhas**

```typescript
/**
 * filename.ts — One-line description of what this module does
 * 
 * Extended description explaining:
 * - Primary responsibility
 * - Key public exports (functions/types)
 * - Main algorithm or concept (if complex)
 * 
 * @example
 * ```ts
 * import { functionName } from './filename'
 * const result = functionName(input)
 * ```
 */
```

### 1.2 Seções Dentro do Arquivo

**Usar para agrupar lógica relacionada**

```typescript
// ============================================================================
// Section Name (80 chars total, Title Case)
// ============================================================================

// Keep blank line after separator for readability
export function related() {}
export function functions() {}
```

### 1.3 Comentário de Função Complexa

**Usar JSDoc para funções públicas internas ou algoritmos não óbvios**

```typescript
/**
 * Extract inner selectors from @media block and associate with context
 * 
 * Handles nested media query rules by parsing block contents
 * and maintaining the @media rule context for selector matching.
 * 
 * @param inner - Content inside the @media block { ... }
 * @param atRule - The @media rule prefix (e.g., "@media (min-width: 768px)")
 * @param rules - Map to accumulate parsed rules with context
 * 
 * @example
 * ```ts
 * extractInnerSelectors(".button{...}", "@media (...)", map)
 * // Adds: "@media|...|.button" → "@media (...){.button {...}}"
 * ```
 */
function extractInnerSelectors(inner: string, atRule: string, rules: Map<string, string>): void
```

### 1.4 O Que NÃO Comentar

❌ **Nunca**: Explicar código óbvio
```typescript
// ❌ BAD
i++ // increment i

// ✅ GOOD
// Move to next element
i++
```

❌ **Nunca**: Especulação ou dúvida
```typescript
// ❌ BAD
// linkedom might not support this, maybe we need tree walker?

// ✅ GOOD
// Note: linkedom uses shallow querySelector; for deep node access we use DOM traversal
```

❌ **Nunca**: Comentários em português (exceto em docs externas)
```typescript
// ❌ BAD
// Inserir no topo do head para evitar FOUC

// ✅ GOOD
// Insert at top of head to prevent FOUC
```

### 1.5 Padrão de Linguagem

**Sempre inglês, presente simples, ativo**

```typescript
// ✅ GOOD
// Extract all CSS rules from the combined stylesheet

// ❌ BAD
// Extracts all CSS rules from the combined stylesheet (verbo errado)
// All CSS rules will be extracted from the combined stylesheet (passive)
// The combined stylesheet's CSS rules should be extracted (confuso)
```

---

## 2. NOMENCLATURA CONSISTENTE

### 2.1 Função com Prefixo (`verb + Object`)

| Prefixo | Significado | Exemplo | Retorno |
|---------|------------|---------|---------|
| `extract*` | Obtém dados do input | `extractUsedSelectors()` | Dados extraídos |
| `strip*` | Remove/limpa elemento | `stripDataVAttributes()` | Void (modifica) |
| `process*` | Transforma completamente | `processPageContent()` | Objeto transformado |
| `parse*` | Analisa string/estrutura | `parseCssRules()` | Estrutura parseada |
| `collect*` | Agrupa múltiplos itens | `collectAllCssFiles()` | Collection |
| `generate*` | Cria novo elemento | `generateSpriteContainer()` | Novo elemento |
| `resolve*` | Determina valor final | `resolveCssMode()` | Valor resolvido |
| `find*` | Busca específico | `findOutputDir()` | Item encontrado |

### 2.2 Variáveis com Significado Claro

```typescript
// ✅ GOOD
const cssRules = new Map<string, string>()
const globalUsedSelectors = new Set<string>()
const dataVMapping = new Map<string, string>()

// ❌ BAD
const map = new Map()      // qual map?
const set1 = new Set()     // conjunto de quê?
const data = {}            // que tipo de data?
```

### 2.3 Booleanos com `is`, `has`, `can`, `should`

```typescript
// ✅ GOOD
const isProduction = nuxt.options.dev === false
const hasSymbols = symbols.length > 0
const shouldOptimize = options.optimizeCss !== false
const canInline = cssMode === 'inline'

// ❌ BAD
const production = nuxt.options.dev === false
const symbols_present = symbols.length > 0
```

### 2.4 Callbacks com `on` ou `handle`

```typescript
// ✅ GOOD
const onRoute = (route) => { /* ... */ }
const handleError = (err) => { /* ... */ }

// ❌ BAD
const route = (route) => { /* ... */ }
const error = (err) => { /* ... */ }
```

---

## 3. ESTRUTURA DE ARQUIVOS

### 3.1 Organização por Responsabilidade

```
src/
├── core/                    # Entry point e config
│   ├── module.ts           # Definição do módulo
│   ├── resolve.ts          # Resolução de opções
│   └── lifecycle.ts        # Hooks do Nuxt
│
├── types/                   # Definições de tipos
│   ├── module.ts           # ModuleOptions, tipos públicos
│   ├── internal.ts         # ExtendedOptions, internos
│   └── constants.ts        # Constantes e regex
│
├── utils/                   # Utilitários compartilhados
│   ├── meta.ts            # Extração de meta tags
│   ├── options.ts         # Funções de resolução
│   └── validators.ts      # Validações comuns
│
├── seo/                     # Análise SEO
├── css/                     # Otimização CSS
├── html/                    # Processamento HTML
├── fs/                      # Operações filesystem
└── runtime/                 # Runtime browser
```

### 3.2 Tamanho Recomendado de Arquivo

| Tipo | Min | Ideal | Max |
|------|-----|-------|-----|
| Types | - | 50-100 | 150 |
| Utils | - | 30-80 | 120 |
| Feature | 20 | 100-200 | 300 |
| Service | 50 | 150-300 | 400 |

Se exceder: dividir em submódulos

### 3.3 Imports por Arquivo

Máximo recomendado: **15-20 linhas de import**

Se exceder:
1. Consolidar imports
2. Considerar reorganizar módulos
3. Criar arquivo agregador

```typescript
// ❌ RUIM: 25 imports
import { a, b, c, d, e } from 'module1'
import { f, g, h, i, j } from 'module2'
// ... 5 mais módulos

// ✅ BOM: Agregar se necessário
import * as utils from './utils'
import type { Config } from './types'
```

---

## 4. QUALIDADE E TESTING

### 4.1 Funções Testáveis

**Princípios**:
- Função = um trabalho
- Sem side effects se possível
- Determinística (mesmo input → mesmo output)
- Fácil de mockar dependências

```typescript
// ✅ TESTÁVEL
export function resolveCssMode(options: ModuleOptions): CssMode {
  if (options.optimizeCss === 'file') return 'file'
  if (options.optimizeCss === 'inline') return 'inline'
  if (options.optimizeCss === true) return 'inline'
  if (options.inlineStyles) return 'inline'
  return 'none'
}

// ❌ DIFÍCIL DE TESTAR
export function processAndWriteFile(path: string, data: any): void {
  const processed = complexTransform(data)
  writeFileSync(path, processed)  // side effect!
  console.log('Done')            // side effect!
}
```

### 4.2 Error Handling Padrão

```typescript
// ✅ PADRÃO RECOMENDADO
try {
  const content = readFileSync(path, 'utf-8')
  return processContent(content)
} catch (err) {
  // Log específico quando apropriado
  console.warn(`[nuxt-lite] Failed to read ${path}: ${err.message}`)
  // Ou usar debugger (já existente)
  // debug(`Failed to read: ${path}`, err)
  return defaultValue
}

// ❌ SILENCIOSO (apenas se realmente apropriado)
try {
  // ...
} catch { /* skip */ }
```

### 4.3 Type Safety

**Sempre strict quando possível**

```typescript
// ✅ Tipos precisos
export function stripDataVAttributes(
  document: Document,
  mapping?: Map<string, string>
): void

// ❌ Tipos vagos
export function stripDataVAttributes(document: any, mapping?: any): any
```

---

## 5. PERFORMANCE E OTIMIZAÇÃO

### 5.1 Evitar Operações Repetidas em Loop

```typescript
// ❌ RUIM: Chama regex n vezes
for (const file of files) {
  if (/\.js$/.test(file)) { /* ... */ }  // Compila regex a cada iteração
}

// ✅ BOM: Compila uma vez
const jsFileRe = /\.js$/
for (const file of files) {
  if (jsFileRe.test(file)) { /* ... */ }
}

// ✅ MELHOR: Usa filter nativo
files.filter(f => f.endsWith('.js'))
```

### 5.2 Usar Map/Set para Lookup

```typescript
// ❌ RUIM: O(n) lookup
const exists = Array.from(rules.values()).some(r => r.includes(selector))

// ✅ BOM: O(1) lookup
const ruleSet = new Set(rules.keys())
const exists = ruleSet.has(selector)
```

### 5.3 Lazy Loading

```typescript
// ✅ Import dinâmico para módulos pesados
if (options.optimizeSeo) {
  const { processSeoMeta } = await import('./seo/metatags')
  const result = processSeoMeta(html)
}
```

---

## 6. DOCUMENTAÇÃO

### 6.1 README.dev.md (Proposto)

Criar para documentar:
- Estrutura do projeto
- Fluxo de build
- Padrões de código
- Como adicionar feature

### 6.2 JSDoc Obrigatório Para

- ✅ Funções públicas (exports)
- ✅ Funções internas complexas (> 50 linhas)
- ✅ Algoritmos não óbvios
- ❌ Getters/setters simples
- ❌ Métodos óbvios

### 6.3 Exemplos em Comentários

```typescript
/**
 * Extract selectors used in HTML
 * 
 * @param html - HTML string to analyze
 * @param safelist - Selectors to always include (e.g., dynamic classes)
 * @param excludeSelector - Optional selector to exclude from analysis
 * @returns Set of all used selectors
 * 
 * @example
 * ```ts
 * const selectors = extractUsedSelectors(html, ['.dynamic-class'])
 * selectors.has('button') // true
 * selectors.has('unused-class') // false
 * ```
 */
export function extractUsedSelectors(
  html: string,
  safelist?: string[],
  excludeSelector?: string
): Set<string>
```

---

## 7. GIT E COMMITS

### 7.1 Commits Atômicos

Cada commit deve:
- Ser independente
- Passar testes sozinho
- Ter um propósito claro

```bash
# ❌ RUIM: Mistura tudo
git commit -m "cleanup and refactor"

# ✅ BOM: Atômico
git commit -m "refactor: move meta extraction to utils"
git commit -m "style: translate Portuguese comments to English"
git commit -m "chore: remove unused types ProcessResult and FileResult"
```

### 7.2 Formato de Commit

Usar Conventional Commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Tipos: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `test`

```bash
git commit -m "refactor(html): split processPageContent into smaller functions

- Extract optimizeCSS() helper
- Extract stripRuntimeArtifacts() helper
- Extract normalizeImages() helper
- Improves testability and maintainability

Closes #123"
```

### 7.3 PR Description Template

```markdown
## Description
What changes are made and why

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [x] Code cleanup

## Testing
How to verify the changes work

## Checklist
- [ ] Tests pass
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Types check out (tsc --noEmit)
```

---

## 8. REVIEW CHECKLIST

Antes de mergear qualquer PR:

- [ ] Comentários em inglês
- [ ] Sem código comentado
- [ ] Sem `console.log()` (usar debug)
- [ ] Sem tipos `any` injustificados
- [ ] Sem variáveis não utilizadas
- [ ] Imports agrupados e organizados
- [ ] Funções < 150 linhas (ou documentar por quê)
- [ ] Testes adicionados/atualizados
- [ ] Build sem warnings
- [ ] Lint pass

---

## 9. CONTINUOUS IMPROVEMENT

### 9.1 Métricas a Monitorar

```bash
# Linhas de código não utilizadas
npx knip --ignore-dynamic

# Cobertura de tipos
npx tsc --noEmit --listFilesOnly

# Tamanho do bundle
npm run build && du -sh dist/

# Tempo de build
time npm run build

# Imports não utilizados
npx eslint src/ --no-eslintrc --parser-options=sourceType:module
```

### 9.2 Agenda Recomendada

- **Semanal**: Review de code style durante PRs
- **Mensal**: Análise de cobertura e refactoring oportunista
- **Trimestral**: Revisão maior de arquitetura e reorganização

### 9.3 Linting Configuration

Adicionar ao `.eslintrc`:

```json
{
  "rules": {
    "no-unused-vars": "error",
    "no-undef": "error",
    "prefer-const": "error",
    "no-var": "error",
    "comma-dangle": ["error", "never"]
  }
}
```

---

## 📋 RESUMO RÁPIDO

| Aspecto | Recomendação |
|---------|-------------|
| **Idioma** | Inglês sempre (código + comentários) |
| **Headers** | JSDoc para arquivo > 30 linhas |
| **Seções** | `// ====` de 80 chars |
| **Imports** | Agrupar: stdlib, external, types, local |
| **Nomes** | Prefixos: extract*, strip*, process*, parse*, etc |
| **Tamanho arquivo** | Máx 300 linhas (featuree), 150 (utils) |
| **Funções** | Máx 150 linhas, responsabilidade única |
| **Testes** | Antes de mergear com 100% dos testes passando |
| **Commits** | Atômicos, conventional format |
| **Type Safety** | Sempre `strict`, sem `any` injustificado |

---

**Última atualização**: 2026-04-19
