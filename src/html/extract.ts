/**
 * extract.ts — Extractor for used HTML selectors
 *
 * Provides functionalities to parse HTML and retrieve all
 * classes, IDs, and tags used, helping to filter CSS.
 */

// ============================================================================
// External dependencies
// ============================================================================
import { parseHTML } from 'linkedom'

// ============================================================================
// Local imports
// ============================================================================
import { ESSENTIAL_SELECTORS } from '../types'

// ============================================================================
// Extraction Methods
// ============================================================================

/**
 * Extract all class names, IDs, and HTML element names from HTML using linkedom.
 */
export function extractUsedSelectors(
  html: string,
  safelist: string[] = [],
  excludeSelector?: string,
): Set<string> {
  const used = new Set<string>(ESSENTIAL_SELECTORS)
  safelist.forEach(s => used.add(s))

  const { document } = parseHTML(html)

  // If excluding, we clone or modify to avoid affecting the original logic
  // but for extraction we can just avoid visiting those branches.
  const excludeEl = excludeSelector ? document.querySelector(excludeSelector) : null

  const allElements = document.querySelectorAll('*')

  allElements.forEach((el: any) => {
    // Check if this element is inside the excluded area
    if (excludeEl && excludeEl.contains(el)) {
      // Still add the tag name of the excluded container itself, but skip its children
      if (el === excludeEl) used.add(el.tagName.toLowerCase())
      return
    }

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
