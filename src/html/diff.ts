/**
 * diff.ts — LCS iterativo acumulativo 1-para-muitos
 *
 * Algoritmo (conforme DESIGN.md):
 * 1. Referência = primeira página do grupo
 * 2. Para cada outra página: encontrar substrings comuns
 * 3. Gaps entre substrings comuns = conteúdo variável
 * 4. Inserir marcadores <!--NL:N--> na referência nos gaps
 * 5. Payload de cada página = conteúdo variável (vazio se ausente)
 */

// ============================================================================
// splitHtml
// ============================================================================

export interface HtmlParts {
  head: string
  body: string
  full: string
}

export function splitHtml(html: string): HtmlParts {
  const headMatch = html.match(/(<head[\s\S]*?<\/head>)/i)
  const bodyMatch = html.match(/(<body[\s\S]*?>)([\s\S]*?)(<\/body>)/i)
  return {
    head: headMatch ? headMatch[1] : '',
    body: bodyMatch ? bodyMatch[2] : '',
    full: html,
  }
}

// ============================================================================
// Longest Common Substring — encontra MAIOR bloco comum entre dois strings
// ============================================================================

function findLongestCommonSubstring(
  a: string,
  b: string,
): { aStart: number; bStart: number; length: number } | null {
  // Para HTML minificado, usar abordagem prática: buscar por strings de fechamento
  // de tags como âncoras e estender
  const minLength = 128

  let bestA = -1
  let bestB = -1
  let bestLen = 0

  // Estratégia: para cada posição i em A, buscar match em B
  // Otimização: buscar por blocos de chars que são provavelmente únicos
  for (let i = 0; i <= a.length - minLength; i += 16) {
    // Buscar a[i..i+minLength] em B
    const chunk = a.substring(i, i + minLength)
    let j = b.indexOf(chunk)

    if (j !== -1) {
      // Encontrou match exato do chunk — estender para frente e para trás
      let fwd = minLength
      while (i + fwd < a.length && j + fwd < b.length && a[i + fwd] === b[j + fwd]) {
        fwd++
      }
      let back = 0
      while (i - back > 0 && j - back > 0 && a[i - back - 1] === b[j - back - 1]) {
        back++
      }
      const total = fwd + back
      if (total > bestLen) {
        bestA = i - back
        bestB = j - back
        bestLen = total
      }
    } else {
      // Tentar substring menor (75% do chunk)
      const smaller = a.substring(i, i + Math.floor(minLength * 0.75))
      if (smaller.length >= 64) {
        j = b.indexOf(smaller)
        if (j !== -1) {
          let fwd = smaller.length
          while (i + fwd < a.length && j + fwd < b.length && a[i + fwd] === b[j + fwd]) {
            fwd++
          }
          let back = 0
          while (i - back > 0 && j - back > 0 && a[i - back - 1] === b[j - back - 1]) {
            back++
          }
          const total = fwd + back
          if (total > bestLen && total >= minLength) {
            bestA = i - back
            bestB = j - back
            bestLen = total
          }
        }
      }
    }
  }

  if (bestLen < minLength) return null
  return { aStart: bestA, bStart: bestB, length: bestLen }
}

// ============================================================================
// Encontrar TODOS os blocos comuns (iterativo)
// ============================================================================

interface CommonBlock {
  aStart: number
  aEnd: number
  bStart: number
  bEnd: number
}

function findAllCommonBlocks(a: string, b: string, minLength: number): CommonBlock[] {
  const blocks: CommonBlock[] = []
  let aOff = 0
  let bOff = 0
  let remA = a
  let remB = b

  while (remA.length >= minLength && remB.length >= minLength) {
    const common = findLongestCommonSubstring(remA, remB)
    if (!common || common.length < minLength) break

    blocks.push({
      aStart: aOff + common.aStart,
      aEnd: aOff + common.aStart + common.length,
      bStart: bOff + common.bStart,
      bEnd: bOff + common.bStart + common.length,
    })

    const skipA = common.aStart + common.length
    const skipB = common.bStart + common.length
    remA = remA.substring(skipA)
    remB = remB.substring(skipB)
    aOff += skipA
    bOff += skipB
  }

  return blocks
}

// ============================================================================
// Diff de dois bodies
// ============================================================================

export interface BodyDiffResult {
  gaps: Array<{ index: number; position: number; targetContent: string }>
  blocks: Record<number, string>
}

