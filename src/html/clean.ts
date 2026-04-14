import { parseHTML } from 'linkedom'

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
export function stripVueRuntime(document: Document): void {
  // Remove Vue runtime scripts
  const scripts = document.querySelectorAll('script[type="module"][src*="/_nuxt/"]')
  scripts.forEach(el => el.remove())

  // Remove modulepreload and prefetch links
  const preloads = document.querySelectorAll('link[rel="modulepreload"], link[rel="preload"][href*="/_nuxt/"], link[rel="prefetch"][href*="/_nuxt/"]')
  preloads.forEach(el => el.remove())
}

/**
 * Remove Nuxt artifacts and unwrap the __nuxt container.
 */
export function stripNuxtScripts(document: Document): void {
  // Remove __NUXT_DATA__, __NUXT_CONFIG__, and inline scripts
  const scripts = document.querySelectorAll('script')
  scripts.forEach(el => {
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

  // Remove Vue SSR comment markers
  // linkedom might not fully support comment selection via querySelector, 
  // we might need a tree walker or regex for final cleanup of comments if needed.
}
