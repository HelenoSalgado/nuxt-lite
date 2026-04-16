import { SVG_RE } from '../types'
import { createHash } from 'node:crypto'

export interface SvgSymbol {
  id: string
  content: string
  attributes: string
}

/**
 * Deduplicates SVGs in HTML and replaces them with <use> tags only if they repeat.
 * Returns the modified HTML and the list of discovered symbols.
 */
export function processSvgs(html: string, minOccurrences: number = 2): { html: string, symbols: Map<string, SvgSymbol> } {
  const symbols = new Map<string, SvgSymbol>()
  const occurrences = new Map<string, number>()
  const svgData = new Map<string, { attributes: string, content: string, fullMatch: string }[]>()

  // 1. First pass: scan and count occurrences by content hash
  const matches = [...html.matchAll(SVG_RE)]
  for (const match of matches) {
    const [fullMatch, attributes = '', content = ''] = match
    
    // Skip sprite container
    if (attributes.includes('id="__NUXT_LITE_SPRITE__"') || attributes.includes('data-nl-ignore')) {
      continue
    }

    const cleanContent = content.trim().replace(/>\s+</g, '><')
    const hash = createHash('md5').update(cleanContent).digest('hex').slice(0, 8)
    
    occurrences.set(hash, (occurrences.get(hash) || 0) + 1)
    
    if (!svgData.has(hash)) svgData.set(hash, [])
    svgData.get(hash)!.push({ attributes, content: cleanContent, fullMatch })
  }

  // 2. Second pass: replace in HTML
  let processedHtml = html
  for (const [hash, count] of occurrences.entries()) {
    const dataList = svgData.get(hash)!
    const symbolId = `svg-${hash}`

    if (count >= minOccurrences) {
      // It's a repeated SVG, move to symbols and use <use>
      const first = dataList[0]
      if (!first) continue

      symbols.set(symbolId, {
        id: symbolId,
        content: first.content,
        attributes: first.attributes
      })

      // Replace all occurrences of this SVG with <use>
      for (const item of dataList) {
        // We use a safe replacement to avoid regex collision with already replaced parts
        // This is a bit tricky with string.replace, so we'll do it carefully
        processedHtml = processedHtml.replace(item.fullMatch, `<svg ${item.attributes}><use href="#${symbolId}"/></svg>`)
      }
    } else {
      // It's a unique SVG, just clean it up inline
      for (const item of dataList) {
        processedHtml = processedHtml.replace(item.fullMatch, `<svg ${item.attributes}>${item.content}</svg>`)
      }
    }
  }

  return { html: processedHtml, symbols }
}

/**
 * Generates the SVG Sprite container to be injected into the DOM.
 */
export function generateSpriteContainer(symbols: Map<string, SvgSymbol>): string {
  if (symbols.size === 0) return ''
  
  let symbolsHtml = ''
  for (const symbol of symbols.values()) {
    const viewBoxMatch = symbol.attributes.match(/viewBox="([^"]*)"/)
    const viewBoxAttr = viewBoxMatch ? ` viewBox="${viewBoxMatch[1]}"` : ''
    symbolsHtml += `<symbol id="${symbol.id}"${viewBoxAttr}>${symbol.content}</symbol>`
  }

  return `<svg id="__NUXT_LITE_SPRITE__" style="display:none" xmlns="http://www.w3.org/2000/svg">${symbolsHtml}</svg>`
}
