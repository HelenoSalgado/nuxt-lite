/**
 * process.ts — HTML processing coordinator
 *
 * Orchestrates the cleanup, extraction, and transformation of HTML,
 * coordinating SVG processing, color mode injection, and script removal.
 */

// ============================================================================
// External dependencies
// ============================================================================
import { parseHTML } from 'linkedom'
import type { Document } from 'linkedom'

// ============================================================================
// Type imports
// ============================================================================
import type { ColorModeOptions, ExtendedOptions } from '../types'
import type { SvgSymbol } from './svg'

// ============================================================================
// Local imports
// ============================================================================
import { stripExistingCss, stripNuxtScripts, stripVueRuntime } from './clean'
import { generateColorModeScript } from './color'
import { extractUsedSelectors } from './extract'
import { processSvgs } from './svg'

export interface PageProcessResult {
  html: string
  usedSelectors: Set<string>
  symbols?: Map<string, SvgSymbol>
}

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process a single page's HTML during Nitro's prerender hook.
 * Avoids reading/writing files — works on the in-memory string.
 */
export function processPageContent(
  html: string,
  options: ExtendedOptions,
  _runtimeSrc: string,
): PageProcessResult {
  const { document } = parseHTML(html)
  const { optimizeCss, safelist = [], _svgResolved: svgConfig } = options

  // 1. Extract used selectors BEFORE stripping CSS/Scripts to be safe
  const usedSelectors = extractUsedSelectors(html, safelist)

  // 2. CSS optimization
  if (optimizeCss) {
    stripExistingCss(document)
  }

  // 3 & 4. Strip runtime artifacts
  stripRuntimeArtifacts(document, options._buildAssetsDir)

  // 4b. Inject Lightweight Color Mode
  if (options._colorResolved.enabled) {
    injectColorMode(document, options._colorResolved)
  }

  // 4c. Normalize Images & Remove Redundant Preloads
  normalizeImages(document)

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

  // 7. Final SSR Comment Cleanup
  finalHtml = cleanSSRComments(finalHtml)

  return {
    html: finalHtml,
    usedSelectors,
    symbols: pageSymbols,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function stripRuntimeArtifacts(
  document: Document,
  buildAssetsDir: string,
  _dataVMapping?: Map<string, string>,
): void {
  // Strip Vue runtime & preload links
  stripVueRuntime(document, buildAssetsDir)

  // Strip Nuxt artifacts + unwrap
  stripNuxtScripts(document)

  // TODO: Add stripDataVAttributes call if needed. Not currently implemented in clean.ts.
}

function injectColorMode(document: Document, colorOptions: ColorModeOptions): void {
  const colorModeScriptStr = generateColorModeScript(colorOptions)
  const colorScriptEl = document.createElement('script')
  colorScriptEl.textContent = colorModeScriptStr
  // Insert at top of head to prevent FOUC
  document.head.prepend(colorScriptEl)
}

function normalizeImages(document: Document): void {
  const imagePreloads = document.querySelectorAll('link[rel="preload"][as="image"]')
  imagePreloads.forEach(l => l.remove())

  const images = document.querySelectorAll('img')
  images.forEach((img) => {
    img.removeAttribute('data-nuxt-img')
    img.removeAttribute('onerror')

    const src = img.getAttribute('src') || ''
    const srcset = img.getAttribute('srcset') || ''

    if (srcset && src) {
      // If srcset is just the src repeated or if it contains redundant duplicates, simplify to just src.
      const firstSrcSet = srcset.split(',')[0]!.split(' ')[0]!.trim()
      if (firstSrcSet === src && !srcset.includes(',')) {
        img.removeAttribute('srcset')
      }
      else if (srcset.includes(src)) {
        const parts = srcset.split(',').map(p => p.trim().split(' ')[0]!)
        if (parts.length > 0 && parts.every(p => p === src)) {
          img.removeAttribute('srcset')
        }
      }
    }
  })
}

function cleanSSRComments(html: string): string {
  // Remove empty Vue SSR comments
  return html.replace(/<!---->/g, '')
}
