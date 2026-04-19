/**
 * meta.ts — Consolidated meta tag extraction
 *
 * Provides single source of truth for extracting and normalizing
 * meta tags from HTML, supporting both regex and DOM parsing.
 */

import { parseHTML } from 'linkedom'
import type { ExtractedMeta } from '../seo/types'

/**
 * Interface returned by the fast extractor, which is a subset of ExtractedMeta
 */
export interface ExtractedMetaFast {
  title: string
  description?: string
  canonical?: string
  og: Record<string, string>
  twitter: Record<string, string>
}

// ============================================================================
// Helpers
// ============================================================================

function isSvgAttrCamel(attr: string): boolean {
  const SVG_CAMEL = new Set([
    'viewbox', 'preserveaspectratio', 'attributename', 'attributetype',
    'basefrequency', 'baseprofile', 'calcmode', 'clippathunits',
    'diffuseconstant', 'edgemode', 'externalresourcesrequired',
    'filterres', 'filterunits', 'glyphref', 'gradienttransform',
    'gradientunits', 'kernelmatrix', 'kernelunitlength', 'keypoints',
    'keysplines', 'keytimes', 'lengthadjust', 'limitingconeangle',
    'markerheight', 'markerunits', 'markerwidth', 'numoctaves',
    'pathlength', 'patterncontentunits', 'patterntransform',
    'patternunits', 'pointsatx', 'pointsaty', 'pointsatz',
    'repeatcount', 'repeatdur', 'requiredextensions', 'requiredfeatures',
    'specularconstant', 'specularexponent', 'spreadmethod',
    'startoffset', 'stddeviation', 'stitchtiles', 'surfacescale',
    'systemlanguage', 'tablevalues', 'targetx', 'targety',
    'textlength', 'viewtarget', 'xchannelselector', 'ychannelselector',
    'zoomandpan',
  ])
  return SVG_CAMEL.has(attr)
}

function decodeEntities(str: string): string {
  if (!str.includes('&')) return str
  return str.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
}

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRe = /([a-z][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/gi
  let match

  while ((match = attrRe.exec(attrString)) !== null) {
    let name = match[1]!
    const lower = name.toLowerCase()
    if (lower === 'viewbox') name = 'viewBox'
    else if (lower !== name && !isSvgAttrCamel(lower)) name = lower

    let value = match[2] ?? match[3] ?? match[4] ?? ''
    value = decodeEntities(value)
    attrs[name] = value
  }

  return attrs
}

// ============================================================================
// Extraction Methods
// ============================================================================

/**
 * Extract meta tags using regex (faster, for payload serialization)
 */
export function extractMetaTagsFast(html: string): ExtractedMetaFast {
  const meta: ExtractedMetaFast = { title: '', og: {}, twitter: {} }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) meta.title = titleMatch[1]!.trim()

  const metaRe = /<meta\s+([^\s>][^>]*)?>/gi
  let m: RegExpExecArray | null
  while ((m = metaRe.exec(html)) !== null) {
    const attrs = parseAttrs(m[1] || '')
    const name = attrs.name || attrs.property
    const content = attrs.content || ''
    if (!name) continue
    if (name === 'description') meta.description = content
    else if (name.startsWith('og:')) meta.og[name.slice(3)] = content
    else if (name.startsWith('twitter:')) meta.twitter[name.slice(8)] = content
  }

  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
  if (canonicalMatch) meta.canonical = canonicalMatch[1]

  return meta
}

/**
 * Extract meta tags using DOM parsing (safer, for SEO analysis)
 */
export function extractMetaTagsSafe(html: string): ExtractedMeta {
  const meta: ExtractedMeta = {
    title: '',
    og: {},
    twitter: {},
    other: {},
  }

  const { document } = parseHTML(html)

  // Title
  const titleEl = document.querySelector('title')
  if (titleEl) meta.title = titleEl.textContent?.trim() || ''

  // Meta tags
  const metaElements = document.querySelectorAll('meta')
  metaElements.forEach((el) => {
    const name = el.getAttribute('name') || el.getAttribute('property') || ''
    const content = el.getAttribute('content') || ''
    const httpEquiv = el.getAttribute('http-equiv')
    const charset = el.getAttribute('charset')

    if (charset) {
      meta.charset = charset
      return
    }

    if (httpEquiv) {
      if (httpEquiv.toLowerCase() === 'content-type' && content) {
        const charsetMatch = content.match(/charset=([^;]+)/i)
        if (charsetMatch) meta.charset = charsetMatch[1]!
      }
      return
    }

    if (!name && !el.getAttribute('name') && !el.getAttribute('property')) return

    if (name === 'description') {
      meta.description = content
    }
    else if (name === 'canonical') {
      meta.canonical = content
    }
    else if (name === 'robots') {
      meta.robots = content
    }
    else if (name === 'viewport') {
      meta.viewport = content
    }
    else if (name.startsWith('og:')) {
      meta.og[name.slice(3)] = content
    }
    else if (name.startsWith('twitter:')) {
      meta.twitter[name.slice(8)] = content
    }
    else if (name) {
      meta.other[name] = content
    }
  })

  // Canonical link
  const canonicalLink = document.querySelector('link[rel="canonical"]')
  if (canonicalLink && !meta.canonical) {
    meta.canonical = canonicalLink.getAttribute('href') || ''
  }

  return meta
}

/**
 * Extract meta tags using appropriate method
 * Defaults to fast for production, safe for analysis
 */
export function extractMetaTags(
  html: string,
  method: 'fast' | 'safe' = 'fast',
): ExtractedMetaFast | ExtractedMeta {
  return method === 'fast' ? extractMetaTagsFast(html) : extractMetaTagsSafe(html)
}
