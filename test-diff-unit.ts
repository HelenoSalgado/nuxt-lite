/**
 * test-diff.ts — Testes unitários para o sistema de diff
 */
import { splitHtml, diffGroup } from './src/html/diff'

// ============================================================================
// Helpers
// ============================================================================

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${msg}`)
}

// ============================================================================
// Test 1: splitHtml
// ============================================================================

function testSplitHtml() {
  console.log('\n=== Test 1: splitHtml ===\n')

  const html = `<!DOCTYPE html><html><head><title>Test</title><meta charset="utf-8"></head><body><header>Nav</header><main>Content</main><footer>Foot</footer></body></html>`

  const parts = splitHtml(html)

  assert(parts.head.includes('<title>Test</title>'), 'splitHtml: head contém title')
  assert(parts.head.includes('<meta charset'), 'splitHtml: head contém meta')
  assert(parts.body.includes('<header>Nav</header>'), 'splitHtml: body contém header')
  assert(parts.body.includes('<main>Content</main>'), 'splitHtml: body contém main')
  assert(parts.body.includes('<footer>Foot</footer>'), 'splitHtml: body contém footer')
  assert(!parts.body.includes('<head>'), 'splitHtml: body NÃO contém <head>')
  assert(!parts.head.includes('<body>'), 'splitHtml: head NÃO contém <body>')
}

// ============================================================================
// Test 2: Páginas idênticas → zero blocos variáveis
// ============================================================================

function testIdenticalPages() {
  console.log('\n=== Test 2: Páginas idênticas ===\n')

  const body = '<header>Nav</header><main>Content</main><footer>Foot</footer>'
  const head1 = '<head><title>Page 1</title></head>'
  const head2 = '<head><title>Page 2</title></head>'

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

  // Bodies idênticos → todos blocos devem ser vazios (exceto head)
  const nonHeadKeys1 = Object.keys(p1).filter(k => k !== 'head')
  const nonEmpty1 = nonHostKeys1.filter(k => p1[k] && p1[k].length > 0)
  assert(nonEmpty1.length === 0, `Páginas idênticas: page1 não tem blocos body não-vazios (got ${nonEmpty1})`)
}

const nonHostKeys1 = nonHostKeys1 // fix typo below
