import { describe, it, expect } from 'vitest'
import { analyzeDom, domAnalysisToSeoIssues } from '../../src/seo/dom-analysis'

// ============================================================================
// Fixture HTML
// ============================================================================

const GOOD_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Página de Teste</title>
</head>
<body>
  <header><nav>Menu</nav></header>
  <main>
    <h1>Título Principal</h1>
    <h2>Subtítulo</h2>
    <p>Parágrafo de texto.</p>
    <img src="/image.jpg" alt="Imagem descritiva">
    <a href="/link">Link com texto</a>
    <form action="/submit">
      <label for="name">Nome</label>
      <input type="text" id="name">
    </form>
  </main>
  <footer>Rodapé</footer>
</body>
</html>
`

const BAD_NESTING_HTML = `
<!DOCTYPE html>
<html>
<head><title>Teste</title></head>
<body>
  <main>
    <p>
      <div>Div dentro de P (inválido)</div>
      <table>
        <table>Tabela aninhada (inválido)</table>
      </table>
    </p>
    <a href="/a"><a href="/b">Link dentro de link</a></a>
  </main>
</body>
</html>
`

const BAD_HEADINGS_HTML = `
<!DOCTYPE html>
<html>
<head><title>Teste</title></head>
<body>
  <main>
    <h1>Título 1</h1>
    <h1>Título 2</h1>
    <h4>Pulou h2 e h3</h4>
  </main>
</body>
</html>
`

const DEEP_NESTING_HTML = `
<!DOCTYPE html>
<html>
<head><title>Teste</title></head>
<body>
  <main>
    <div><div><div><div><div>
      <div><div><div><div><div>
        <p>Nível 10 de profundidade</p>
      </div></div></div></div></div>
    </div></div></div></div>
  </main>
</body>
</html>
`

const BAD_ACCESSIBILITY_HTML = `
<!DOCTYPE html>
<html>
<head><title>Teste</title></head>
<body>
  <main>
    <img src="/image.jpg">
    <img>
    <a href="/link"></a>
    <input type="text">
    <iframe src="/embed"></iframe>
    <button>Clique aqui</button>
  </main>
</body>
</html>
`

// ============================================================================
// analyzeDom — Depth
// ============================================================================

describe('analyzeDom — depth', () => {
  it('detects deep nesting', () => {
    const result = analyzeDom(DEEP_NESTING_HTML)
    expect(result.depthIssues.length).toBeGreaterThan(0)
    expect(result.stats.maxDepth).toBeGreaterThanOrEqual(8)
  })

  it('returns no depth issues for shallow HTML', () => {
    const result = analyzeDom(GOOD_HTML)
    expect(result.depthIssues).toHaveLength(0)
  })
})

// ============================================================================
// analyzeDom — Headings
// ============================================================================

describe('analyzeDom — headings', () => {
  it('detects multiple h1 tags', () => {
    const result = analyzeDom(BAD_HEADINGS_HTML)
    expect(result.structureIssues.some(i => i.rule === 'multiple-h1')).toBe(true)
  })

  it('detects heading skip', () => {
    const result = analyzeDom(BAD_HEADINGS_HTML)
    expect(result.structureIssues.some(i => i.rule === 'heading-skip')).toBe(true)
  })

  it('accepts proper heading hierarchy', () => {
    const result = analyzeDom(GOOD_HTML)
    expect(result.structureIssues.some(i => i.rule === 'heading-skip')).toBe(false)
    expect(result.structureIssues.some(i => i.rule === 'multiple-h1')).toBe(false)
  })
})

// ============================================================================
// analyzeDom — Nesting
// ============================================================================

describe('analyzeDom — nesting', () => {
  it('detects invalid nesting: div inside p', () => {
    const result = analyzeDom(BAD_NESTING_HTML)
    expect(result.structureIssues.some(i => i.rule === 'invalid-nesting')).toBe(true)
  })

  it('detects table inside table', () => {
    const result = analyzeDom(BAD_NESTING_HTML)
    expect(result.structureIssues.some(i => i.rule === 'invalid-nesting')).toBe(true)
  })

  it('detects link inside link', () => {
    const result = analyzeDom(BAD_NESTING_HTML)
    expect(result.structureIssues.some(i => i.rule === 'invalid-nesting' && i.message.includes('a'))).toBe(true)
  })
})

// ============================================================================
// analyzeDom — Accessibility
// ============================================================================

describe('analyzeDom — accessibility', () => {
  it('detects images without alt', () => {
    const result = analyzeDom(BAD_ACCESSIBILITY_HTML)
    expect(result.accessibilityIssues.some(i => i.rule === 'img-missing-alt')).toBe(true)
  })

  it('detects images without src', () => {
    const result = analyzeDom(BAD_ACCESSIBILITY_HTML)
    expect(result.accessibilityIssues.some(i => i.rule === 'img-missing-src')).toBe(true)
  })

  it('detects links without text', () => {
    const result = analyzeDom(BAD_ACCESSIBILITY_HTML)
    expect(result.accessibilityIssues.some(i => i.rule === 'link-no-text')).toBe(true)
  })

  it('detects inputs without labels', () => {
    const result = analyzeDom(BAD_ACCESSIBILITY_HTML)
    expect(result.accessibilityIssues.some(i => i.rule === 'input-missing-label')).toBe(true)
  })

  it('detects iframes without title', () => {
    const result = analyzeDom(BAD_ACCESSIBILITY_HTML)
    expect(result.accessibilityIssues.some(i => i.rule === 'iframe-missing-title')).toBe(true)
  })

  it('detects buttons without type', () => {
    const result = analyzeDom(BAD_ACCESSIBILITY_HTML)
    expect(result.accessibilityIssues.some(i => i.rule === 'button-missing-type')).toBe(true)
  })

  it('passes good accessibility HTML', () => {
    const result = analyzeDom(GOOD_HTML)
    expect(result.accessibilityIssues).toHaveLength(0)
  })
})

// ============================================================================
// analyzeDom — Stats
// ============================================================================

describe('analyzeDom — stats', () => {
  it('collects element counts', () => {
    const result = analyzeDom(GOOD_HTML)
    expect(result.stats.headingCount).toBeGreaterThan(0)
    expect(result.stats.imageCount).toBeGreaterThan(0)
    expect(result.stats.linkCount).toBeGreaterThan(0)
    expect(result.stats.formCount).toBeGreaterThan(0)
    expect(result.stats.totalElements).toBeGreaterThan(0)
  })
})

// ============================================================================
// domAnalysisToSeoIssues
// ============================================================================

describe('domAnalysisToSeoIssues', () => {
  it('converts DOM issues to SEO format', () => {
    const domResult = analyzeDom(BAD_ACCESSIBILITY_HTML)
    const seoIssues = domAnalysisToSeoIssues(domResult)

    expect(seoIssues.length).toBeGreaterThan(0)
    expect(seoIssues.every(i => i.rule && i.severity && i.message)).toBe(true)
  })
})
