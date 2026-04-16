import { parseHTML } from 'linkedom'
import type { ExtendedOptions } from '../types'
import { extractUsedSelectors } from './extract'
import { stripExistingCss, stripVueRuntime, stripNuxtScripts } from './clean'
import { processSvgs, generateSpriteContainer, SvgSymbol } from './svg'
import { generateColorModeScript } from './color'

export interface PageProcessResult {
  html: string
  usedSelectors: Set<string>
  symbols?: Map<string, SvgSymbol>
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
  const { _cssMode: cssMode, safelist = [], _svgResolved: svgConfig } = options

  // 1. Extract used selectors BEFORE stripping CSS/Scripts to be safe
  const usedSelectors = extractUsedSelectors(html, safelist)

  // 2. CSS optimization
  if (cssMode !== 'none') {
    stripExistingCss(document)

    // In 'file' mode, we can already inject the link to the optimized file
    if (cssMode === 'file') {
      const preload = document.createElement('link')
      preload.setAttribute('rel', 'preload')
      preload.setAttribute('as', 'style')
      preload.setAttribute('href', '/css/optimized.css')
      document.head.prepend(preload)

      const link = document.createElement('link')
      link.setAttribute('rel', 'stylesheet')
      link.setAttribute('href', '/css/optimized.css')
      document.head.appendChild(link)
    }
  }

  // 3. Strip Vue runtime & preload links
  stripVueRuntime(document)

  // 4. Strip Nuxt artifacts + unwrap
  stripNuxtScripts(document)

  // 4b. Inject Lightweight Color Mode
  if (options._colorResolved.enabled) {
    const colorModeScriptStr = generateColorModeScript(options._colorResolved)
    const colorScriptEl = document.createElement('script')
    colorScriptEl.textContent = colorModeScriptStr
    // Inserir no topo do head para evitar FOUC
    document.head.prepend(colorScriptEl)
  }

  // 4c. Normalize Images (strip Nuxt Image artifacts)
  const images = document.querySelectorAll('img')
  images.forEach(img => {
    img.removeAttribute('data-nuxt-img')
    img.removeAttribute('onerror')
    // Se quiser remover os wrappers do IPX em ambiente estático, aqui seria o lugar
    // mas por enquanto apenas limpamos atributos indesejados
  })

  // 5. Inject runtime
  const scriptEl = document.createElement('script')
  scriptEl.src = '/lite.js'
  scriptEl.defer = true
  document.body.appendChild(scriptEl)

  let finalHtml = document.toString()

  // 6. SVG Optimization (Regex based)
  let pageSymbols: Map<string, SvgSymbol> | undefined
  if (svgConfig.enabled) {
    const { html: optimizedHtml, symbols } = processSvgs(finalHtml, svgConfig.minOccurrences)
    finalHtml = optimizedHtml
    pageSymbols = symbols
  }

  // Restore: Critical SSR comment cleaning
  finalHtml = finalHtml
    .replace(/<!--\[--\]-->/g, '')
    .replace(/<!--\[-->/g, '')
    .replace(/<!--\]-->/g, '')
    .replace(/<!---->/g, '')
    .replace(/<!--\s*-->/g, '')

  return {
    html: finalHtml,
    usedSelectors,
    symbols: pageSymbols
  }
}
