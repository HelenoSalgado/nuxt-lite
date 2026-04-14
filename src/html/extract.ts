import { parseHTML } from 'linkedom'
import { ESSENTIAL_SELECTORS } from '../types'

/**
 * Extract all class names, IDs, and HTML element names from HTML using linkedom.
 */
export function extractUsedSelectors(html: string, safelist: string[] = []): Set<string> {
  const used = new Set<string>(ESSENTIAL_SELECTORS)
  safelist.forEach(s => used.add(s))

  const { document } = parseHTML(html)
  const allElements = document.querySelectorAll('*')

  allElements.forEach((el: any) => {
    // Tag name
    used.add(el.tagName.toLowerCase())

    // Classes
    if (el.classList.length > 0) {
      el.classList.forEach((cls: string) => used.add(cls))
    }

    // ID
    if (el.id) {
      used.add(el.id)
    }

    // Data attributes
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-')) {
        used.add(attr.name)
      }
    }
  })

  return used
}
