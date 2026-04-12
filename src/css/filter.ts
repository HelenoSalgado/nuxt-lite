import { PRESERVE_AT_RULE_RE } from '../types'

/**
 * Filter parsed CSS rules to only those matching used selectors.
 * Returns minified CSS (single line, no extra whitespace).
 */
export function filterCssBySelectors(
  rules: Map<string, string>,
  used: ReadonlySet<string>,
): string {
  const kept: string[] = []
  const keptMedia = new Map<string, Set<string>>()
  const seenBlocks = new Set<string>()

  for (const [selector, block] of rules) {
    // @media-wrapped selectors
    if (selector.startsWith('@media|')) {
      const parts = selector.split('|')
      const atRule = parts[1] ?? ''
      const innerSel = parts.slice(2).join('|')
      if (innerSel && selectorMatches(innerSel, used)) {
        if (!keptMedia.has(atRule)) keptMedia.set(atRule, new Set())
        // Keep the full rule block (selector + declarations) as-is
        keptMedia.get(atRule)!.add(block)
      }
      continue
    }

    // Preserve @font-face, @keyframes, etc. entirely
    if (selector.startsWith('@') && PRESERVE_AT_RULE_RE.test(selector)) {
      if (!seenBlocks.has(block)) {
        seenBlocks.add(block)
        kept.push(block)
      }
      continue
    }

    // Other at-rules (like raw @media) — keep once
    if (selector.startsWith('@')) {
      if (!seenBlocks.has(block)) {
        seenBlocks.add(block)
        kept.push(block)
      }
      continue
    }

    // Regular selector — keep if it matches
    if (selectorMatches(selector, used)) {
      kept.push(block)
    }
  }

  // Rebuild @media blocks from matching inner selectors
  for (const [atRule, innerBlocks] of keptMedia) {
    kept.push(atRule + '{' + Array.from(innerBlocks).join('') + '}')
  }

  return kept.join('')
}

/**
 * Fast selector matching using Set lookups.
 * Splits compound selectors and checks each part against the used set.
 */
function selectorMatches(selector: string, used: ReadonlySet<string>): boolean {
  const parts = selector.split(',').map(s => s.trim())

  for (const part of parts) {
    if (part === '*' || part.includes('*')) return true
    if (part === ':root' || part === '.dark') return true
    if (used.has(part)) return true

    // Extract class names: .foo, .foo:hover, .foo.bar
    const classMatches = part.match(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
    if (classMatches) {
      for (const raw of classMatches) {
        const cls = raw.slice(1)
        const base = cls.split(':')[0]
        if (used.has(cls) || (base && used.has(base))) return true
      }
    }

    // Extract IDs: #foo
    const idMatches = part.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
    if (idMatches) {
      for (const raw of idMatches) {
        const id = raw.slice(1)
        if (id && used.has(id)) return true
      }
    }

    // Extract element name: div, span, etc.
    const elemMatch = part.match(/^([a-zA-Z][a-zA-Z0-9]*)/)
    if (elemMatch && elemMatch[1] && used.has(elemMatch[1])) return true
  }

  return false
}
