import { parseHTML } from 'linkedom'
import type { ExtendedOptions } from '../types'
import { extractUsedSelectors } from './extract'
import { stripExistingCss, stripVueRuntime, stripNuxtScripts } from './clean'

export interface PageProcessResult {
  html: string
  usedSelectors: Set<string>
}

/**
 * Process a single page's HTML during Nitro's prerender hook.
 * Avoids reading/writing files — works on the in-memory string.
 */
export function processPageContent(
  html: string,
  options: ExtendedOptions,
  runtimeSrc: string,
): PageProcessResult {
  const { document } = parseHTML(html)
  const { _cssMode: cssMode, safelist = [] } = options

  // 1. Extract used selectors BEFORE stripping CSS/Scripts to be safe
  const usedSelectors = extractUsedSelectors(html, safelist)

  // 2. CSS optimization
  if (cssMode !== 'none') {
    stripExistingCss(document)
    
    // In 'file' mode, we can already inject the link to the optimized file
    if (cssMode === 'file') {
      const preload = document.createElement('link')
      preload.as = 'style'
      preload.rel = 'preload'
      preload.href = '/css/optimized.css'
      document.head.prepend(preload)

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/css/optimized.css'
      document.head.appendChild(link)
    }
  }

  // 3. Strip Vue runtime & preload links
  stripVueRuntime(document)

  // 4. Strip Nuxt artifacts + unwrap
  stripNuxtScripts(document)

  // 5. Inject runtime
  const scriptEl = document.createElement('script')
  scriptEl.src = '/lite.js'
  scriptEl.defer = true
  document.body.appendChild(scriptEl)

  let finalHtml = document.toString()
  
  // Restore: Critical SSR comment cleaning
  finalHtml = finalHtml
    .replace(/<!--\[--\]-->/g, '')
    .replace(/<!--\[-->/g, '')
    .replace(/<!--\]-->/g, '')
    .replace(/<!---->/g, '')
    .replace(/<!--\s*-->/g, '')

  return {
    html: finalHtml,
    usedSelectors
  }
}
