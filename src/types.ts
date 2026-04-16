import type { Nuxt } from 'nuxt/schema'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
// Public API — module configuration for nuxt.config.ts
// ============================================================================

export interface SeoOptions {
  /**
   * Enable SEO analysis and auto-fix.
   * - `true` | `'analyze'`: Run analysis and report issues
   * - `'fix'`: Auto-fix issues where possible + report
   * @default false
   */
  optimizeSeo?: boolean | 'analyze' | 'fix'

  /**
   * Maximum allowed DOM depth before warning/error
   */
  maxDomDepth?: {
    warning: number
    error: number
  }

  /**
   * Auto-replicate meta tags (og:title from title, etc.)
   * @default true
   */
  autoReplicate?: boolean

  /**
   * Auto-inject missing meta tags
   * @default false (only in 'fix' mode)
   */
  autoInject?: boolean

  /**
   * Fail build on SEO errors
   * @default false
   */
  failOnError?: boolean

  /**
   * Output report file
   * @default true
   */
  writeReport?: boolean
}

export interface SvgOptions {
  /**
   * Enable SVG optimization by deduplicating and using sprites.
   * @default false
   */
  enabled?: boolean

  /**
   * Minimum number of occurrences before a symbol is created.
   * If 1, all SVGs are converted to symbols.
   * @default 1
   */
  minOccurrences?: number
}

export interface ColorModeOptions {
  /**
   * Enable color mode management.
   * @default false
   */
  enabled?: boolean
  
  /**
   * Default preference (light, dark, or system).
   * @default 'light'
   */
  preference?: 'light' | 'dark' | 'system'
  
  /**
   * Fallback if preference is not available.
   * @default 'light'
   */
  fallback?: 'light' | 'dark'
  
  /**
   * Storage key (localStorage or cookie name).
   * @default 'nuxt-color-mode'
   */
  storageKey?: string
  
  /**
   * Class suffix to append (e.g. '-mode' -> 'dark-mode').
   * @default ''
   */
  classSuffix?: string
}

export interface ModuleOptions {
  /**
   * Optimize CSS output.
   * - `true` | `'inline'`: Tree-shake CSS per-page and inline into `<style>`
   * - `'file'`: Tree-shake globally and output single `/css/optimized.css`
   * - `false`: Skip CSS optimization (default Nuxt/Vite behavior)
   * @default false
   */
  optimizeCss?: boolean | 'inline' | 'file'

  /** @deprecated Use `optimizeCss` instead */
  inlineStyles?: boolean

  /**
   * Strip Vue/Nuxt SSR attributes from HTML output.
   * @default ['data-v-', '__vue_ssr__', 'data-server-rendered']
   */
  stripAttributes?: string[]

  /**
   * Clean HTML by removing Vue runtime scripts, modulepreload,
   * and Nuxt config/payload artifacts.
   * @default true
   */
  cleanHtml?: boolean

  /**
   * List of CSS classes or selectors to preserve from tree-shaking.
   * Useful for classes added dynamically via JS.
   * @default []
   */
  safelist?: string[]

  /**
   * SEO analysis and auto-fix options.
   * Analyzes meta tags and DOM structure for best practices.
   */
  optimizeSeo?: SeoOptions | boolean | 'analyze' | 'fix'

  /**
   * SVG optimization options.
   * Deduplicates SVGs and uses symbols to reduce DOM size.
   */
  optimizeSvg?: SvgOptions | boolean

  /**
   * Color mode management.
   * Lightweight replacement for @nuxtjs/color-mode.
   */
  colorMode?: ColorModeOptions | boolean
}

// ============================================================================
// Internal types
// ============================================================================

export type CssMode = 'inline' | 'file' | 'none'
export type SeoMode = 'analyze' | 'fix' | 'none'

export interface ExtendedOptions extends ModuleOptions {
  _cssMode: CssMode
  _seoMode: SeoMode
  _seoResolved: SeoOptions & { enabled: boolean }
  _svgResolved: SvgOptions & { enabled: boolean }
  _colorResolved: ColorModeOptions & { enabled: boolean }
}

export interface ProcessResult {
  cleaned: number
  cssOptimized: number
}

export interface FileResult {
  cleaned: boolean
  cssOptimized: boolean
}

// ============================================================================
// Constants — essential selectors that must always be preserved
// ============================================================================

export const ESSENTIAL_SELECTORS = Object.freeze([
  'html', 'body', 'head', ':root', '.dark',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'a', 'span', 'div', 'img', 'svg',
  'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
  'blockquote', 'pre', 'code', 'hr',
  '*::before', '*::after', '*::-webkit-scrollbar',
  '::selection', '::placeholder',
  // Nuxt page transitions — required for SPA navigation
  'page-enter-active', 'page-enter-from', 'page-enter-to',
  'page-leave-active', 'page-leave-from', 'page-leave-to',
  // JS-driven UI classes (not present in static HTML, added dynamically)
  '.header-hidden', '.open',
]) as ReadonlyArray<string>

// File patterns to exclude from CSS collection
export const SKIP_CSS_FILES = Object.freeze(['optimized.css', 'main.css'])

// ============================================================================
// Regex patterns — HTML extraction
// ============================================================================

export const CLASS_RE = /\bclass=["']([^"']*)["']/g
export const ID_RE = /\bid=["']([^"']*)["']/g
export const DATA_RE = /\bdata-([\w-]+)=/g
export const HTML_TAG_RE = /<([a-z][a-z0-9]*)\b[^>]*>/gi
export const SVG_RE = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi

