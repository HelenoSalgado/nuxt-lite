import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { CssMode, ExtendedOptions, ProcessResult, FileResult } from '../types'
import { collectAllCssFiles, removeRedundantCssFiles } from '../fs'
import { parseCssRules } from '../css/parser'
import { filterCssBySelectors } from '../css/filter'
import { extractUsedSelectors } from './extract'
import { stripExistingCss, stripVueRuntime } from './clean'

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

  // Write runtime as a global JS file (loaded by ALL pages)
  const jsDir = join(dir, 'js')
  mkdirSync(jsDir, { recursive: true })
  writeFileSync(join(jsDir, 'nuxt-lite.js'), runtimeSrc, 'utf-8')

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
    console.log(`  │  ✓ Runtime:          /js/nuxt-lite.js (${(runtimeSrc.length / 1024).toFixed(1)}KB)`)
    console.log(`  │`)
    console.log(`  └───────────────────────────────────────────`)
  } else if (cssMode === 'inline') {
    console.log()
    console.log(`  ┌─ nuxt-lite ──────────────────────────────`)
    console.log(`  │`)
    console.log(`  │  ✓ CSS inlined:      ${htmlFiles.length} pages`)
    console.log(`  │  ✓ Pages processed:  ${htmlFiles.length}`)
    console.log(`  │  ✓ Runtime:          /js/nuxt-lite.js (${(runtimeSrc.length / 1024).toFixed(1)}KB)`)
    console.log(`  │`)
    console.log(`  └───────────────────────────────────────────`)
  }

  return { cleaned, payloads: 0, cssOptimized }
}

// ============================================================================
// Single-file processor
// ============================================================================

function processFile(
  filePath: string,
  rootDir: string,
  options: ExtendedOptions,
  _runtimeSrc: string,
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

  // --- 3. Inject global runtime script (ALL pages) ---
  const scriptTag = '<script src="/js/nuxt-lite.js" type="module" defer></script>'
  if (!html.includes('/js/nuxt-lite.js')) {
    html = html.replace('</body>', `${scriptTag}\n</body>`)
    changed = true
  }

  if (changed || cssOptimized) {
    writeFileSync(filePath, html, 'utf-8')
  }

  return { cleaned: changed, payload: false, cssOptimized }
}