export function diffTwoBodies(
  refBody: string,
  targetBody: string,
  startIdx: number,
): BodyDiffResult {
  const gaps: BodyDiffResult['gaps'] = []
  const blocks: BodyDiffResult['blocks'] = {}

  const minLength = 256
  const commonBlocks = findAllCommonBlocks(refBody, targetBody, minLength)

  if (commonBlocks.length === 0) {
    // Sem blocos comuns → body inteiro é variável
    blocks[String(startIdx)] = targetBody
    gaps.push({ index: startIdx, position: 0, targetContent: targetBody })
    return { gaps, blocks }
  }

  let bIdx = startIdx
  let refPos = 0
  let tgtPos = 0

  for (const cb of commonBlocks) {
    // Gap na referência: de refPos até início do bloco comum
    // Gap no alvo: de tgtPos até início do bloco comum
    const tgtContent = targetBody.substring(tgtPos, cb.bStart)

    if (tgtContent.trim().length > 0) {
      blocks[String(bIdx)] = tgtContent
      // Inserir marcador ONDE o bloco comum começa na referência
      gaps.push({ index: bIdx, position: cb.aStart, targetContent: tgtContent })
      bIdx++
    }

    refPos = cb.aEnd
    tgtPos = cb.bEnd
  }

  // Resto após último bloco comum
  const tgtRest = targetBody.substring(tgtPos)
  if (tgtRest.trim().length > 0) {
    blocks[String(bIdx)] = tgtRest
    gaps.push({ index: bIdx, position: refBody.length, targetContent: tgtRest })
    bIdx++
  }

  return { gaps, blocks }
}

// ============================================================================
// 1-para-muitos acumulativo
// ============================================================================

export interface GroupDiffResult {
  templateHtml: string
  blockCount: number
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
    return {
      templateHtml: p.html,
      blockCount: 1,
      payloads: new Map([[p.route, { '0': p.html }]]),
    }
  }

  // Separar head/body da referência
  const refParts = splitHtml(pages[0]!.html)
  const refBody = refParts.body
  const refHead = refParts.head

  // Acumular gaps por posição na referência
  // position (char na ref) → { index, targetContent por rota }
  const gapsByPosition = new Map<number, { index: number; contents: Map<string, string> }>()
  const allHeads = new Map<string, string>()
  let nextIdx = 0

  allHeads.set(pages[0]!.route, refHead)

  for (let i = 1; i < pages.length; i++) {
    const targetParts = splitHtml(pages[i]!.html)
    allHeads.set(pages[i]!.route, targetParts.head)

    const result = diffTwoBodies(refBody, targetParts.body, 0)

    for (const gap of result.gaps) {
      if (!gapsByPosition.has(gap.position)) {
        gapsByPosition.set(gap.position, { index: nextIdx, contents: new Map() })
        nextIdx++
      }

      const actualIdx = gapsByPosition.get(gap.position)!.index
      gapsByPosition.get(gap.position)!.contents.set(pages[i]!.route, gap.targetContent)
    }
  }

  if (gapsByPosition.size === 0) {
    gapsByPosition.set(0, { index: 0, contents: new Map() })
    for (const p of pages) {
      gapsByPosition.get(0)!.contents.set(p.route, splitHtml(p.html).body)
    }
    nextIdx = 1
  }

  // Construir template: injetar marcadores na referência
  // Ordenar do final para o início para não deslocar posições
  const sortedGaps = Array.from(gapsByPosition.entries()).sort((a, b) => b[0] - a[0])

  let markedBody = refBody
  for (const [position, gapInfo] of sortedGaps) {
    const marker = `<!--NL:${gapInfo.index}-->`
    markedBody = markedBody.substring(0, position) + marker + markedBody.substring(position)
  }

  // Reconstruir HTML completo
  const bodyOpenMatch = pages[0]!.html.match(/<body[^>]*>/i)
  const bodyCloseMatch = pages[0]!.html.match(/<\/body>/i)

  let markedHtml: string
  if (bodyOpenMatch && bodyCloseMatch) {
    const bodyStartIdx = bodyOpenMatch.index! + bodyOpenMatch[0].length
    const bodyEndIdx = bodyCloseMatch.index!
    markedHtml =
      pages[0]!.html.substring(0, bodyStartIdx) +
      markedBody +
      pages[0]!.html.substring(bodyEndIdx)
  } else {
    markedHtml = pages[0]!.html
  }

  // Gerar payloads — TODOS os índices para TODAS as páginas
  const payloads = new Map<string, Record<string, string>>()

  for (const page of pages) {
    const payload: Record<string, string> = {}
    payload['head'] = allHeads.get(page.route) || ''

    for (let i = 0; i < nextIdx; i++) {
      // Encontrar gap que corresponde a este índice
      let content = ''
      for (const [, gapInfo] of gapsByPosition) {
        if (gapInfo.index === i) {
          const c = gapInfo.contents.get(page.route)
          if (c !== undefined) {
            content = c
            break
          }
        }
      }
      payload[String(i)] = content
    }

    payloads.set(page.route, payload)
  }

  return {
    templateHtml: markedHtml,
    blockCount: nextIdx,
    payloads,
  }
}
