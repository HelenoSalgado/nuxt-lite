import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { CssMode, ExtendedOptions, ProcessResult, FileResult } from '../types'
import { collectAllCssFiles, removeRedundantCssFiles } from '../fs'
import { parseCssRules } from '../css/parser'
import { filterCssBySelectors } from '../css/filter'
import { extractUsedSelectors } from './extract'
import { stripExistingCss, stripVueRuntime, stripNuxtScripts } from './clean'

// ============================================================================
// Link extraction — find internal <a href="/..."> links
// ============================================================================

const HREF_RE = /<a[^>]*\bhref=["']([^"']+)["'][^>]*>/gi
const TARGET_RE = /\btarget=["'](_blank|_parent|_top)["']/i

function extractInternalLinks(html: string): Set<string> {
  const links = new Set<string>()
  let m: RegExpExecArray | null
  HREF_RE.lastIndex = 0
  while ((m = HREF_RE.exec(html)) !== null) {
    const href = m[1] ?? ''
    if (!href || href[0] !== '/') continue
    if (href.startsWith('/_nuxt') || href.startsWith('/__')) continue
    if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|mp4|webm|mp3|ogg|zip|gz|css|js)(\?.*)?$/i.test(href)) continue
    // Check for target="_blank" etc — skip external/new window links
    const fullTag = m[0]
    if (TARGET_RE.test(fullTag)) continue
    // Normalize: remove query string and trailing slash for dedup
    const normalized = href.split('?')[0].replace(/\/index$/, '').replace(/\/+$/, '') || '/'
    links.add(normalized)
  }
  return links
}

function injectPrefetchLinks(html: string, routes: Set<string>): string {
  if (routes.size === 0) return html
  let prefetchTags = ''
  for (const route of routes) {
    prefetchTags += `<link rel="prefetch" as="document" href="${route}">`
  }
  return html.replace('</head>', prefetchTags + '</head>')
}

// ============================================================================
// Main orchestration
// ============================================================================

export function processAllHtml(
  dir: string,
  options: ExtendedOptions,
  runtimeSrc: string,
): ProcessResult {
  const { _cssMode: cssMode } = options
  let cleaned = 0, cssOptimized = 0

  // Phase 1 — Collect all CSS
  const allCss = cssMode !== 'none' ? collectAllCssFiles(dir) : new Map<string, string>()

  // Phase 2 — Collect all HTML paths
  const htmlFiles: string[] = []
  function collectHtml(d: string) {
    if (!existsSync(d)) return
    for (const entry of readdirSync(d)) {
      const full = join(d, entry)
      const st = statSync(full)
      if (st.isDirectory()) { collectHtml(full); continue }
      if (entry.endsWith('.html')) htmlFiles.push(full)
    }
  }
  collectHtml(dir)

  // Phase 3 — For 'file' mode, aggregate selectors from all pages first
  const globalUsed = new Set<string>()
  if (cssMode === 'file') {
    for (const p of htmlFiles) {
      for (const sel of extractUsedSelectors(readFileSync(p, 'utf-8'))) {
        globalUsed.add(sel)
      }
    }
  }

  // Phase 4 — Pre-parse CSS once (cache for all pages)
  let cssRules: Map<string, string> | null = null
  if (cssMode !== 'none' && allCss.size > 0) {
    let combined = ''
    for (const [, content] of allCss) combined += content + ' '
    cssRules = parseCssRules(combined)
  }

  // Phase 5 — Process each HTML file
  for (const path of htmlFiles) {
    const r = processFile(path, dir, options, runtimeSrc, cssRules)
    if (r.cleaned) cleaned++
    if (r.cssOptimized) cssOptimized++
  }

  // Phase 6 — For 'file' mode, write optimized CSS and clean up
  if (cssMode === 'file' && cssRules) {
    const optimized = filterCssBySelectors(cssRules, globalUsed)
    const cssDir = join(dir, 'css')
    mkdirSync(cssDir, { recursive: true })
    const outPath = join(cssDir, 'optimized.css')
    writeFileSync(outPath, optimized, 'utf-8')
    removeRedundantCssFiles(dir, outPath)

    const originalSize = Array.from(allCss.values()).reduce((sum, c) => sum + c.length, 0)
    const newSize = optimized.length
    const reduction = originalSize > 0 ? Math.round((1 - newSize / originalSize) * 100) : 0

    console.log()
    console.log(`  ┌─ nuxt-lite ──────────────────────────────`)
    console.log(`  │`)
    console.log(`  │  ✓ CSS optimized:    ${(newSize / 1024).toFixed(1)}KB (${reduction}% smaller)`)
    console.log(`  │  ✓ Pages processed:  ${htmlFiles.length}`)
    console.log(`  │  ✓ Runtime inlined:  ${(runtimeSrc.length / 1024).toFixed(1)}KB → minified`)
    console.log(`  │`)
    console.log(`  └───────────────────────────────────────────`)
  } else if (cssMode === 'inline') {
    console.log()
    console.log(`  ┌─ nuxt-lite ──────────────────────────────`)
    console.log(`  │`)
    console.log(`  │  ✓ CSS inlined:      ${htmlFiles.length} pages`)
    console.log(`  │  ✓ Pages processed:  ${htmlFiles.length}`)
    console.log(`  │  ✓ Runtime inlined:  ${(runtimeSrc.length / 1024).toFixed(1)}KB → minified`)
    console.log(`  │`)
    console.log(`  └───────────────────────────────────────────`)
  }

  return { cleaned, cssOptimized }
}

