import { describe, it, expect } from 'vitest'
import { formatPageReport, consolidateReports, formatConsolidatedReport } from '../../src/seo/report'
import type { SeoReport } from '../../src/seo/types'

// ============================================================================
// Fixture Reports
// ============================================================================

const GOOD_REPORT: SeoReport = {
  route: '/',
  issues: [],
  score: 100,
  timestamp: '2024-01-01T00:00:00.000Z',
}

const BAD_REPORT: SeoReport = {
  route: '/bad',
  issues: [
    {
      rule: 'title-missing',
      severity: 'error',
      message: 'Tag <title> está ausente',
      suggestion: 'Adicionar <title>',
    },
    {
      rule: 'description-missing',
      severity: 'error',
      message: 'Meta tag "description" está ausente',
      suggestion: 'Adicionar description',
    },
    {
      rule: 'og:title-missing',
      severity: 'warning',
      message: 'Meta tag "og:title" não encontrada',
      suggestion: 'Adicionar og:title',
    },
  ],
  score: 30,
  timestamp: '2024-01-01T00:00:00.000Z',
}

const MIXED_REPORT: SeoReport = {
  route: '/mixed',
  issues: [
    {
      rule: 'canonical-missing',
      severity: 'warning',
      message: 'Link canonical está ausente',
    },
    {
      rule: 'auto-replicated',
      severity: 'info',
      message: 'Tag "og:title" criada automaticamente',
    },
  ],
  score: 80,
  timestamp: '2024-01-01T00:00:00.000Z',
}

// ============================================================================
// formatPageReport
// ============================================================================

describe('formatPageReport', () => {
  it('formats a report with no issues', () => {
    const output = formatPageReport(GOOD_REPORT)
    expect(output).toContain('Nenhum problema encontrado!')
    expect(output).toContain('100/100')
  })

  it('formats a report with errors', () => {
    const output = formatPageReport(BAD_REPORT)
    expect(output).toContain('30/100')
    expect(output).toContain('Errors:')
    expect(output).toContain('Tag <title> está ausente')
  })

  it('includes route in output', () => {
    const output = formatPageReport(MIXED_REPORT)
    expect(output).toContain('/mixed')
  })
})

// ============================================================================
// consolidateReports
// ============================================================================

describe('consolidateReports', () => {
  it('calculates correct totals', () => {
    const consolidated = consolidateReports([GOOD_REPORT, BAD_REPORT, MIXED_REPORT])
    expect(consolidated.totalPages).toBe(3)
    expect(consolidated.totalIssues).toBe(5) // 0 + 3 + 2
  })

  it('calculates average score', () => {
    const consolidated = consolidateReports([GOOD_REPORT, BAD_REPORT])
    expect(consolidated.avgScore).toBe(65) // (100 + 30) / 2
  })

  it('aggregates issues by rule', () => {
    const consolidated = consolidateReports([BAD_REPORT, MIXED_REPORT])
    expect(Object.keys(consolidated.issuesByRule).length).toBeGreaterThan(0)
    expect(consolidated.issuesByRule['title-missing']!.count).toBe(1)
  })

  it('sorts pages by score', () => {
    const consolidated = consolidateReports([GOOD_REPORT, BAD_REPORT, MIXED_REPORT])
    expect(consolidated.pagesByScore[0]!.score).toBe(30)
    expect(consolidated.pagesByScore[2]!.score).toBe(100)
  })
})

// ============================================================================
// formatConsolidatedReport
// ============================================================================

describe('formatConsolidatedReport', () => {
  it('formats summary correctly', () => {
    const consolidated = consolidateReports([GOOD_REPORT, BAD_REPORT])
    const output = formatConsolidatedReport(consolidated)
    expect(output).toContain('Pages analyzed:')
    expect(output).toContain('2')
    expect(output).toContain('Total issues:')
    expect(output).toContain('Average score:')
    expect(output).toContain('65')
  })

  it('includes instruction to check report file', () => {
    const consolidated = consolidateReports([BAD_REPORT, MIXED_REPORT])
    const output = formatConsolidatedReport(consolidated)
    expect(output).toContain('Verifique seo-report.json')
  })

  it('shows markdown report path if provided', () => {
    const consolidated = consolidateReports([GOOD_REPORT, BAD_REPORT])
    const output = formatConsolidatedReport(consolidated, '.seo/analise.md')
    expect(output).toContain('.seo/analise.md')
  })
})
