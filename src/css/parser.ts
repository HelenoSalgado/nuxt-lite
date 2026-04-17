import { CSS_COMMENT_RE, CSS_WS_RE, SKIP_AT_RULE_RE } from '../types'

/**
 * Parse a CSS string into a Map<selector, fullRule>.
 * Uses brace-counting to correctly handle nested @media blocks.
 * Also normalizes relative URLs to absolute paths.
 */
export function parseCssRules(css: string): Map<string, string> {
  const rules = new Map<string, string>()
  const seenAtRules = new Set<string>()

  // Normalize URLs: convert relative paths to absolute paths
  // Matches url("fonts/...") or url("../fonts/...") but ignores data:, http://, and already absolute paths /
  const clean = css
    .replace(/url\(['"]?([^'"]+)['"]?\)/g, (match, url) => {
      if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('/')) {
        return match
      }
      // Remove any leading ./ or ../ and make it absolute
      const absoluteUrl = '/' + url.replace(/^(\.\.?\/)+/, '')
      return `url("${absoluteUrl}")`
    })
    .replace(CSS_COMMENT_RE, '')
    .replace(CSS_WS_RE, ' ')

  let i = 0
  while (i < clean.length) {
    while (i < clean.length && CSS_WS_RE.test(clean[i] || '')) i++
    if (i >= clean.length) break

    const braceStart = clean.indexOf('{', i)
    if (braceStart === -1) break

    const selector = clean.slice(i, braceStart).trim()
    if (!selector || SKIP_AT_RULE_RE.test(selector)) {
      i = braceStart + 1
      continue
    }

    // Find matching closing brace
    let depth = 1
    let j = braceStart + 1
    while (j < clean.length && depth > 0) {
      if (clean[j] === '{') depth++
      else if (clean[j] === '}') depth--
      j++
    }

    const block = clean.slice(braceStart, j).trim()

    if (selector.startsWith('@')) {
      if (selector.startsWith('@media') || selector.startsWith('@supports') || selector.startsWith('@container')) {
        // Extract inner selectors for matching, skip raw unoptimized block
        const inner = block.slice(1, -1).trim()
        extractInnerSelectors(inner, selector, rules)
      }
      else {
        // Flat at-rules (@font-face, @keyframes): keep with unique key to prevent loss
        const key = selector + '|' + block
        if (!seenAtRules.has(key)) {
          seenAtRules.add(key)
          rules.set(key, selector + ' ' + block)
        }
      }
    }
    else {
      rules.set(selector, selector + ' ' + block)
    }

    i = j
  }

  return rules
}

/** Extract inner selectors from a @media block and store them with context */
function extractInnerSelectors(inner: string, atRule: string, rules: Map<string, string>) {
  let i = 0
  while (i < inner.length) {
    while (i < inner.length && CSS_WS_RE.test(inner[i] || '')) i++
    if (i >= inner.length) break

    const braceStart = inner.indexOf('{', i)
    if (braceStart === -1) break

    const sel = inner.slice(i, braceStart).trim()
    if (!sel) {
      i = braceStart + 1
      continue
    }

    let depth = 1
    let j = braceStart + 1
    while (j < inner.length && depth > 0) {
      if (inner[j] === '{') depth++
      else if (inner[j] === '}') depth--
      j++
    }

    const block = inner.slice(braceStart, j).trim()
    rules.set(`@media|${atRule}|${sel}`, atRule + '{' + sel + block + '}')
    i = j
  }
}