// ============================================================================
// Single-file processor
// ============================================================================

function processFile(
  filePath: string,
  rootDir: string,
  options: ExtendedOptions,
  runtimeSrc: string,
  cachedCssRules: Map<string, string> | null,
): FileResult {
  let html = readFileSync(filePath, 'utf-8')
  let changed = false
  let cssOptimized = false

  const { _cssMode: cssMode } = options

  // --- 1. CSS optimization ---
  if (cssMode !== 'none' && cachedCssRules) {
    const used = extractUsedSelectors(html)
    const optimized = filterCssBySelectors(cachedCssRules, used)

    html = stripExistingCss(html)

    if (optimized) {
      if (cssMode === 'inline') {
        html = html.replace('</head>', `<style>${optimized}</style></head>`)
      } else {
        html = html.replace(
          '</head>',
          '<link rel="preload" href="/css/optimized.css" as="style">'
          + '<link rel="stylesheet" href="/css/optimized.css">'
          + '</head>',
        )
      }
      cssOptimized = true
    }
  }

  // --- 2. Strip Vue runtime & preload links ---
  const stripped = stripVueRuntime(html)
  if (stripped !== html) { html = stripped; changed = true }

  // --- 2b. Strip Nuxt payload + config scripts (dead weight) ---
  const noNuxt = stripNuxtScripts(html)
  if (noNuxt !== html) { html = noNuxt; changed = true }

  // --- 2c. Inject <link rel="prefetch"> for THIS page's internal links ---
  const pageLinks = extractInternalLinks(html)
  // Exclude current page path — no point prefetching itself
  const currentPath = filePath.replace(rootDir, '').replace(/\/index\.html$/, '/').replace(/\.html$/, '/') || '/'
  pageLinks.delete(currentPath)
  if (pageLinks.size > 0) {
    const withPrefetch = injectPrefetchLinks(html, pageLinks)
    if (withPrefetch !== html) { html = withPrefetch; changed = true }
  }

  // --- 3. Inject minified runtime inline (ALL pages) ---
  const minified = minifyJs(runtimeSrc)
  const scriptTag = `<script>${minified}</script>`
  if (!html.includes('window.__NUXT_LITE_RUNNING__')) {
    html = html.replace('</body>', `${scriptTag}</body>`)
    changed = true
  }

  if (changed || cssOptimized) {
    writeFileSync(filePath, html, 'utf-8')
  }

  return { cleaned: changed, cssOptimized }
}

/**
 * Safe JS minifier — removes comments and collapses to single line.
 * Does NOT touch spaces around operators (safe for any JS code).
 */
function minifyJs(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')   // multi-line comments
    .replace(/\/\/.*$/gm, '')            // single-line comments
    .replace(/\n/g, ' ')                 // newlines → space
    .replace(/\s{2,}/g, ' ')             // 2+ spaces → 1
    .trim()
}
