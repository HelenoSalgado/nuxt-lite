/**
 * serialize.ts — Parser HTML → JSON hierárquico (árvore DOM completa)
 *
 * Converte o conteúdo do slot do layout em uma árvore JSON reconstruível:
 * { tag: 'div', attrs: { class: '...' }, children: [...] }
 *
 * Preserva: tags, atributos (SVG viewBox corrigido), textos, comentários
 */

// ============================================================================
// Types
// ============================================================================

export interface DomNode {
  type: 'element' | 'text' | 'comment'
  tag?: string
  attrs?: Record<string, string>
  children?: DomNode[]
  content?: string
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
      } else {
        tokens.push({ type: 'text', raw: tagRaw })
      }
      continue
    }

    // Close tag
    if (tagRaw.startsWith('</')) {
      const tagMatch = tagRaw.match(/^<\/([a-z][a-z0-9]*)\s*>$/i)
      if (tagMatch) {
        tokens.push({ type: 'tag-close', tagName: tagMatch[1]!.toLowerCase(), raw: tagRaw })
      } else {
        tokens.push({ type: 'text', raw: tagRaw })
      }
      continue
    }

    // Open tag
    const tagMatch = tagRaw.match(/^<([a-z][a-z0-9]*)\b([\s\S]*)>$/i)
    if (tagMatch) {
      tokens.push({ type: 'tag-open', tagName: tagMatch[1]!.toLowerCase(), raw: tagRaw, attrs: parseAttrs(tagMatch[2] || '') })
    } else {
      tokens.push({ type: 'text', raw: tagRaw })
    }
  }

  return tokens
}

// ============================================================================
// Attribute Parser — com correção de viewBox
// ============================================================================

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRe = /([a-zA-Z][a-zA-Z0-9_-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/gi
  let match

  while ((match = attrRe.exec(attrString)) !== null) {
    let name = match[1]!
    const lower = name.toLowerCase()
    // SSR entrega viewBox lowercase — restaurar
    if (lower === 'viewbox') name = 'viewBox'
    else if (lower !== name && !isSvgAttrCamel(lower)) name = lower

    let value = match[2] ?? match[3] ?? match[4] ?? ''
    // Decode HTML entities
    value = decodeEntities(value)
    attrs[name] = value
  }

  return attrs
}

// SVG attributes que precisam de camelCase
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
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
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
        if (!parent.children) parent.children = []
        if (text.trim().length > 0 || text.length <= 2) {
          parent.children.push({ type: 'text', content: text })
        }
      } else if (text.trim().length > 0) {
        root.push({ type: 'text', content: text })
      }
      continue
    }

    if (token.type === 'comment') {
      const node: DomNode = { type: 'comment', content: token.raw.slice(4, -3) }
      if (stack.length > 0) {
        const parent = stack[stack.length - 1]!
        if (!parent.children) parent.children = []
        parent.children.push(node)
      } else {
        root.push(node)
      }
      continue
    }

    if (token.type === 'doctype') continue

    if (token.type === 'tag-open') {
      const tagName = token.tagName!
      const node: DomNode = { type: 'element', tag: tagName, attrs: token.attrs || {}, children: [] }

      if (VOID_TAGS.has(tagName)) {
        if (stack.length > 0) stack[stack.length - 1]!.children!.push(node)
        else root.push(node)
      } else {
        stack.push(node)
      }
      continue
    }

    if (token.type === 'self-close') {
      const node: DomNode = { type: 'element', tag: token.tagName!, attrs: token.attrs || {} }
      if (stack.length > 0) stack[stack.length - 1]!.children!.push(node)
      else root.push(node)
      continue
    }

    if (token.type === 'tag-close') {
      const tagName = token.tagName!
      let idx = stack.length - 1
      while (idx >= 0) {
        if (stack[idx]!.tag === tagName) {
          const node = stack[idx]!
          stack.splice(idx)
          if (stack.length > 0) stack[stack.length - 1]!.children!.push(node)
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
  const meta: PagePayload['meta'] = { title: '', og: {}, twitter: {} }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) meta.title = titleMatch[1]!.trim()

  const metaRe = /<meta\s+([^>]+)>/gi
  let m: RegExpExecArray | null
  while ((m = metaRe.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]!)
    const name = attrs.name || attrs.property
    const content = attrs.content || ''
    if (!name) continue
    if (name === 'description') meta.description = content
    else if (name.startsWith('og:')) (meta.og!)[name.slice(3)] = content
    else if (name.startsWith('twitter:')) (meta.twitter!)[name.slice(8)] = content
  }

  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
  if (canonicalMatch) meta.canonical = canonicalMatch[1]

  return meta
}

export function serializePage(html: string): PagePayload {
  return { dom: extractSlotContent(html), meta: extractMetaTags(html) }
}

// ============================================================================
// DOM Tree → HTML (inverso)
// ============================================================================

export function domToHtml(nodes: DomNode[]): string {
  let html = ''
  for (const node of nodes) {
    if (node.type === 'text') html += node.content || ''
    else if (node.type === 'comment') html += `<!--${node.content || ''}-->`
    else if (node.type === 'element') {
      const attrs = node.attrs ? formatAttrs(node.attrs) : ''
      const tag = node.tag || 'div'
      if (VOID_TAGS.has(tag)) {
        html += `<${tag}${attrs}>`
      } else {
        const children = node.children ? domToHtml(node.children) : ''
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
