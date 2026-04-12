/**
 * pretty-print.ts — Formata HTML minificado (uma linha) para estrutura legível
 */

export function prettyPrintHtml(minified: string): string {
  const BLOCK_TAGS = new Set([
    'html', 'head', 'body', 'title', 'meta', 'link', 'script', 'style',
    'div', 'section', 'article', 'aside', 'nav', 'header', 'footer',
    'main', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'blockquote', 'pre', 'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'form', 'fieldset', 'legend', 'details', 'summary', 'dialog',
    'figure', 'figcaption', 'template',
  ])

  const VOID_TAGS = new Set([
    'img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base',
    'col', 'embed', 'source', 'track', 'wbr',
  ])

  const INDENT = '  '
  let output = ''
  let indentLevel = 0

  const tokens = tokenize(minified)

  for (const token of tokens) {
    if (token.type === 'comment') {
      output += INDENT.repeat(indentLevel) + token.raw.trim() + '\n'
      continue
    }

    if (token.type === 'text') {
      const trimmed = (token.value || '').trim()
      if (trimmed) {
        output += INDENT.repeat(indentLevel) + trimmed + '\n'
      }
      continue
    }

    if (token.type === 'tag') {
      const { tagName, isClose, isSelfClose, raw } = token
      const safeRaw = raw || ''

      if (isClose) {
        indentLevel = Math.max(0, indentLevel - 1)
        output += INDENT.repeat(indentLevel) + safeRaw.trim() + '\n'
        continue
      }

      if (!isSelfClose && tagName && !VOID_TAGS.has(tagName)) {
        output += INDENT.repeat(indentLevel) + safeRaw.trim() + '\n'
        if (BLOCK_TAGS.has(tagName) || tagName === 'template') {
          indentLevel++
        }
        continue
      }

      output += INDENT.repeat(indentLevel) + safeRaw.trim() + '\n'
      continue
    }
  }

  return output
}

interface HtmlToken {
  type: 'tag' | 'text' | 'comment'
  tagName?: string
  isClose?: boolean
  isSelfClose?: boolean
  raw: string
  value?: string
}

function tokenize(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = []
  let pos = 0

  while (pos < html.length) {
    const openIdx = html.indexOf('<', pos)

    if (openIdx > pos) {
      const text = html.substring(pos, openIdx)
      if (text.trim()) {
        tokens.push({ type: 'text', raw: text, value: text })
      }
    }

    if (openIdx === -1) break

    const closeIdx = html.indexOf('>', openIdx)
    if (closeIdx === -1) {
      tokens.push({ type: 'text', raw: html.substring(pos) })
      break
    }

    const raw = html.substring(openIdx, closeIdx + 1)
    pos = closeIdx + 1

    if (raw.startsWith('<!--')) {
      const commentEnd = html.indexOf('-->', openIdx)
      if (commentEnd !== -1) {
        const comment = html.substring(openIdx, commentEnd + 3)
        tokens.push({ type: 'comment', raw: comment })
        pos = commentEnd + 3
        continue
      }
    }

    const tagMatch = raw.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)\/?\s*>$/)
    if (tagMatch) {
      const tagName = tagMatch[1]!.toLowerCase()
      const isClose = raw.startsWith('</')
      const isSelfClose = raw.endsWith('/>')

      tokens.push({ type: 'tag', tagName, isClose, isSelfClose, raw })
    } else {
      tokens.push({ type: 'text', raw })
    }
  }

  return tokens
}
