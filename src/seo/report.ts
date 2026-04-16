/**
 * report.ts — Geração, formatação e consolidação de relatórios SEO
 *
 * Consolida relatórios de múltiplas páginas, formata output para console
 * e salva relatório em arquivo JSON.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { SeoIssue, SeoReport, SeoSeverity } from './types'

// ============================================================================
// Console output formatting
// ============================================================================

const SEVERITY_ICONS: Record<SeoSeverity, string> = {
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  success: '✅',
}

const SEVERITY_COLORS: Record<SeoSeverity, string> = {
  error: '\x1B[31m', // Red
  warning: '\x1B[33m', // Yellow
  info: '\x1B[36m', // Cyan
  success: '\x1B[32m', // Green
}

const RESET = '\x1B[0m'

function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`
}

function formatIssue(issue: SeoIssue, indent: string = '    '): string {
  const icon = SEVERITY_ICONS[issue.severity]
  const color = SEVERITY_COLORS[issue.severity]
  const severity = colorize(issue.severity.toUpperCase(), color)

  let line = `${indent}${icon} [${severity}] ${issue.message}`

  if (issue.details) {
    line += `\n${indent}   Detalhes: ${issue.details}`
  }

  if (issue.suggestion) {
    line += `\n${indent}   Sugestão: ${issue.suggestion}`
  }

  if (issue.location) {
    line += `\n${indent}   Local: ${issue.location}`
  }

  return line
}

// ============================================================================
// Single page report
// ============================================================================

export function formatPageReport(report: SeoReport): string {
  const lines: string[] = []

  // Header
  lines.push('')
  lines.push(`  ┌─ SEO Report: ${report.route}`)
  lines.push(`  │ Score: ${getScoreBadge(report.score)} ${report.score}/100`)
  lines.push(`  │ Issues: ${report.issues.length} (${countBySeverity(report.issues).error} errors, ${countBySeverity(report.issues).warning} warnings)`)
  lines.push(`  │`)

  if (report.issues.length === 0) {
    lines.push(`  │ ${SEVERITY_ICONS.success} ${colorize('Nenhum problema encontrado!', SEVERITY_COLORS.success)}`)
  }
  else {
    // Group by severity
    const errors = report.issues.filter(i => i.severity === 'error')
    const warnings = report.issues.filter(i => i.severity === 'warning')
    const infos = report.issues.filter(i => i.severity === 'info')

    if (errors.length > 0) {
      lines.push(`  │ Errors:`)
      errors.forEach((issue) => {
        lines.push(formatIssue(issue, '  │   '))
      })
    }

    if (warnings.length > 0) {
      lines.push(`  │`)
      lines.push(`  │ Warnings:`)
      warnings.forEach((issue) => {
        lines.push(formatIssue(issue, '  │   '))
      })
    }

    if (infos.length > 0) {
      lines.push(`  │`)
      lines.push(`  │ Info:`)
      infos.forEach((issue) => {
        lines.push(formatIssue(issue, '  │   '))
      })
    }
  }

  lines.push(`  └─────────────────────────────────────`)
  lines.push('')

  return lines.join('\n')
}

// ============================================================================
// Summary badge for score
// ============================================================================

function getScoreBadge(score: number): string {
  if (score >= 90) return colorize('EXCELENTE', SEVERITY_COLORS.success)
  if (score >= 70) return colorize('BOM', '\x1B[32m')
  if (score >= 50) return colorize('REGULAR', SEVERITY_COLORS.warning)
  if (score >= 30) return colorize('RUIM', '\x1B[31m')
  return colorize('CRÍTICO', '\x1B[31m\x1B[1m')
}

function countBySeverity(issues: SeoIssue[]): Record<SeoSeverity, number> {
  const counts: Record<SeoSeverity, number> = { error: 0, warning: 0, info: 0, success: 0 }
  for (const issue of issues) {
    counts[issue.severity] = (counts[issue.severity] || 0) + 1
  }
  return counts
}

// ============================================================================
// Consolidated report — multiple pages
// ============================================================================

export interface ConsolidatedReport {
  pages: SeoReport[]
  totalPages: number
  totalIssues: number
  avgScore: number
  issuesByRule: Record<string, { count: number, severity: SeoSeverity, message: string }>
  pagesByScore: Array<{ route: string, score: number }>
}

export function consolidateReports(reports: SeoReport[]): ConsolidatedReport {
  const totalPages = reports.length
  const totalIssues = reports.reduce((sum, r) => sum + r.issues.length, 0)
  const avgScore = totalPages > 0 ? Math.round(reports.reduce((sum, r) => sum + r.score, 0) / totalPages) : 0

  // Aggregate issues by rule
  const issuesByRule: ConsolidatedReport['issuesByRule'] = {}
  for (const report of reports) {
    for (const issue of report.issues) {
      if (!issuesByRule[issue.rule]) {
        issuesByRule[issue.rule] = { count: 0, severity: issue.severity, message: issue.message }
      }
      issuesByRule[issue.rule]!.count++
    }
  }

  // Pages sorted by score
  const pagesByScore = reports
    .map(r => ({ route: r.route, score: r.score }))
    .sort((a, b) => a.score - b.score)

  return {
    pages: reports,
    totalPages,
    totalIssues,
    avgScore,
    issuesByRule,
    pagesByScore,
  }
}

export function formatConsolidatedReport(consolidated: ConsolidatedReport, mdReportPath?: string): string {
  const lines: string[] = []

  lines.push('')
  lines.push('  ┌──────────────────────────────────────────────────────────┐')
  lines.push('  │              nuxt-lite: SEO Analysis Summary             │')
  lines.push('  ├──────────────────────────────────────────────────────────┤')
  lines.push(`  │  Pages analyzed:  ${String(consolidated.totalPages).padEnd(39)}│`)
  lines.push(`  │  Total issues:    ${String(consolidated.totalIssues).padEnd(39)}│`)
  const avgLine = `Average score:   ${consolidated.avgScore}/100`
  lines.push(`  │  ${avgLine.padEnd(54)}│`)
  lines.push('  ├──────────────────────────────────────────────────────────┤')

  if (consolidated.totalIssues > 0) {
    if (mdReportPath) {
      lines.push('  │  Consulte o relatório detalhado em:                      │')
      lines.push(`  │  📄 ${mdReportPath.padEnd(51)}│`)
    }
    else {
      lines.push('  │  Verifique seo-report.json para detalhes.                │')
    }
  }
  else {
    lines.push('  │  ✅ Nenhum problema encontrado! Tudo perfeito.           │')
  }

  lines.push('  └──────────────────────────────────────────────────────────┘')
  lines.push('')

  return lines.join('\n')
}

// ============================================================================
// Save report to file (JSON)
// ============================================================================

export interface ReportSaveOptions {
  outputDir: string
  filename?: string
  includeDetails?: boolean
}

export function saveReport(
  reports: SeoReport[],
  options: ReportSaveOptions,
): string {
  const { outputDir, filename = 'seo-report.json', includeDetails = true } = options

  const consolidated = consolidateReports(reports)

  const reportData = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPages: consolidated.totalPages,
      totalIssues: consolidated.totalIssues,
      avgScore: consolidated.avgScore,
    },
    topIssues: Object.entries(consolidated.issuesByRule)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([rule, data]) => ({ rule, ...data })),
    pagesByScore: consolidated.pagesByScore,
    pages: includeDetails ? consolidated.pages : undefined,
  }

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const filePath = join(outputDir, filename)
  writeFileSync(filePath, JSON.stringify(reportData, null, 2), 'utf-8')

  return filePath
}

// ============================================================================
// Save Markdown report
// ============================================================================

export function saveMarkdownReport(reports: SeoReport[], rootDir: string): string {
  const seoDir = join(rootDir, '.seo')
  if (!existsSync(seoDir)) {
    mkdirSync(seoDir, { recursive: true })
  }

  const consolidated = consolidateReports(reports)
  const lines: string[] = []

  lines.push('# Relatório de Análise SEO (nuxt-lite)')
  lines.push('')
  lines.push(`- **Data:** ${new Date().toLocaleString()}`)
  lines.push(`- **Páginas Analisadas:** ${consolidated.totalPages}`)
  lines.push(`- **Total de Problemas:** ${consolidated.totalIssues}`)
  lines.push(`- **Score Médio:** ${consolidated.avgScore}/100`)
  lines.push('')
  lines.push('## Índice por Rota')
  lines.push('')

  for (const page of consolidated.pagesByScore) {
    const anchor = page.route === '/' ? 'home' : page.route.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'page'
    lines.push(`- [${page.route} (Score: ${page.score})](#${anchor})`)
  }

  lines.push('')
  lines.push('## Detalhes por Rota')
  lines.push('')

  for (const page of consolidated.pagesByScore) {
    const anchor = page.route === '/' ? 'home' : page.route.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'page'
    const report = consolidated.pages.find(p => p.route === page.route)

    lines.push(`### Rota: \`${page.route}\` { #` + anchor + ` }`)
    lines.push(`**Score:** ${page.score}/100`)
    lines.push('')

    if (!report || report.issues.length === 0) {
      lines.push('✅ Nenhum problema encontrado.')
      lines.push('')
      lines.push('---')
      lines.push('')
      continue
    }

    lines.push('| Severidade | Regra | Mensagem | Sugestão |')
    lines.push('|---|---|---|---|')

    for (const issue of report.issues) {
      const icon = SEVERITY_ICONS[issue.severity] || issue.severity
      const msg = issue.message.replace(/\|/g, '\\|')
      const sug = (issue.suggestion || '-').replace(/\|/g, '\\|')
      lines.push(`| ${icon} | \`${issue.rule}\` | ${msg} | ${sug} |`)
    }

    lines.push('')
    lines.push('---')
    lines.push('')
  }

  const filePath = join(seoDir, 'analise.md')
  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return filePath
}

// ============================================================================
// Main entry point — print and save
// ============================================================================

export function printAndSaveReports(
  reports: SeoReport[],
  outputDir: string,
  saveToFile: boolean = true,
  rootDir?: string,
): { json: string | null, md: string | null } {
  let jsonPath: string | null = null
  let mdPath: string | null = null

  // Save to file
  if (saveToFile) {
    try {
      jsonPath = saveReport(reports, { outputDir })
      if (rootDir) {
        mdPath = saveMarkdownReport(reports, rootDir)
      }
    }
    catch (error) {
      console.warn(`[nuxt-lite:seo] Failed to save report: ${error}`)
    }
  }

  const consolidated = consolidateReports(reports)
  console.log(formatConsolidatedReport(consolidated, mdPath ? '.seo/analise.md' : undefined))

  return { json: jsonPath, md: mdPath }
}
