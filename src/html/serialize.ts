/**
 * serialize.ts — HTML → Hierarchical JSON (Complete DOM tree)
 *
 * Converts layout slot content into a reconstructible JSON tree:
 * { tag: 'div', attrs: { class: '...' }, children: [...] }
 *
 * Preserves: tags, attributes (corrected SVG viewBox), text, comments
 */

import { extractMetaTagsFast } from '../utils/meta'

// ============================================================================
// Types
// ============================================================================

export interface DomNode {
  t?: 'e' | 't' | 'c' // type: e=element (default), t=text, c=comment
  g?: string // tag (ex: div, span)
  a?: Record<string, string> // attrs
  c?: DomNode[] // children
  v?: string // value (content para texto ou comentário)
}

export interface PagePayload {
  dom: DomNode[]
  meta: {
    title: string
    description?: string
    canonical?: string
    og?: Record<string, string>
    twitter?: Record<string, string>
  }
}

// ============================================================================
// HTML Tokenizer
// ============================================================================

interface HtmlToken {
  type: 'tag-open' | 'tag-close' | 'self-close' | 'text' | 'comment' | 'doctype'
  tagName?: string
  raw: string
  attrs?: Record<string, string>
}

function tokenize(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = []
  let pos = 0

  while (pos < html.length) {
    const openIdx = html.indexOf('<', pos)

    if (openIdx > pos) {
      const text = html.substring(pos, openIdx)
      if (text.length > 0) {
        tokens.push({ type: 'text', raw: text })
      }
    }

    if (openIdx === -1) break

    // Comment
    if (html.startsWith('<!--', openIdx)) {
      const closeIdx = html.indexOf('-->', openIdx + 4)
      if (closeIdx !== -1) {
        tokens.push({ type: 'comment', raw: html.substring(openIdx, closeIdx + 3) })
        pos = closeIdx + 3
        continue
      }
    }

    // DOCTYPE
    if (html.startsWith('<!DOCTYPE', openIdx) || html.startsWith('<!doctype', openIdx)) {
      const closeIdx = html.indexOf('>', openIdx)
      if (closeIdx !== -1) {
        tokens.push({ type: 'doctype', raw: html.substring(openIdx, closeIdx + 1) })
        pos = closeIdx + 1
        continue
      }
    }

    // Tag
    const closeIdx = html.indexOf('>', openIdx)
    if (closeIdx === -1) {
      tokens.push({ type: 'text', raw: html.substring(pos) })
      break
    }

    let tagRaw = html.substring(openIdx, closeIdx + 1)
    pos = closeIdx + 1

    // Handle > inside quoted attributes
    while (pos < html.length) {
      const quoteCount = (tagRaw.match(/"/g) || []).length
      if (quoteCount % 2 === 0) break
      const nextClose = html.indexOf('>', pos)
      if (nextClose === -1) break
      tagRaw = html.substring(openIdx, nextClose + 1)
      pos = nextClose + 1
    }

    // Self-closing
    if (tagRaw.endsWith('/>')) {
      const tagMatch = tagRaw.match(/^<([a-z][a-z0-9]*)\b([\s\S]*?)\/>$/i)
      if (tagMatch) {
        tokens.push({ type: 'self-close', tagName: tagMatch[1]!.toLowerCase(), raw: tagRaw, attrs: parseAttrs(tagMatch[2] || '') })
      }
      else {
        tokens.push({ type: 'text', raw: tagRaw })
      }
      continue
    }

    // Close tag
    if (tagRaw.startsWith('</')) {
      const tagMatch = tagRaw.match(/^<\/([a-z][a-z0-9]*)\s*>$/i)
      if (tagMatch) {
        tokens.push({ type: 'tag-close', tagName: tagMatch[1]!.toLowerCase(), raw: tagRaw })
      }
      else {
        tokens.push({ type: 'text', raw: tagRaw })
      }
      continue
    }

    // Open tag
    const tagMatch = tagRaw.match(/^<([a-z][a-z0-9]*)\b([\s\S]*)>$/i)
    if (tagMatch) {
      tokens.push({ type: 'tag-open', tagName: tagMatch[1]!.toLowerCase(), raw: tagRaw, attrs: parseAttrs(tagMatch[2] || '') })
    }
    else {
      tokens.push({ type: 'text', raw: tagRaw })
    }
  }

  return tokens
}

// ============================================================================
// Attribute Parser — with viewBox correction
// ============================================================================

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRe = /([a-z][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/gi
  let match

  while ((match = attrRe.exec(attrString)) !== null) {
    let name = match[1]!
    const lower = name.toLowerCase()
    // SSR delivers viewBox lowercase — restore
    if (lower === 'viewbox') name = 'viewBox'
    else if (lower !== name && !isSvgAttrCamel(lower)) name = lower

    let value = match[2] ?? match[3] ?? match[4] ?? ''
    // Decode HTML entities
    value = decodeEntities(value)
    attrs[name] = value
  }

  return attrs
}

// SVG attributes that require camelCase
const SVG_CAMEL = new Set([
  'viewbox', 'preserveaspectratio', 'attributename', 'attributetype',
  'basefrequency', 'baseprofile', 'calcmode', 'clippathunits',
  'diffuseconstant', 'edgemode', 'externalresourcesrequired',
  'filterres', 'filterunits', 'glyphref', 'gradienttransform',
  'gradientunits', 'kernelmatrix', 'kernelunitlength', 'keypoints',
  'keysplines', 'keytimes', 'lengthadjust', 'limitingconeangle',
  'markerheight', 'markerunits', 'markerwidth', 'numoctaves',
  'pathlength', 'patterncontentunits', 'patterntransform', 'patternunits',
  'pointsatx', 'pointsaty', 'pointsatz', 'refx', 'refy',
  'spreadmethod', 'startoffset', 'stddeviation', 'stitchtiles',
  'surfacescale', 'systemlanguage', 'tablevalues', 'targetx', 'targety',
  'textlength', 'viewtarget', 'xchannelselector', 'ychannelselector',
  'zoomandpan',
])

function isSvgAttrCamel(lower: string): boolean {
  return SVG_CAMEL.has(lower)
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number.parseInt(num, 10)))
}

// ============================================================================
// Tokens → DOM Tree
// ============================================================================

const VOID_TAGS = new Set([
  'img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base',
  'col', 'embed', 'source', 'track', 'wbr',
])

function tokensToDom(tokens: HtmlToken[]): DomNode[] {
  const root: DomNode[] = []
  const stack: DomNode[] = []

  for (const token of tokens) {
    if (token.type === 'text') {
      const text = token.raw
      if (stack.length > 0) {
        const parent = stack[stack.length - 1]!
        if (!parent.c) parent.c = []
        if (text.trim().length > 0 || text.length <= 2) {
          parent.c.push({ t: 't', v: text })
        }
      }
      else if (text.trim().length > 0) {
        root.push({ t: 't', v: text })
      }
      continue
    }

    if (token.type === 'comment') {
      const node: DomNode = { t: 'c', v: token.raw.slice(4, -3) }
      if (stack.length > 0) {
        const parent = stack[stack.length - 1]!
        if (!parent.c) parent.c = []
        parent.c.push(node)
      }
      else {
        root.push(node)
      }
      continue
    }

    if (token.type === 'doctype') continue

    if (token.type === 'tag-open') {
      const tagName = token.tagName!
      const node: DomNode = { g: tagName }
      if (token.attrs && Object.keys(token.attrs).length > 0) node.a = token.attrs

      if (VOID_TAGS.has(tagName)) {
        if (stack.length > 0) {
          const parent = stack[stack.length - 1]!
          if (!parent.c) parent.c = []
          parent.c!.push(node)
        }
        else root.push(node)
      }
      else {
        node.c = [] // Inicia children para tags não-void
        stack.push(node)
      }
      continue
    }

    if (token.type === 'self-close') {
      const node: DomNode = { g: token.tagName! }
      if (token.attrs && Object.keys(token.attrs).length > 0) node.a = token.attrs

      if (stack.length > 0) {
        const parent = stack[stack.length - 1]!
        if (!parent.c) parent.c = []
        parent.c!.push(node)
      }
      else root.push(node)
      continue
    }

    if (token.type === 'tag-close') {
      const tagName = token.tagName!
      let idx = stack.length - 1
      while (idx >= 0) {
        if (stack[idx]!.g === tagName) {
          const node = stack[idx]!
          // Otimização: remove array de children se estiver vazio
          if (node.c && node.c.length === 0) delete node.c

          stack.splice(idx)
          if (stack.length > 0) {
            const parent = stack[stack.length - 1]!
            if (!parent.c) parent.c = []
            parent.c!.push(node)
          }
          else root.push(node)
          break
        }
        idx--
      }
      continue
    }
  }

  return root
}

// ============================================================================
// Public API
// ============================================================================

export function htmlToDom(html: string): DomNode[] {
  const cleaned = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '')
  return tokensToDom(tokenize(cleaned))
}

