/**
 * filter.ts — CSS filtering and mapping
 *
 * Provides functions to filter CSS rules based on used selectors,
 * removing unused styles and applying short-hash data-v mappings.
 */

// ============================================================================
// Local imports
// ============================================================================
import { PRESERVE_AT_RULE_RE } from '../types'

// ============================================================================
// CSS Filtering Methods
// ============================================================================

/**
 * Filter parsed CSS rules to only those matching used selectors.
 * Returns a Map of matched rules.
 */
export function filterCssToMap(
  rules: Map<string, string>,
  used: ReadonlySet<string>,
  dataVMapping?: Map<string, string>,
): Map<string, string> {
  const matched = new Map<string, string>()
  const effectiveUsed = new Set(used)

  if (dataVMapping && dataVMapping.size > 0) {
    for (const [hash, short] of dataVMapping) {
      if (used.has(`data-v-${hash}`)) {
        effectiveUsed.add(short)
      }
    }
  }

  for (let [selector, block] of rules) {
    // Apply data-v mapping if provided
    if (dataVMapping && dataVMapping.size > 0) {
      for (const [hash, short] of dataVMapping) {
        const attrSelector = `[data-v-${hash}]`
        if (selector.includes(attrSelector)) {
          selector = selector.split(attrSelector).join(`.${short}`)
          block = block.split(attrSelector).join(`.${short}`)
        }
      }
    }

    // @media-wrapped selectors
    if (selector.startsWith('@media|')) {
      const parts = selector.split('|')
      const atRule = parts[1] ?? ''
      const innerSel = parts.slice(2).join('|')
      if (innerSel && selectorMatches(innerSel, effectiveUsed)) {
        // We use a combined key for media rules to allow subtraction
        matched.set(selector, block)
      }
      continue
    }

    // Preserve @font-face, @keyframes, etc. entirely
    if (selector.startsWith('@') && PRESERVE_AT_RULE_RE.test(selector)) {
      matched.set(selector, block)
      continue
    }

    // Skip raw @media blocks — they are handled via @media| prefixed rules
    if (selector.startsWith('@media')) {
      continue
    }

    // Other at-rules (like raw @supports) — keep once
    if (selector.startsWith('@')) {
      matched.set(selector, block)
      continue
    }

    // Regular selector — keep if it matches
    if (selectorMatches(selector, effectiveUsed)) {
      matched.set(selector, block)
    }
  }

  return matched
}

/**
 * Convert a Map of rules back to a minified CSS string.
 */
export function rulesMapToCss(rules: Map<string, string>): string {
  const kept: string[] = []
  const keptMedia = new Map<string, Set<string>>()
  const seenBlocks = new Set<string>()

  for (const [selector, block] of rules) {
    if (selector.startsWith('@media|')) {
      const parts = selector.split('|')
      const atRule = parts[1] ?? ''
      if (!keptMedia.has(atRule)) keptMedia.set(atRule, new Set())
      keptMedia.get(atRule)!.add(block)
      continue
    }

    if (!seenBlocks.has(block)) {
      seenBlocks.add(block)
      kept.push(block)
    }
  }

  // Rebuild @media blocks
  for (const [atRule, innerBlocks] of keptMedia) {
    kept.push(atRule + '{' + Array.from(innerBlocks).join('') + '}')
  }

  return kept.join('')
}

/**
 * Filter parsed CSS rules to only those matching used selectors.
 * Returns minified CSS (single line, no extra whitespace).
 */
export function filterCssBySelectors(
  rules: Map<string, string>,
  used: ReadonlySet<string>,
  dataVMapping?: Map<string, string>,
): string {
  const matchedMap = filterCssToMap(rules, used, dataVMapping)
  return rulesMapToCss(matchedMap)
}

/**
 * Fast selector matching using Set lookups.
 * Checks if all components of a compound selector are present in the used set.
 */
function selectorMatches(selector: string, used: ReadonlySet<string>): boolean {
  const parts = selector.split(',').map(s => s.trim())

  for (const part of parts) {
    if (part === '*' || part.includes('*')) return true
    if (part === ':root' || part === '.dark') return true
    if (used.has(part)) return true

    // Split by combinators: space, >, +, ~
    const simpleSelectors = part.split(/[\s>+~]+/)
    let allSimpleMatch = true

    for (const simple of simpleSelectors) {
      if (!simple || simple.startsWith(':')) continue

      let matchedAny = false
      let hasComponent = false

      // 1. Check classes
      const classMatches = simple.match(/\.([a-z_-][\w-]*)/gi)
      if (classMatches) {
        hasComponent = true
        for (const raw of classMatches) {
          if (!used.has(raw.slice(1))) {
            allSimpleMatch = false
            break
          }
          matchedAny = true
        }
      }
      if (!allSimpleMatch) break

      // 2. Check IDs
      const idMatches = simple.match(/#([a-z_-][\w-]*)/gi)
      if (idMatches) {
        hasComponent = true
        for (const raw of idMatches) {
          if (!used.has(raw.slice(1))) {
            allSimpleMatch = false
            break
          }
          matchedAny = true
        }
      }
      if (!allSimpleMatch) break

      // 3. Check attribute selectors: [data-v-xxxx], [type="text"]
      const attrMatches = simple.match(/\[([\w-]+)/g)
      if (attrMatches) {
        hasComponent = true
        for (const raw of attrMatches) {
          const attrName = raw.slice(1)
          if (!used.has(attrName)) {
            allSimpleMatch = false
            break
          }
          matchedAny = true
        }
      }
      if (!allSimpleMatch) break

      // 4. Check element tags: div, span, etc.
      const elemMatch = simple.match(/^([a-z][a-z0-9]*)/i)
      if (elemMatch) {
        hasComponent = true
        const tag = elemMatch[1].toLowerCase()
        if (!used.has(tag)) {
          allSimpleMatch = false
          break
        }
        matchedAny = true
      }

      if (hasComponent && !matchedAny) {
        allSimpleMatch = false
        break
      }
    }

    if (allSimpleMatch) return true
  }

  return false
}
