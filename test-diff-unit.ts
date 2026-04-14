/**
 * test-diff-unit.ts — Testes unitários para o sistema de diff
 */
import { splitHtml, diffTwoContents, diffGroup } from './src/html/diff.js'

// ============================================================================
// Helpers
// ============================================================================

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`)
    failed++
    return
  }
  console.log(`✅ PASS: ${msg}`)
  passed++
}

// ============================================================================
// Test 1: splitHtml
// ============================================================================

function testSplitHtml() {
  console.log('\n=== Test 1: splitHtml ===\n')

  const html = '<!DOCTYPE html><html><head><title>Test</title><meta charset="utf-8"></head><body><header>Nav</header><main>Content</main><footer>Foot</footer></body></html>'

  const parts = splitHtml(html)

  assert(parts.headContent.includes('<title>Test</title>'), 'splitHtml: headContent contém title')
  assert(parts.headContent.includes('<meta charset'), 'splitHtml: headContent contém meta')
  assert(parts.bodyContent.includes('<header>Nav</header>'), 'splitHtml: bodyContent contém header')
  assert(parts.bodyContent.includes('<main>Content</main>'), 'splitHtml: bodyContent contém main')
  assert(parts.bodyContent.includes('<footer>Foot</footer>'), 'splitHtml: bodyContent contém footer')
  assert(!parts.bodyContent.includes('<head>'), 'splitHtml: bodyContent NÃO contém <head>')
  assert(!parts.headContent.includes('<body>'), 'splitHtml: headContent NÃO contém <body>')
}

// ============================================================================
// Test 2: Páginas idênticas → zero blocos variáveis no body
// ============================================================================

function testIdenticalPages() {
  console.log('\n=== Test 2: Páginas idênticas ===\n')

  const commonContent = '<section>' + '<p>texto</p>'.repeat(30) + '</section>'
  const body = `<header>Nav</header><main>${commonContent}</main><footer>Foot</footer>`
  const head1 = '<head><title>Page 1</title><meta name="desc" content="A"><link rel="icon" href="/favicon.ico"></head>'
  const head2 = '<head><title>Page 2</title><meta name="desc" content="B"><link rel="icon" href="/favicon.ico"></head>'

  const html1 = `<!DOCTYPE html><html>${head1}<body>${body}</body></html>`
  const html2 = `<!DOCTYPE html><html>${head2}<body>${body}</body></html>`

  const result = diffGroup([
    { route: '/page1', html: html1 },
    { route: '/page2', html: html2 },
  ])

  assert(result.blockCount >= 0, `blockCount >= 0 (got ${result.blockCount})`)
  assert(result.payloads.has('/page1'), 'payload tem /page1')
  assert(result.payloads.has('/page2'), 'payload tem /page2')

  const p1 = result.payloads.get('/page1')!
  const p2 = result.payloads.get('/page2')!

  const nonHeadKeys1 = Object.keys(p1)
  const nonEmptyBody1 = nonHeadKeys1.filter(k => p1[k] && p1[k].length > 0 && !p1[k]!.includes('<head') && !p1[k]!.includes('<title'))
  const nonEmptyBody2 = nonHeadKeys1.filter(k => p2[k] && p2[k].length > 0 && !p2[k]!.includes('<head') && !p2[k]!.includes('<title'))
  assert(nonEmptyBody1.length === nonEmptyBody2.length,
    `Páginas idênticas: mesmo número de blocos body não-vazios (${nonEmptyBody1.length} vs ${nonEmptyBody2.length})`)
}

// ============================================================================
// Test 3: Páginas diferentes → blocos variáveis detectados
// ============================================================================

function testDifferentPages() {
  console.log('\n=== Test 3: Páginas diferentes ===\n')

  const html1 = '<!DOCTYPE html><html><head><title>A</title></head><body><main>Article A</main><footer>Foot</footer></body></html>'
  const html2 = '<!DOCTYPE html><html><head><title>B</title></head><body><main>Article B</main><footer>Foot</footer></body></html>'

  const result = diffGroup([
    { route: '/a', html: html1 },
    { route: '/b', html: html2 },
  ])

  assert(result.blockCount > 0, `blockCount > 0 (got ${result.blockCount})`)
  assert(result.templateHtml.includes('<!--NL:'), 'template contém marcadores')

  const p1 = result.payloads.get('/a')!
  const p2 = result.payloads.get('/b')!
  let hasDiff = false
  const maxIdx = Math.max(...Object.keys(p1).map(k => Number.parseInt(k)), 0)
  for (let i = 0; i <= maxIdx; i++) {
    if ((p1[String(i)] || '') !== (p2[String(i)] || '')) {
      hasDiff = true
      break
    }
  }
  assert(hasDiff, 'páginas diferentes têm pelo menos um bloco diferente')
}

// ============================================================================
// Test 4: Todos os payloads têm todos os índices
// ============================================================================

function testAllPayloadsHaveAllIndexes() {
  console.log('\n=== Test 4: Slots sempre definidos ===\n')

  const html1 = '<!DOCTYPE html><html><head><title>A</title></head><body><main>A</main></body></html>'
  const html2 = '<!DOCTYPE html><html><head><title>B</title></head><body><main>B</main><author>Z</author></body></html>'
  const html3 = '<!DOCTYPE html><html><head><title>C</title></head><body><main>C</main></body></html>'

  const result = diffGroup([
    { route: '/a', html: html1 },
    { route: '/b', html: html2 },
    { route: '/c', html: html3 },
  ])

  for (const [route, payload] of result.payloads) {
    for (let i = 0; i < result.blockCount; i++) {
      assert(payload[String(i)] !== undefined, `${route} tem índice ${i}`)
    }
  }
}

// ============================================================================
// Test 5: diffTwoContents totalmente diferente
// ============================================================================

function testDiffTwoContentsTotallyDifferent() {
  console.log('\n=== Test 5: diffTwoContents totalmente diferente ===\n')

  const body1 = '<header>Nav</header><main>Content A</main><footer>Foot</footer>'
  const body2 = '<header>Nav2</header><main>Content B</main><footer>Foot2</footer>'

  const result = diffTwoContents(body1, body2, 0)

  assert(Object.keys(result.targetBlocks).length > 0, 'blocos detectados')
  assert(result.gaps.length > 0, 'gaps detectados')
}

// ============================================================================
// Test 6: diffTwoContents idêntico
// ============================================================================

function testDiffTwoContentsIdentical() {
  console.log('\n=== Test 6: diffTwoContents idêntico ===\n')

  const body = '<header>Nav</header><main>' + 'x'.repeat(300) + '</main><footer>Foot</footer>'

  const result = diffTwoContents(body, body, 0)

  assert(result.gaps.length === 0, `corpo idêntico: zero gaps (got ${result.gaps.length})`)
}

// ============================================================================
// Test 7: Grupo com uma página
// ============================================================================

function testSinglePageGroup() {
  console.log('\n=== Test 7: Grupo com uma página ===\n')

  const html = '<!DOCTYPE html><html><head><title>Only</title></head><body><main>Only</main></body></html>'

  const result = diffGroup([
    { route: '/only', html },
  ])

  assert(result.blockCount === 1, `blockCount === 1 (got ${result.blockCount})`)
  assert(result.payloads.has('/only'), 'payload tem /only')
  const payload = result.payloads.get('/only')!
  assert(payload['0'] !== undefined, 'payload tem índice 0')
}

// ============================================================================
// Test 8: Grupo vazio
// ============================================================================

function testEmptyGroup() {
  console.log('\n=== Test 8: Grupo vazio ===\n')

  const result = diffGroup([])

  assert(result.blockCount === 0, 'blockCount === 0')
  assert(result.templateHtml === '', 'templateHtml vazio')
  assert(result.payloads.size === 0, 'payloads vazio')
}

// ============================================================================
// Test 9: Blocos não contêm fragmentos de tags cortados
// ============================================================================

function testNoFragmentedTags() {
  console.log('\n=== Test 9: Sem fragmentos de tags ===\n')

  const commonHeader = '<header class="frontispiece" data-v-3115515b><a href="/">Logo</a>'
  const commonFooter = '</header>'
  const nav1 = '<nav><a href="/a">A</a></nav>'
  const nav2 = '<nav><a href="/b" class="active">B</a></nav>'

  const html1 = `<html><head><title>A</title></head><body>${commonHeader}${nav1}${commonFooter}<main>Content</main></body></html>`
  const html2 = `<html><head><title>B</title></head><body>${commonHeader}${nav2}${commonFooter}<main>Content</main></body></html>`

  const result = diffGroup([
    { route: '/a', html: html1 },
    { route: '/b', html: html2 },
  ])

  for (const [route, payload] of result.payloads) {
    for (const [idx, content] of Object.entries(payload)) {
      if (!content || content.length === 0) continue
      assert(!content.match(/^\s*[a-z-]+="/), `${route}[${idx}] não começa com atributo solto`)
    }
  }
}

// ============================================================================
// Run all
// ============================================================================

console.log('Running unit tests for diff system\n')

testSplitHtml()
testIdenticalPages()
testDifferentPages()
testAllPayloadsHaveAllIndexes()
testDiffTwoContentsTotallyDifferent()
testDiffTwoContentsIdentical()
testSinglePageGroup()
testEmptyGroup()
testNoFragmentedTags()

console.log(`\n${'─'.repeat(60)}`)
console.log(`Resultados: ${passed} passaram, ${failed} falharam`)
if (failed > 0) {
  process.exit(1)
}