export function extractSlotContent(html: string): DomNode[] {
  const startMarker = '<!--NL:SLOT_START-->'
  const endMarker = '<!--NL:SLOT_END-->'

  const startIdx = html.indexOf(startMarker)
  const endIdx = html.indexOf(endMarker)

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (mainMatch) return htmlToDom(mainMatch[1]!)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (bodyMatch) return htmlToDom(bodyMatch[1]!)
    return htmlToDom(html)
  }

  return htmlToDom(html.substring(startIdx + startMarker.length, endIdx))
}

export function extractMetaTags(html: string): PagePayload['meta'] {
  return extractMetaTagsFast(html)
}

export function serializePage(html: string): PagePayload {
  return { dom: extractSlotContent(html), meta: extractMetaTagsFast(html) }
}

// ============================================================================
// DOM Tree → HTML (inverso)
// ============================================================================

export function domToHtml(nodes: DomNode[]): string {
  let html = ''
  for (const node of nodes) {
    const type = node.t || 'e'
    if (type === 't') html += node.v || ''
    else if (type === 'c') html += `<!--${node.v || ''}-->`
    else if (type === 'e') {
      const attrs = node.a ? formatAttrs(node.a) : ''
      const tag = node.g || 'div'
      if (VOID_TAGS.has(tag)) {
        html += `<${tag}${attrs}>`
      }
      else {
        const children = node.c ? domToHtml(node.c) : ''
        html += `<${tag}${attrs}>${children}</${tag}>`
      }
    }
  }
  return html
}

function formatAttrs(attrs: Record<string, string>): string {
  let result = ''
  for (const [name, value] of Object.entries(attrs)) {
    result += value === '' ? ` ${name}` : ` ${name}="${value.replace(/"/g, '&quot;')}"`
  }
  return result
}
