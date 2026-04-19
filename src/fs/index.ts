/**
 * index.ts — File system operations and cleanup
 *
 * Provides utilities to collect CSS files, remove redundant ones,
 * and prune Nuxt/Vue artifacts to clean up the final output.
 */

// ============================================================================
// Node stdlib
// ============================================================================
import { existsSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs'
import { join, relative } from 'node:path'

// ============================================================================
// Local imports
// ============================================================================
import { SKIP_CSS_FILES } from '../types'

// ============================================================================
// FS Utilities
// ============================================================================

/** Collect all .css files from the build output, keyed by their href path */
export function collectAllCssFiles(rootDir: string): Map<string, string> {
  const content = new Map<string, string>()

  function walk(dir: string) {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.endsWith('.css') || SKIP_CSS_FILES.includes(entry)) continue
      const href = '/' + relative(rootDir, full).replace(/\\/g, '/')
      try {
        content.set(href, readFileSync(full, 'utf-8'))
      }
      catch { /* skip unreadable files */ }
    }
  }

  walk(rootDir)
  return content
}

/** Remove all .css files except the optimized output */
export function removeRedundantCssFiles(rootDir: string, keepPath: string): string[] {
  const keepRel = relative(rootDir, keepPath).replace(/\\/g, '/')
  const removed: string[] = []

  function walk(dir: string) {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.endsWith('.css')) continue
      const rel = relative(rootDir, full).replace(/\\/g, '/')
      if (rel === keepRel) continue
      try {
        unlinkSync(full)
        removed.push(rel)
      }
      catch { /* skip */ }
    }
  }

  walk(rootDir)
  return removed
}

/** Remove unused Nuxt/Vue artifacts (.js, .map, manifest.json, content dumps, compressed files) */
export function pruneNuxtArtifacts(outputDir: string): string[] {
  const removed: string[] = []

  // 1. Cleanup specific directories
  const dirsToPrune = ['_nuxt/builds', '__nuxt_content']
  for (const d of dirsToPrune) {
    const full = join(outputDir, d)
    if (existsSync(full)) {
      try {
        rmSync(full, { recursive: true, force: true })
        removed.push(d)
      }
      catch { /* skip */ }
    }
  }

  // 2. Cleanup root files and recursive pruning
  function walk(dir: string) {
    if (!existsSync(dir)) return
    const entries = readdirSync(dir)

    for (const entry of entries) {
      const full = join(dir, entry)
      const st = statSync(full)
      const rel = relative(outputDir, full)

      if (st.isDirectory()) {
        // Skip directories to preserve assets, sitemap styles and manual scripts
        if (entry === '_ipx' || entry === 'img' || entry === 'fonts' || entry === 'js' || entry === '__sitemap__') continue

        walk(full)

        // Remove empty directories after walking
        try {
          if (readdirSync(full).length === 0) {
            rmSync(full, { recursive: true, force: true })
            removed.push(rel)
          }
        }
        catch { /* skip */ }
        continue
      }

      // -- PRUNING RULES --

      // A) Nuxt content dumps & specific root artifacts
      if (entry.startsWith('dump.') && entry.endsWith('.sql')) {
        unlinkSync(full); removed.push(rel); continue
      }
      if (entry === 'nitro.json' || (entry === 'manifest.json' && dir === outputDir)) {
        unlinkSync(full); removed.push(rel); continue
      }

      // B) Compressed files (.gz, .br) - Global removal
      if (entry.endsWith('.gz') || entry.endsWith('.br')) {
        unlinkSync(full); removed.push(rel); continue
      }

      // C) JavaScript & Source Maps (usually in _nuxt but could be elsewhere)
      if (entry.endsWith('.js') || entry.endsWith('.js.map')) {
        // Keep our own runtime!
        if (entry === 'lite.js' || entry === 'lite.min.js') continue

        unlinkSync(full); removed.push(rel); continue
      }

      // D) Redundant CSS (original Nuxt CSS in _nuxt)
      if (entry.endsWith('.css') && dir.includes('_nuxt')) {
        unlinkSync(full); removed.push(rel); continue
      }
    }
  }

  walk(outputDir)
  return removed
}
