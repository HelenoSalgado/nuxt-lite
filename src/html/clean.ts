/**
 * clean.ts — HTML cleaning and attribute normalization
 *
 * Provides functions to strip Vue/Nuxt runtime artifacts,
 * remove obsolete attributes, and normalize HTML output
 * for optimized production builds.
 */

// ============================================================================
// External dependencies
// ============================================================================
import { parseHTML } from 'linkedom'

// ============================================================================
// CSS Cleanup
// ============================================================================

/**
 * Remove stylesheet links and existing <style> tags using linkedom.
 */
export function stripExistingCss(document: Document): void {
  const links = document.querySelectorAll('link[rel="stylesheet"]')
  links.forEach(el => el.remove())

  const styles = document.querySelectorAll('style')
  styles.forEach(el => el.remove())
}

/**
 * Remove Vue runtime scripts and preload/prefetch links using linkedom.
 */
export function stripVueRuntime(document: Document, buildAssetsDir: string = '/_nuxt/'): void {
  const assetsDir = buildAssetsDir.startsWith('/') ? buildAssetsDir : `/${buildAssetsDir}`
  const assetsPattern = assetsDir.endsWith('/') ? assetsDir : `${assetsDir}/`

  // Remove Vue runtime scripts
  const scripts = document.querySelectorAll(`script[type="module"][src*="${assetsPattern}"]`)
  scripts.forEach(el => el.remove())

  // Remove modulepreload and prefetch links
  const preloads = document.querySelectorAll(`
    link[rel="modulepreload"], 
    link[rel="preload"][href*="${assetsPattern}"], 
    link[rel="prefetch"][href*="${assetsPattern}"],
    link[rel="preload"][href*="_payload.json"],
    link[rel="prefetch"][href*="_payload.json"],
    link[rel="preload"][as="fetch"]
  `)
  preloads.forEach(el => el.remove())
}

/**
 * Remove data-v attributes and optionally convert to short classes.
 * Only converts if the hash is present in the provided mapping.
 */
export function stripDataVAttributes(document: Document, mapping?: Map<string, string>): void {
  const elements = document.querySelectorAll('*')
  elements.forEach((el) => {
    const attrs = Array.from(el.attributes)
    attrs.forEach((attr) => {
      if (attr.name.startsWith('data-v-')) {
        if (mapping) {
          const hash = attr.name.replace('data-v-', '')
          if (mapping.has(hash)) {
            el.classList.add(mapping.get(hash)!)
          }
        }
        el.removeAttribute(attr.name)
      }
    })
  })
}

/**
 * Remove Nuxt artifacts and unwrap the __nuxt container.
 */
export function stripNuxtScripts(document: Document): void {
  // Remove __NUXT_DATA__, __NUXT_CONFIG__, and inline scripts
  const scripts = document.querySelectorAll('script')
  scripts.forEach((el) => {
    const id = el.id || ''
    const text = el.textContent || ''
    const hasDataAttr = el.hasAttribute('data-nuxt-data')

    if (id === '__NUXT_DATA__' || hasDataAttr || text.includes('window.__NUXT__') || text.includes('__NUXT_DATA__')) {
      el.remove()
    }
  })

  // Remove teleport containers
  const teleports = document.querySelector('div#teleports')
  if (teleports) teleports.remove()

  // Unwrap <div id="__nuxt">
  const nuxtDiv = document.querySelector('div#__nuxt')
  if (nuxtDiv) {
    // Replace the div with its children
    const parent = nuxtDiv.parentNode
    if (parent) {
      while (nuxtDiv.firstChild) {
        parent.insertBefore(nuxtDiv.firstChild, nuxtDiv)
      }
      nuxtDiv.remove()
    }
  }
}
