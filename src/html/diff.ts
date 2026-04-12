/**
 * diff.ts — LCS iterativo acumulativo 1-para-muitos
 *
 * Separa <head> do <body>:
 * - <head> é salvo como payload "head" (muda por página: title, meta, SEO)
 * - <body> é diffado para encontrar blocos variáveis de conteúdo
 */

// ============================================================================
// HTML splitting: head vs body
// ============================================================================

export interface HtmlParts {
  head: string       // Conteúdo completo de <head>...</head>
  body: string       // Conteúdo completo de <body>...</body>
  full: string       // HTML original
}

export function splitHtml(html: string): HtmlParts {
  const headMatch = html.match(/(<head[\s\S]*?<\/head>)/i)
  const bodyMatch = html.match(/(<body[\s\S]*?<\/body>)/i)
  return {
    head: headMatch ? headMatch[1] : '',
    body: bodyMatch ? bodyMatch[1] : '',
    full: html,
  }
}

// ============================================================================
// Encontra blocos comuns entre dois HTMLs minificados
// ============================================================================

function findAllCommonBlocks(
  a: string,
  b: string,
  minLength = 128,
): Array<{ aStart: number; bStart: number; length: number }> {
  const blocks: Array<{ aStart: number; bStart: number; length: number }> = []
  let aOffset = 0
  let bOffset = 0
  let remA = a
  let remB = b

  while (remA.length > minLength && remB.length > minLength) {
    const common = longestCommonSubstring(remA, remB, minLength)
    if (!common) break

    blocks.push({
      aStart: aOffset + common.aStart,
      bStart: bOffset + common.bStart,
      length: common.length,
    })

    remA = remA.substring(common.aStart + common.length)
    remB = remB.substring(common.bStart + common.length)
    aOffset += common.aStart + common.length
    bOffset += common.bStart + common.length
  }

  return blocks
}

function longestCommonSubstring(
  a: string,
  b: string,
  minLength: number,
): { aStart: number; bStart: number; length: number } | null {
  // Estratégia: buscar por tags de fechamento longas como âncoras
  // `</section>`, `</article>`, `</nav>`, etc. são bons marcadores
  const anchors = [
    '</section>', '</article>', '</main>', '</nav>', '</footer>',
    '</header>', '</aside>', '</blockquote>', '</form>',
    '</ul>', '</ol>', '</table>',
  ]

  let bestStartA = -1
  let bestStartB = -1
  let bestLen = 0

  for (const anchor of anchors) {
    let aIdx = a.indexOf(anchor)
    while (aIdx !== -1) {
      let bIdx = b.indexOf(anchor)
      while (bIdx !== -1) {
        // Estender para frente
        let fwd = 0
        while (
          aIdx + fwd < a.length &&
          bIdx + fwd < b.length &&
          a[aIdx + fwd] === b[bIdx + fwd]
        ) {
          fwd++
        }
        // Estender para trás
        let back = 0
        while (
          aIdx - back > 0 &&
          bIdx - back > 0 &&
          a[aIdx - back - 1] === b[bIdx - back - 1]
        ) {
          back++
        }
        const total = fwd + back
        if (total > bestLen) {
          bestStartA = aIdx - back
          bestStartB = bIdx - back
          bestLen = total
        }
        bIdx = b.indexOf(anchor, bIdx + 1)
      }
      aIdx = a.indexOf(anchor, aIdx + 1)
    }
  }

  if (bestLen < minLength) return null
  return { aStart: bestStartA!, bStart: bestStartB!, length: bestLen }
}

// ============================================================================
// 1-para-muitos acumulativo
// ============================================================================

export interface GroupDiffResult {
  /** HTML com marcadores <!--NL:N--> */
  templateHtml: string
  blockCount: number
  /** Payloads por rota: { "0": "<main>...", "head": "<head>...", ... } */
  payloads: Map<string, Record<string, string>>
}

