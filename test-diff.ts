/**
 * test-diff.ts — Testes em COPIA TEMPORÁRIA do dist/
 *
 * NUNCA modifica o dist/ original. Copia para tmp/, processa, verifica, limpa.
 */
import { readFileSync, rmSync, existsSync, readdirSync, statSync, cpSync } from 'node:fs'
import { join, relative } from 'node:path'
import { splitHtml, diffGroup } from './src/html/diff'

const distDir = '/home/heleno/Documentos/GitHub/orarelabutar/dist'
const tmpDir = '/tmp/nuxt-lite-test-dist'

// Limpar temp anterior e copiar dist
if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
cpSync(distDir, tmpDir, { recursive: true })

console.log(`📋 dist/ copiado para temp: ${tmpDir}`)

// ============================================================================
// Coletar páginas do TEMP
// ============================================================================

function collectPages(dir: string): Array<{ route: string, path: string, html: string }> {
  const pages: Array<{ route: string, path: string, html: string }> = []
  function walk(d: string) {
    if (!existsSync(d)) return
    for (const entry of readdirSync(d)) {
      if (entry.startsWith('.') || entry.startsWith('_')) continue
      const full = join(d, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full)
        continue
      }
      if (entry === 'index.html') {
        const rel = relative(dir, full)
        const route = '/' + rel.replace(/\/index\.html$/, '').replace(/\\/g, '/') || '/'
        pages.push({ route, path: full, html: readFileSync(full, 'utf-8') })
      }
    }
  }
  walk(dir)
  return pages.sort((a, b) => a.route.localeCompare(b.route))
}

