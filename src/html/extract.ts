import { parseHTML } from 'linkedom'
import { ESSENTIAL_SELECTORS } from '../types'

/**
 * Result of selector extraction, split by layout and page content.
 */
export interface ExtractedSelectors {
  layout: Set<string>
  page: Set<string>
}

/**
 * Extract all class names, IDs, and HTML element names from HTML using linkedom,
 * splitting them between layout (outside <main>) and page (inside <main>).
 */
export function extractUsedSelectors(html: string, safelist: string[] = []): ExtractedSelectors {
  const layout = new Set<string>(ESSENTIAL_SELECTORS)
  const page = new Set<string>()
  
  safelist.forEach(s => layout.add(s))

  const { document } = parseHTML(html)
  
  // Find the main content area
  const main = document.querySelector('main') || document.querySelector('[data-page-content]')
  
  const allElements = document.querySelectorAll('*')

  allElements.forEach((el: any) => {
    // Determine if this element is inside the main content
    const isInsideMain = main ? main.contains(el) : false
    const targetSet = isInsideMain ? page : layout

    // Tag name
    targetSet.add(el.tagName.toLowerCase())

    // Classes
    if (el.classList.length > 0) {
      el.classList.forEach((cls: string) => targetSet.add(cls))
    }

    // ID
    if (el.id) {
      targetSet.add(el.id)
    }

    // Data attributes
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-')) {
        targetSet.add(attr.name)
      }
    }
  })

  return { layout, page }
}
