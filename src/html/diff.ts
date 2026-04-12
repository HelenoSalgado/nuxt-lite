/**
 * diff.ts — LCS iterativo acumulativo 1-para-muitos
 */

import { prettyPrintHtml } from './pretty-print'

function findAllCommonBlocks(
  a: string,
  b: string,
  minLength: number,
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
  const linesA = a.split('\n')
  const linesB = b.split('\n')

  const bLineMap = new Map<string, number[]>()
  for (let i = 0; i < linesB.length; i++) {
    const line = linesB[i]!.trim()
    if (!bLineMap.has(line)) bLineMap.set(line, [])
    bLineMap.get(line)!.push(i)
  }

  let bestA = 0
  let bestB = 0
  let bestLen = 0

  for (let i = 0; i < linesA.length; i++) {
    const line = linesA[i]!.trim()
    const positions = bLineMap.get(line)
    if (!positions) continue

    for (const j of positions) {
      let len = 0
      while (
        i + len < linesA.length &&
        j + len < linesB.length &&
        linesA[i + len]!.trim() === linesB[j + len]!.trim()
      ) {
        len++
      }
      if (len > bestLen) {
        bestA = i
        bestB = j
        bestLen = len
      }
    }
  }

  if (bestLen === 0) return null

  let charA = 0
  for (let i = 0; i < bestA; i++) charA += linesA[i]!.length + 1
  let charB = 0
  for (let i = 0; i < bestB; i++) charB += linesB[i]!.length + 1
  let charLen = 0
  for (let i = 0; i < bestLen; i++) charLen += linesA[bestA + i]!.length + 1

  if (charLen < minLength) return null
  return { aStart: charA, bStart: charB, length: charLen }
}

export interface DiffBlock {
  index: number
  contents: Map<string, string>
}

export interface GroupDiffResult {
  templateHtml: string
  blockCount: number
  payloads: Map<string, Record<string, string>>
  blocks: DiffBlock[]
}

export function diffGroup(
  pages: Array<{ route: string; html: string }>,
): GroupDiffResult {
  if (pages.length === 0) {
    return { templateHtml: '', blockCount: 0, payloads: new Map(), blocks: [] }
  }

  if (pages.length === 1) {
    const p = pages[0]!
    return {
      templateHtml: p.html,
      blockCount: 1,
      payloads: new Map([[p.route, { '0': p.html }]]),
      blocks: [{ index: 0, contents: new Map([[p.route, p.html]]) }],
    }
  }

  const prettyPages = pages.map(p => ({
    route: p.route,
    html: p.html,
    pretty: prettyPrintHtml(p.html),
  }))

  const allBlocks = new Map<number, Map<string, string>>()
  let nextIdx = 0

  for (let i = 1; i < prettyPages.length; i++) {
    const ref = prettyPages[0]!
    const target = prettyPages[i]!
    const blocks = diffTwo(ref.pretty, target.pretty, nextIdx)

    for (const [idxStr, content] of Object.entries(blocks)) {
      const idx = parseInt(idxStr)
      if (!allBlocks.has(idx)) allBlocks.set(idx, new Map())
      allBlocks.get(idx)!.set(target.route, content)
      nextIdx = Math.max(nextIdx, idx + 1)
    }
  }

  if (allBlocks.size === 0) {
    allBlocks.set(0, new Map())
    for (const p of prettyPages) {
      allBlocks.get(0)!.set(p.route, p.html)
    }
    nextIdx = 1
  }

  const payloads = new Map<string, Record<string, string>>()
  for (const page of pages) {
    const payload: Record<string, string> = {}
    for (let i = 0; i < nextIdx; i++) {
      const val = allBlocks.get(i)?.get(page.route)
      payload[String(i)] = val !== undefined ? val : ''
    }
    payloads.set(page.route, payload)
  }

  const blocks: DiffBlock[] = []
  for (let i = 0; i < nextIdx; i++) {
    blocks.push({ index: i, contents: allBlocks.get(i) || new Map() })
  }

  return {
    templateHtml: prettyPages[0]!.html,
    blockCount: nextIdx,
    payloads,
    blocks,
  }
}

function diffTwo(
  ref: string,
  target: string,
  startIdx: number,
): Record<string, string> {
  const blocks: Record<string, string> = {}
  const commons = findAllCommonBlocks(ref, target, 32)

  if (commons.length === 0) {
    blocks[String(startIdx)] = target
    return blocks
  }

  let bIdx = startIdx
  let refPos = 0
  let tgtPos = 0

  for (const c of commons) {
    if (c.aStart > refPos || c.bStart > tgtPos) {
      const tgtDiff = target.substring(tgtPos, c.bStart)
      if (tgtDiff.trim().length > 0) {
        blocks[String(bIdx)] = tgtDiff
        bIdx++
      }
    }
    refPos = c.aStart + c.length
    tgtPos = c.bStart + c.length
  }

  const tgtRest = target.substring(tgtPos)
  if (tgtRest.trim().length > 0) {
    blocks[String(bIdx)] = tgtRest
    bIdx++
  }

  return blocks
}