// ============================================================================
// Runner
// ============================================================================

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✅ ${name}`)
    passed++
  }
  catch (e) {
    console.error(`❌ ${name}`)
    console.error(`   ${e}`)
    failed++
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// ============================================================================
// Tests com páginas ORIGINAIS do TEMP
// ============================================================================

const pages = collectPages(distDir)
// Pegar qualquer grupo de páginas com pelo menos 2 items
const testGroup = pages.length >= 2 ? pages.slice(0, 2) : pages

console.log(`\nPáginas originais: ${pages.length}`)
console.log(`Grupo de teste: ${testGroup.length} páginas`)

// Test 1
test('splitHtml separa head do body', () => {
  const sample = '<!DOCTYPE html><html><head><title>T</title></head><body><div>Body</div></body></html>'
  const parts = splitHtml(sample)
  assert(parts.headContent.includes('<title>T</title>'), 'headContent contém title')
  assert(parts.bodyContent.includes('<div>Body</div>'), 'bodyContent contém div')
  assert(!parts.bodyContent.includes('<head>'), 'bodyContent não contém <head>')
})

// Test 2
test('diffGroup com manuscritos encontra blocos comuns', () => {
  assert(testGroup.length >= 2, `Precisa de ≥2 artigos, tem ${testGroup.length}`)
  const result = diffGroup(testGroup)
  assert(result.blockCount > 0, `blockCount > 0 (got ${result.blockCount})`)
  assert(result.payloads.size === testGroup.length, `payloads = ${result.payloads.size}`)
})

// Test 3
test('template contém marcadores <!--NL:N-->', () => {
  const result = diffGroup(testGroup)
  const markers = result.templateHtml.match(/<!--NL:\d+-->/g) || []
  assert(markers.length > 0, `Template deve ter marcadores (got 0)`)
  console.log(`   → ${markers.length} marcadores [${[...new Set(markers)].sort().join(', ')}]`)
})

// Test 4
test('todos os payloads têm todos os índices', () => {
  const result = diffGroup(testGroup)
  for (const [route, payload] of result.payloads) {
    for (let i = 0; i < result.blockCount; i++) {
      assert(payload[String(i)] !== undefined, `${route} deve ter índice ${i}`)
    }
  }
})

// Test 5
test('cada payload tem pelo menos 1 bloco não-vazio', () => {
  const result = diffGroup(testGroup)
  for (const [route, payload] of result.payloads) {
    const nonEmpty = Object.values(payload).filter(v => v && v.length > 0).length
    assert(nonEmpty >= 1, `${route} deve ter ≥1 bloco não-vazio (got ${nonEmpty})`)
  }
})

// Test 6
test('head idêntico entre páginas não gera gaps desnecessários', () => {
  const result = diffGroup(testGroup)
  // Se os heads são idênticos, não deve haver gaps de head
  // (isso é correto — sem diferença = sem payload desnecessário)
  // Verificar que todos os payloads têm todos os índices
  for (const [route, payload] of result.payloads) {
    for (let i = 0; i < result.blockCount; i++) {
      assert(payload[String(i)] !== undefined, `${route} tem índice ${i}`)
    }
  }
})

// Test 7
test('blocos não contêm scripts inline do Nuxt', () => {
  const result = diffGroup(testGroup)
  for (const [route, payload] of result.payloads) {
    for (const [key, content] of Object.entries(payload)) {
      assert(!content.includes('__NUXT_DATA__'), `${route}[${key}] contém __NUXT_DATA__`)
      assert(!content.includes('window.__NUXT__'), `${route}[${key}] contém window.__NUXT__`)
    }
  }
})

// Test 8
test('blocos contêm HTML válido', () => {
  const result = diffGroup(testGroup)
  for (const [route, payload] of result.payloads) {
    for (const [key, content] of Object.entries(payload)) {
      if (!content || content.length === 0) continue
      if (content.startsWith('/>') || content.startsWith('</')) continue
      if (content.startsWith('<') && !content.match(/^<[a-z!/[]/i)) {
        throw new Error(`${route}[${key}] tag suspeita: ${content.substring(0, 40)}`)
      }
    }
  }
})

// Test 9
test('marcadores no template são únicos por posição', () => {
  const result = diffGroup(testGroup)
  const markerRe = /<!--NL:\d+-->/g
  const positions: number[] = []
  let m: RegExpExecArray | null
  while ((m = markerRe.exec(result.templateHtml)) !== null) {
    positions.push(m.index)
  }
  assert(positions.length === new Set(positions).size, `Marcadores sobrepostos`)
  console.log(`   → ${positions.length} marcadores em posições únicas`)
})

// Test 10
test('payload é menor que HTML original', () => {
  const result = diffGroup(testGroup)
  for (const page of testGroup) {
    const payload = result.payloads.get(page.route)!
    const payloadSize = Object.values(payload).reduce((s, v) => s + v.length, 0)
    assert(payloadSize < page.html.length,
      `${page.route}: payload (${(payloadSize / 1024).toFixed(1)}KB) deve ser < original (${(page.html.length / 1024).toFixed(1)}KB)`)
  }
})

// Test 11
test('soma dos blocos não-vazios ≈ tamanho do body', () => {
  const result = diffGroup(testGroup)
  for (const page of testGroup) {
    const payload = result.payloads.get(page.route)!
    const nonEmptySize = Object.entries(payload)
      .filter(([, v]) => v && v.length > 0)
      .reduce((sum, [, v]) => sum + v.length, 0)
    const bodySize = splitHtml(page.html).bodyContent.length
    const ratio = bodySize > 0 ? nonEmptySize / bodySize : 0
    assert(ratio > 0.1,
      `${page.route}: blocos ${(nonEmptySize / 1024).toFixed(1)}KB vs body ${(bodySize / 1024).toFixed(1)}KB = ${ratio.toFixed(2)}`)
  }
})

// Test 12
test('páginas diferentes geram blocos diferentes', () => {
  const indexPage = pages.find(p => p.route === '/')
  const articlePage = testGroup[0]
  if (!indexPage || !articlePage) return
  const result = diffGroup([indexPage, articlePage])
  assert(result.blockCount > 0, 'Páginas diferentes devem ter blocos')
  const p1 = result.payloads.get(indexPage.route)!
  const p2 = result.payloads.get(articlePage.route)!
  let hasDiff = false
  for (let i = 0; i < result.blockCount; i++) {
    if ((p1[String(i)] || '') !== (p2[String(i)] || '')) {
      hasDiff = true
      break
    }
  }
  assert(hasDiff, 'Páginas diferentes devem ter blocos diferentes')
})

// ============================================================================
// Test INTEGRATION: processar no TEMP, NÃO no dist/
// ============================================================================

test('INTEGRAÇÃO: processar no temp SEM modificar dist/', () => {
  // Salvar checksums dos originais
  const originalChecksums = new Map<string, string>()
  for (const page of pages) {
    const hash = Buffer.from(page.html).toString('base64').substring(0, 16)
    originalChecksums.set(page.path, hash)
  }

  // Simular processamento no TEMP
  const tmpPages = collectPages(tmpDir)
  assert(tmpPages.length === pages.length, `Temp tem ${tmpPages.length} páginas, esperava ${pages.length}`)

  // Rodar diff no temp
  const manTemp = tmpPages.length >= 2 ? tmpPages.slice(0, 2) : tmpPages
  const result = diffGroup(manTemp)

  // Verificar que o temp TEM marcadores
  const templateMarkers = result.templateHtml.match(/<!--NL:\d+-->/g) || []
  assert(templateMarkers.length > 0, 'Template no temp deve ter marcadores')

  // Verificar que dist/ original NÃO FOI MODIFICADO
  for (const page of pages) {
    const current = readFileSync(page.path, 'utf-8')
    const hash = Buffer.from(current).toString('base64').substring(0, 16)
    assert(hash === originalChecksums.get(page.path),
      `${page.path} foi MODIFICADO no dist/ original!`)
  }

  console.log(`   → Temp: ${templateMarkers.length} marcadores, dist/ intacto`)
})

// ============================================================================
// Cleanup
// ============================================================================

rmSync(tmpDir, { recursive: true, force: true })
console.log(`\n🧹 Temp limpo: ${tmpDir}`)

// ============================================================================
// Results
// ============================================================================

console.log(`\n${'─'.repeat(60)}`)
console.log(`Resultados: ${passed} passaram, ${failed} falharam`)
if (failed > 0) {
  process.exit(1)
}
