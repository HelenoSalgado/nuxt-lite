import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { CssMode, ExtendedOptions, ProcessResult, FileResult } from '../types'
import { collectAllCssFiles, removeRedundantCssFiles } from '../fs'
import { parseCssRules } from '../css/parser'
import { filterCssBySelectors } from '../css/filter'
import { extractUsedSelectors } from './extract'
import { stripExistingCss, stripVueRuntime, extractPayload } from './clean'

// ============================================================================
// Main orchestration
// ============================================================================

export function processAllHtml(
  dir: string,
  options: ExtendedOptions,
  runtimeSrc: string,
): ProcessResult {
  const { _cssMode: cssMode } = options
  let cleaned = 0, payloads = 0, cssOptimized = 0

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
    if (r.payload) payloads++
    if (r.cssOptimized) cssOptimized++
  }

  // Phase 6 — For 'file' mode, write optimized CSS and clean up
  if (cssMode === 'file' && cssRules) {
    const optimized = filterCssBySelectors(cssRules, globalUsed)
    const cssDir = join(dir, 'css')
    mkdirSync(cssDir, { recursive: true })
    const outPath = join(cssDir, 'optimized.css')
    writeFileSync(outPath, optimized, 'utf-8')
    console.log(`[nuxt-lite] Wrote /css/optimized.css (${(optimized.length / 1024).toFixed(1)}KB)`)
    removeRedundantCssFiles(dir, outPath)
  }

  return { cleaned, payloads, cssOptimized }
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
  let hasPayload = false
  let cssOptimized = false

  const { _cssMode: cssMode } = options

  // --- 1. Extract payload ---
  const payload = extractPayload(html)
  if (payload !== null) {
    const pagePath = filePath.replace(/\/index\.html$/, '').replace(/\.html$/, '')
    mkdirSync(dirname(join(pagePath, 'payload.json')), { recursive: true })
    writeFileSync(join(pagePath, 'payload.json'), payload)
    hasPayload = true
  }

  // --- 2. CSS optimization ---
  if (cssMode !== 'none' && cachedCssRules) {
    const used = extractUsedSelectors(html)
    const optimized = filterCssBySelectors(cachedCssRules, used)

    html = stripExistingCss(html)

    if (optimized) {
      if (cssMode === 'inline') {
        html = html.replace('</head>', `<style>${optimized}</style></head>`)
      } else {
        // file mode: preload + stylesheet
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

  // --- 3. Strip Vue runtime & preload links ---
  const stripped = stripVueRuntime(html)
  if (stripped !== html) { html = stripped; changed = true }

  // --- 4. Inject lite runtime ---
  const withRuntime = html.replace('</body>', `<script type="module">\n${runtimeSrc}\n</script>\n</body>`)
  if (withRuntime !== html) { html = withRuntime; changed = true }

  if (changed || hasPayload || cssOptimized) {
    writeFileSync(filePath, html, 'utf-8')
  }

  return { cleaned: changed, payload: hasPayload, cssOptimized }
}
