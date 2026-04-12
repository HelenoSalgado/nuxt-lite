import { ESSENTIAL_SELECTORS, CLASS_RE, ID_RE, DATA_RE, HTML_TAG_RE } from '../types'

// Tags that don't carry styling rules
const NON_STYLING_TAGS = new Set(['script', 'style', 'meta', 'link', 'noscript', 'html', 'head', 'body'])

/**
 * Extract all class names, IDs, data-* keys, and HTML element names from HTML.
 */
export function extractUsedSelectors(html: string): Set<string> {
  const used = new Set<string>(ESSENTIAL_SELECTORS)
  let m: RegExpExecArray | null

  // Classes — single regex handles both quote types
  const classRe = /\bclass=["']([^"']*)["']/g
  classRe.lastIndex = 0
  while ((m = classRe.exec(html)) !== null) {
    for (const cls of (m[1] ?? '').split(/\s+/)) {
      if (cls) used.add(cls)
    }
  }

  // IDs
  ID_RE.lastIndex = 0
  while ((m = ID_RE.exec(html)) !== null) {
    if (m[1]) used.add(m[1])
  }

  // data-* keys
  DATA_RE.lastIndex = 0
  while ((m = DATA_RE.exec(html)) !== null) {
    used.add('data-' + m[1])
  }

  // HTML element names
  HTML_TAG_RE.lastIndex = 0
  while ((m = HTML_TAG_RE.exec(html)) !== null) {
    const tag = (m[1] ?? '').toLowerCase()
    if (tag && !NON_STYLING_TAGS.has(tag)) used.add(tag)
  }

  return used
}
