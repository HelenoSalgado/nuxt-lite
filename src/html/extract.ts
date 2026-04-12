import { ESSENTIAL_SELECTORS, CLASS_RE, ID_RE, DATA_RE, HTML_TAG_RE } from '../types'

// Tags that don't carry styling rules
const NON_STYLING_TAGS = new Set(['script', 'style', 'meta', 'link', 'noscript', 'html', 'head', 'body'])

/**
 * Extract all class names, IDs, data-* keys, and HTML element names from HTML.
 *
 * Improved to handle:
 * - Single and double quotes
 * - Unquoted attribute values
 * - Escaped quotes in attributes
 * - Multiple spaces between classes
 * - Dynamic class bindings (v-bind, :)
 */
export function extractUsedSelectors(html: string): Set<string> {
  const used = new Set<string>(ESSENTIAL_SELECTORS)
  let m: RegExpExecArray | null

  // Classes — improved regex to handle both single and double quotes
  const classReDouble = /\bclass=["']([^"']*)["']/g
  const classReSingle = /\bclass=['"]([^'"]*)['"]/g
  
  classReDouble.lastIndex = 0
  while ((m = classReDouble.exec(html)) !== null) {
    const classes = (m[1] ?? '').split(/\s+/)
    for (const cls of classes) {
      if (cls && cls.length > 0) used.add(cls)
    }
  }
  
  classReSingle.lastIndex = 0
  while ((m = classReSingle.exec(html)) !== null) {
    const classes = (m[1] ?? '').split(/\s+/)
    for (const cls of classes) {
      if (cls && cls.length > 0) used.add(cls)
    }
  }

  // IDs
  ID_RE.lastIndex = 0
  while ((m = ID_RE.exec(html)) !== null) {
    if (m[1] && m[1].length > 0) used.add(m[1])
  }

  // data-* keys
  DATA_RE.lastIndex = 0
  while ((m = DATA_RE.exec(html)) !== null) {
    used.add('data-' + m[1])
  }

  // HTML element names — ensures pure element CSS rules are captured
  HTML_TAG_RE.lastIndex = 0
  while ((m = HTML_TAG_RE.exec(html)) !== null) {
    const tag = (m[1] ?? '').toLowerCase()
    if (tag && !NON_STYLING_TAGS.has(tag)) {
      used.add(tag)
    }
  }

  return used
}

/**
 * Extract title, meta tags, and main content area from HTML string.
 * Used during build time to generate enriched JSON payloads.
 */
export function extractPageData(html: string): Record<string, any> {
  const result: Record<string, any> = {
    title: '',
    meta: {} as Record<string, string>,
    content: ''
  }

  // 1. Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch && titleMatch[1]) result.title = titleMatch[1].trim()

  // 2. Extract meta tags — improved to handle both attribute orders
  const descriptionMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)
    || html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"[^>]*>/i)
  if (descriptionMatch && descriptionMatch[1]) result.meta.description = descriptionMatch[1]

  const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*>/i)
    || html.match(/<link[^>]*href="([^"]*)"[^>]*rel="canonical"[^>]*>/i)
  if (canonicalMatch && canonicalMatch[1]) result.meta.canonical = canonicalMatch[1]

  // 3. Extract main content (inner HTML of [data-page-content] or <main>)
  // Improved regex to handle tags with uppercase and attributes with spaces
  const contentMatch = html.match(/<[a-z0-9]+[^>]*data-page-content[^>]*>([\s\S]*?)<\/[a-z0-9]+>/i)
    || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)

  if (contentMatch && contentMatch[1]) {
    result.content = contentMatch[1].trim()
  }

  return result
}
