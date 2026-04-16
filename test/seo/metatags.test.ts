import { describe, it, expect } from 'vitest'
import { extractMetaTags, analyzeMetaTags, processSeoMeta, replicateMissingTags, autoInjectMissingTags } from '../../src/seo/metatags'

// ============================================================================
// Fixture HTML
// ============================================================================

const GOOD_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Página de Teste - Título Otimizado</title>
  <meta name="description" content="Esta é uma descrição otimizada com 120 a 160 caracteres para SEO.">
  <link rel="canonical" href="https://example.com/">
  <meta property="og:title" content="Página de Teste - Título Otimizado">
  <meta property="og:description" content="Esta é uma descrição otimizada com 120 a 160 caracteres para SEO.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://example.com/">
  <meta property="og:image" content="https://example.com/image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Página de Teste - Título Otimizado">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <main><h1>Conteúdo</h1><p>Texto</p></main>
</body>
</html>
`

const BAD_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Curto</title>
  <meta name="keywords" content="test, seo">
  <meta name="revised" content="2024">
</head>
<body>
  <main><h1>Conteúdo</h1><p>Texto</p></main>
</body>
</html>
`

const MINIMAL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Título da Página com Tamanho Adequado para Teste</title>
</head>
<body>
  <main><h1>Conteúdo</h1></main>
</body>
</html>
`

// ============================================================================
// extractMetaTags
// ============================================================================

describe('extractMetaTags', () => {
  it('extracts all meta tags correctly', () => {
    const meta = extractMetaTags(GOOD_HTML)
    expect(meta.title).toBe('Página de Teste - Título Otimizado')
    expect(meta.description).toContain('descrição otimizada')
    expect(meta.canonical).toBe('https://example.com/')
    expect(meta.charset).toBe('utf-8')
    expect(meta.viewport).toContain('width=device-width')
    expect(meta.og.title).toBe('Página de Teste - Título Otimizado')
    expect(meta.twitter.card).toBe('summary_large_image')
  })

  it('handles missing meta tags', () => {
    const meta = extractMetaTags(MINIMAL_HTML)
    expect(meta.title).toBe('Título da Página com Tamanho Adequado para Teste')
    expect(meta.description).toBeUndefined()
    expect(meta.canonical).toBeUndefined()
    expect(meta.charset).toBeUndefined()
    expect(Object.keys(meta.og)).toHaveLength(0)
    expect(Object.keys(meta.twitter)).toHaveLength(0)
  })
})

// ============================================================================
// analyzeMetaTags
// ============================================================================

describe('analyzeMetaTags', () => {
  it('returns good score for well-optimized HTML', () => {
    const report = analyzeMetaTags(GOOD_HTML, '/')
    expect(report.score).toBeGreaterThanOrEqual(80)
    expect(report.issues.filter(i => i.severity === 'error')).toHaveLength(0)
  })

  it('detects missing meta tags', () => {
    const report = analyzeMetaTags(MINIMAL_HTML, '/')
    const errors = report.issues.filter(i => i.severity === 'error')
    expect(errors.length).toBeGreaterThan(0)
    expect(report.issues.some(i => i.rule.includes('description'))).toBe(true)
    expect(report.issues.some(i => i.rule.includes('og:'))).toBe(true)
    expect(report.issues.some(i => i.rule.includes('twitter:'))).toBe(true)
  })

  it('detects deprecated tags', () => {
    const report = analyzeMetaTags(BAD_HTML, '/')
    expect(report.issues.some(i => i.rule.includes('deprecated'))).toBe(true)
    expect(report.issues.some(i => i.message.includes('keywords'))).toBe(true)
  })

  it('detects short title', () => {
    const report = analyzeMetaTags(BAD_HTML, '/')
    expect(report.issues.some(i => i.rule.includes('too-short') || i.rule.includes('below-minimum'))).toBe(true)
  })
})

// ============================================================================
// replicateMissingTags
// ============================================================================

describe('replicateMissingTags', () => {
  it('auto-replicates title to og:title and twitter:title', () => {
    const meta = extractMetaTags(MINIMAL_HTML)
    const result = replicateMissingTags(MINIMAL_HTML, meta)
    expect(result.meta.og.title).toBe('Título da Página com Tamanho Adequado para Teste')
    // twitter:title é replicado a partir de og:title ou title
    expect(result.meta.twitter.title || result.meta.og.title).toBe('Título da Página com Tamanho Adequado para Teste')
    expect(result.html).toContain('property="og:title"')
    expect(result.html).toContain('name="twitter:title"')
  })

  it('does not overwrite existing tags', () => {
    const meta = extractMetaTags(GOOD_HTML)
    const originalOgTitle = meta.og.title
    const result = replicateMissingTags(GOOD_HTML, meta)
    expect(result.meta.og.title).toBe(originalOgTitle)
  })
})

// ============================================================================
// autoInjectMissingTags
// ============================================================================

describe('autoInjectMissingTags', () => {
  it('injects charset if missing', () => {
    const meta = extractMetaTags(MINIMAL_HTML)
    const result = autoInjectMissingTags(MINIMAL_HTML, meta, '/')
    expect(result.meta.charset).toBe('utf-8')
    expect(result.html).toContain('charset="utf-8"')
  })

  it('injects viewport if missing', () => {
    const meta = extractMetaTags(MINIMAL_HTML)
    const result = autoInjectMissingTags(MINIMAL_HTML, meta, '/')
    expect(result.meta.viewport).toBe('width=device-width, initial-scale=1')
    expect(result.html).toContain('name="viewport"')
  })

  it('injects og:type if missing', () => {
    const meta = extractMetaTags(MINIMAL_HTML)
    const result = autoInjectMissingTags(MINIMAL_HTML, meta, '/')
    expect(result.meta.og.type).toBe('website')
    expect(result.html).toContain('property="og:type"')
  })

  it('injects twitter:card if missing', () => {
    const meta = extractMetaTags(MINIMAL_HTML)
    const result = autoInjectMissingTags(MINIMAL_HTML, meta, '/')
    expect(result.meta.twitter.card).toBe('summary_large_image')
    expect(result.html).toContain('name="twitter:card"')
  })
})

// ============================================================================
// processSeoMeta
// ============================================================================

describe('processSeoMeta', () => {
  it('analyze mode does not modify meta or html', () => {
    const result = processSeoMeta(MINIMAL_HTML, '/', 'analyze')
    // Should NOT replicate and NOT auto-inject in analyze mode
    expect(result.meta.og.title).toBeUndefined() 
    expect(result.meta.charset).toBeUndefined()
    expect(result.html).toBe(MINIMAL_HTML)
  })

  it('fix mode injects missing tags', () => {
    const result = processSeoMeta(MINIMAL_HTML, '/', 'fix')
    expect(result.meta.charset).toBe('utf-8')
    expect(result.meta.viewport).toBe('width=device-width, initial-scale=1')
    expect(result.meta.og.type).toBe('website')
    expect(result.meta.twitter.card).toBe('summary_large_image')
  })

  it('returns report with score', () => {
    const result = processSeoMeta(GOOD_HTML, '/', 'analyze')
    expect(result.report.score).toBeGreaterThanOrEqual(80)
    expect(result.report.route).toBe('/')
  })
})