export function diffGroup(
  pages: Array<{ route: string; html: string }>,
): GroupDiffResult {
  if (pages.length === 0) {
    return { templateHtml: '', blockCount: 0, payloads: new Map() }
  }

  if (pages.length === 1) {
    const p = pages[0]!
    const parts = splitHtml(p.html)
    return {
      templateHtml: p.html,
      blockCount: 1,
      payloads: new Map([[p.route, { '0': p.html }]]),
    }
  }

  // Separar head/body da referência
  const refParts = splitHtml(pages[0]!.html)
  const refBody = refParts.body

  // Para cada página: diff do body, head separado
  const allBlocks = new Map<number, Map<string, string>>()
  const allHeads = new Map<string, string>()
  let nextIdx = 0

  for (let i = 1; i < pages.length; i++) {
    const targetParts = splitHtml(pages[i]!.html)
    const targetBody = targetParts.body

    // Salvar head desta página
    allHeads.set(pages[i]!.route, targetParts.head)

    // Diff do body
    const blocks = diffTwoBodies(refBody, targetBody, nextIdx)

    for (const [idxStr, content] of Object.entries(blocks)) {
      const idx = parseInt(idxStr)
      if (!allBlocks.has(idx)) allBlocks.set(idx, new Map())
      allBlocks.get(idx)!.set(pages[i]!.route, content)
      nextIdx = Math.max(nextIdx, idx + 1)
    }
  }

  // Salvar head da referência também
  allHeads.set(pages[0]!.route, refParts.head)

  if (allBlocks.size === 0) {
    allBlocks.set(0, new Map())
    for (const p of pages) {
      allBlocks.get(0)!.set(p.route, splitHtml(p.html).body)
    }
    nextIdx = 1
  }

  // Construir template com marcadores
  const markedHtml = buildMarkedTemplate(
    pages[0]!.html,
    refBody,
    allBlocks,
    nextIdx,
  )

  // Gerar payloads com head + blocos body
  const payloads = new Map<string, Record<string, string>>()

  for (const page of pages) {
    const payload: Record<string, string> = {}

    // Head da página
    payload['head'] = allHeads.get(page.route) || ''

    // Blocos do body
    for (let i = 0; i < nextIdx; i++) {
      const val = allBlocks.get(i)?.get(page.route)
      payload[String(i)] = val !== undefined ? val : ''
    }

    payloads.set(page.route, payload)
  }

  return {
    templateHtml: markedHtml,
    blockCount: nextIdx,
    payloads,
  }
}

function diffTwoBodies(
  refBody: string,
  targetBody: string,
  startIdx: number,
): Record<string, string> {
  const blocks: Record<string, string> = {}
  const commons = findAllCommonBlocks(refBody, targetBody, 128)

  if (commons.length === 0) {
    blocks[String(startIdx)] = targetBody
    return blocks
  }

  let bIdx = startIdx
  let refPos = 0
  let tgtPos = 0

  for (const c of commons) {
    if (c.aStart > refPos || c.bStart > tgtPos) {
      const tgtDiff = targetBody.substring(tgtPos, c.bStart)
      if (tgtDiff.trim().length > 0) {
        blocks[String(bIdx)] = tgtDiff
        bIdx++
      }
    }
    refPos = c.aStart + c.length
    tgtPos = c.bStart + c.length
  }

  const tgtRest = targetBody.substring(tgtPos)
  if (tgtRest.trim().length > 0) {
    blocks[String(bIdx)] = tgtRest
    bIdx++
  }

  return blocks
}

/**
 * Reconstrói HTML da referência com marcadores <!--NL:N--> no body.
 */
function buildMarkedTemplate(
  fullHtml: string,
  refBody: string,
  allBlocks: Map<number, Map<string, string>>,
  blockCount: number,
): string {
  // Encontrar posição do <body> no HTML completo
  const bodyOpenMatch = fullHtml.match(/<body[^>]*>/i)
  const bodyCloseMatch = fullHtml.match(/<\/body>/i)

  if (!bodyOpenMatch || !bodyCloseMatch) return fullHtml

  const bodyStartIdx = bodyOpenMatch.index! + bodyOpenMatch[0].length
  const bodyEndIdx = bodyCloseMatch.index!

  // Para cada bloco, encontrar onde aparece no refBody e substituir
  let markedBody = refBody
  const processed = new Set<string>()

  for (let i = 0; i < blockCount; i++) {
    const blockMap = allBlocks.get(i)
    if (!blockMap) continue

    for (const [route, content] of blockMap) {
      if (content.length === 0) continue
      if (processed.has(content)) continue

      const pos = markedBody.indexOf(content)
      if (pos !== -1) {
        const marker = `<!--NL:${i}-->`
        markedBody =
          markedBody.substring(0, pos) + marker + markedBody.substring(pos + content.length)
        processed.add(content)
        break
      }
    }
  }

  // Reconstruir HTML completo
  return (
    fullHtml.substring(0, bodyStartIdx) +
    markedBody +
    fullHtml.substring(bodyEndIdx)
  )
}
