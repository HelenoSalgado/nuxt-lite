import { existsSync, readdirSync, statSync, readFileSync, unlinkSync } from 'node:fs'
import { join, relative } from 'node:path'
import { SKIP_CSS_FILES } from '../types'

/** Collect all .css files from the build output, keyed by their href path */
export function collectAllCssFiles(rootDir: string): Map<string, string> {
  const content = new Map<string, string>()

  function walk(dir: string) {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) { walk(full); continue }
      if (!entry.endsWith('.css') || SKIP_CSS_FILES.includes(entry)) continue
      const href = '/' + relative(rootDir, full).replace(/\\/g, '/')
      try { content.set(href, readFileSync(full, 'utf-8')) }
      catch { /* skip unreadable files */ }
    }
  }

  walk(rootDir)
  return content
}

/** Remove all .css files except the optimized output */
export function removeRedundantCssFiles(rootDir: string, keepPath: string) {
  const keepRel = relative(rootDir, keepPath).replace(/\\/g, '/')

  function walk(dir: string) {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) { walk(full); continue }
      if (!entry.endsWith('.css')) continue
      const rel = relative(rootDir, full).replace(/\\/g, '/')
      if (rel === keepRel) continue
      try {
        unlinkSync(full)
        console.log(`[nuxt-lite] Removed redundant CSS: ${rel}`)
      } catch { /* skip */ }
    }
  }

  walk(rootDir)
}