// ============================================================================
// Regex patterns — HTML cleaning
// ============================================================================

export const CSS_LINK_RE = /<link[^>]*rel="stylesheet"[^>]*href="[^"]*"[^>]*>\s*/g
export const STYLE_TAG_RE = /<style[^>]*>[\s\S]*?<\/style>\s*/g
export const VUE_RUNTIME_RE = /<script[^>]*type="module"[^>]*src="\/_nuxt\/[^"]*"[^>]*><\/script>/g
export const MODULEPRELOAD_RE = /<link[^>]*rel="modulepreload"[^>]*href="\/_nuxt\/[^"]*"[^>]*>/g
export const PREFETCH_RE = /<link[^>]*rel="(preload|prefetch)"[^>]*href="\/_nuxt\/[^"]*\.js[^"]*"[^>]*>/g

// Nuxt runtime artifacts — full elements to remove
export const NUXT_DATA_RE = /<script[^>]*id="__NUXT_DATA__"[^>]*>[\s\S]*?<\/script>\s*/g
export const NUXT_CONFIG_RE = /<script[^>]*data-nuxt-data[^>]*>[\s\S]*?<\/script>\s*/g
export const TELEPORTS_RE = /<div id="teleports"><\/div>\s*/g

// ============================================================================
// Regex patterns — CSS parsing
// ============================================================================

export const CSS_COMMENT_RE = /\/\*[\s\S]*?\*\//g
export const CSS_WS_RE = /\s+/g
export const SKIP_AT_RULE_RE = /^@(?:charset|import)\b/
export const PRESERVE_AT_RULE_RE = /^@(?:font-face|keyframes|-webkit-keyframes)\b/

// ============================================================================
// Pure helpers (no side effects)
// ============================================================================

export function resolveCssMode(options: ModuleOptions): CssMode {
  if (options.optimizeCss === 'file') return 'file'
  if (options.optimizeCss === 'inline') return 'inline'
  if (options.optimizeCss === true) return 'inline'
  if (options.inlineStyles) return 'inline'
  return 'none'
}

export function resolveSeoMode(options: ModuleOptions): SeoMode {
  const seo = options.optimizeSeo
  if (!seo) return 'none'
  if (seo === true || seo === 'analyze') return 'analyze'
  if (seo === 'fix') return 'fix'
  if (typeof seo === 'object' && seo.optimizeSeo) {
    if (seo.optimizeSeo === true || seo.optimizeSeo === 'analyze') return 'analyze'
    if (seo.optimizeSeo === 'fix') return 'fix'
  }
  return 'none'
}

export function resolveSeoConfig(options: ModuleOptions): { mode: SeoMode, enabled: boolean, settings: SeoOptions } {
  const mode = resolveSeoMode(options)
  const enabled = mode !== 'none'
  const baseSettings: SeoOptions = {
    optimizeSeo: typeof options.optimizeSeo === 'object' ? options.optimizeSeo.optimizeSeo : options.optimizeSeo,
    maxDomDepth: options.optimizeSeo && typeof options.optimizeSeo === 'object' ? options.optimizeSeo.maxDomDepth : undefined,
    autoReplicate: options.optimizeSeo && typeof options.optimizeSeo === 'object' ? options.optimizeSeo.autoReplicate ?? true : true,
    autoInject: options.optimizeSeo && typeof options.optimizeSeo === 'object' ? options.optimizeSeo.autoInject : mode === 'fix',
    failOnError: options.optimizeSeo && typeof options.optimizeSeo === 'object' ? options.optimizeSeo.failOnError ?? false : false,
    writeReport: options.optimizeSeo && typeof options.optimizeSeo === 'object' ? options.optimizeSeo.writeReport ?? true : true,
  }
  return { mode, enabled, settings: baseSettings }
}

export function resolveSvgConfig(options: ModuleOptions): { enabled: boolean, settings: SvgOptions } {
  const svg = options.optimizeSvg
  if (!svg) return { enabled: false, settings: {} }
  const settings: SvgOptions = typeof svg === 'object' ? svg : { enabled: true }
  return { 
    enabled: settings.enabled ?? !!svg, 
    settings: {
      minOccurrences: settings.minOccurrences ?? 2,
      ...settings
    } 
  }
}

export function resolveColorConfig(options: ModuleOptions): { enabled: boolean, settings: ColorModeOptions } {
  const color = options.colorMode
  if (!color) return { enabled: false, settings: {} }
  const settings: ColorModeOptions = typeof color === 'object' ? color : { enabled: true }
  return { 
    enabled: settings.enabled ?? !!color, 
    settings: {
      preference: settings.preference ?? 'light',
      fallback: settings.fallback ?? 'light',
      storageKey: settings.storageKey ?? 'nuxt-color-mode',
      classSuffix: settings.classSuffix ?? '',
      ...settings
    } 
  }
}

export function findOutputDir(nuxt: Nuxt): string | null {
  const candidates = [
    nuxt.options.rootDir && join(nuxt.options.rootDir, 'dist'),
    nuxt.options.nitro.output?.dir,
    '.output/public',
  ]
  for (const d of candidates) {
    if (d && existsSync(d) && readdirSync(d).length > 0) return d
  }
  return null
}
