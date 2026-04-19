/**
 * metatags.ts — Análise, validação e correção de metatags HTML
 *
 * Verifica presença, conformidade com melhores práticas, detecta tags depreciadas,
 * replica automaticamente tags faltantes e gera relatório.
 */

import { parseHTML } from 'linkedom'
import type {
  ExtractedMeta,
  SeoIssue,
  SeoReport,
} from './types'
import {
  REQUIRED_META_TAGS,
  REQUIRED_OG_TAGS,
  RECOMMENDED_OG_TAGS,
  REQUIRED_TWITTER_TAGS,
  RECOMMENDED_TWITTER_TAGS,
  DEPRECATED_META_TAGS,
  AUTO_REPLICATE_RULES as REPLICATION_RULES,
  META_LENGTH_LIMITS,
} from './constants'
import { extractMetaTagsSafe } from '../utils/meta'

// ============================================================================
// Parser — extrai todas as metatags do HTML
// ============================================================================

export function extractMetaTags(html: string): ExtractedMeta {
  return extractMetaTagsSafe(html)
}

// ============================================================================
// Validation — verifica conformidade das metatags
// ============================================================================

function validateLength(
  value: string | undefined,
  limits: { min?: number, recommendedMin?: number, recommendedMax?: number, absoluteMax?: number } | undefined,
  tagName: string,
): SeoIssue[] {
  const issues: SeoIssue[] = []

  if (!value || !limits) return issues

  const len = value.length

  if (limits.absoluteMax && len > limits.absoluteMax) {
    issues.push({
      rule: `${tagName}-too-long`,
      severity: 'error',
      message: `${tagName} tem ${len} caracteres (máximo absoluto: ${limits.absoluteMax})`,
      suggestion: `Reduzir para no máximo ${limits.recommendedMax || limits.absoluteMax} caracteres`,
    })
  }
  else if (limits.recommendedMax && len > limits.recommendedMax) {
    issues.push({
      rule: `${tagName}-exceeds-recommended`,
      severity: 'warning',
      message: `${tagName} tem ${len} caracteres (recomendado: até ${limits.recommendedMax})`,
      suggestion: `Considerar reduzir para ${limits.recommendedMax} caracteres ou menos`,
    })
  }

  if (limits.recommendedMin && len < limits.recommendedMin) {
    issues.push({
      rule: `${tagName}-too-short`,
      severity: 'warning',
      message: `${tagName} tem ${len} caracteres (mínimo recomendado: ${limits.recommendedMin})`,
      suggestion: `Aumentar para pelo menos ${limits.recommendedMin} caracteres`,
    })
  }

  if (limits.min && len < limits.min) {
    issues.push({
      rule: `${tagName}-below-minimum`,
      severity: 'error',
      message: `${tagName} tem ${len} caracteres (mínimo: ${limits.min})`,
      suggestion: `Aumentar para pelo menos ${limits.min} caracteres`,
    })
  }

  return issues
}

function validatePresence(
  meta: ExtractedMeta,
  tagName: string,
  value: string | undefined,
  required: boolean,
): SeoIssue | null {
  if (!value) {
    return {
      rule: `${tagName}-missing`,
      severity: required ? 'error' : 'warning',
      message: `Meta tag "${tagName}" está ausente`,
      suggestion: required ? `Adicionar <meta> para "${tagName}"` : `Considerar adicionar "${tagName}" para melhor SEO`,
    }
  }
  return null
}

// ============================================================================
// Analysis — análise completa de metatags
// ============================================================================

export function analyzeMetaTags(html: string, route: string = ''): SeoReport {
  const meta = extractMetaTags(html)
  const issues: SeoIssue[] = []

  // 1. Title analysis
  if (!meta.title) {
    issues.push({
      rule: 'title-missing',
      severity: 'error',
      message: 'Tag <title> está ausente',
      suggestion: 'Adicionar <title> com 30-60 caracteres descritivos',
    })
  }
  else {
    const titleLimits = META_LENGTH_LIMITS.title
    issues.push(...validateLength(meta.title, titleLimits, 'Title'))

    if (titleLimits?.recommendedMin && meta.title.length < titleLimits.recommendedMin) {
      // Title exists but very short
    }
  }

  // 2. Required meta tags
  for (const tag of REQUIRED_META_TAGS) {
    let value: string | undefined
    if (tag === 'description') value = meta.description
    else if (tag === 'viewport') value = meta.viewport
    else if (tag === 'charset') value = meta.charset

    const issue = validatePresence(meta, tag, value, true)
    if (issue) issues.push(issue)

    // Length validation for description
    if (tag === 'description' && value) {
      issues.push(...validateLength(value, META_LENGTH_LIMITS.description, 'Description'))
    }
  }

  // 3. Canonical
  if (!meta.canonical) {
    issues.push({
      rule: 'canonical-missing',
      severity: 'warning',
      message: 'Link canonical está ausente',
      suggestion: 'Adicionar <link rel="canonical"> para evitar conteúdo duplicado',
    })
  }

  // 4. Open Graph required
  for (const tag of REQUIRED_OG_TAGS) {
    const key = tag.slice(3) // Remove 'og:'
    const value = meta.og[key]
    const issue = validatePresence(meta, tag, value, true)
    if (issue) issues.push(issue)

    if (tag === 'og:description' && value) {
      issues.push(...validateLength(value, META_LENGTH_LIMITS.ogDescription, 'OG Description'))
    }
    if (tag === 'og:title' && value) {
      issues.push(...validateLength(value, META_LENGTH_LIMITS.ogTitle, 'OG Title'))
    }
  }

  // 5. Open Graph recommended
  for (const tag of RECOMMENDED_OG_TAGS) {
    const key = tag.slice(3)
    if (!meta.og[key]) {
      issues.push({
        rule: `${tag}-missing`,
        severity: 'info',
        message: `Meta tag "${tag}" não encontrada (recomendada)`,
        suggestion: `Adicionar "${tag}" para melhor compartilhamento social`,
      })
    }

    // Validate og:image URL
    if (tag === 'og:image' && meta.og.image) {
      const imageUrl = meta.og.image
      const imgIssues = validateImageTag(imageUrl, route)
      issues.push(...imgIssues)
    }
  }

  // 6. Twitter required
  for (const tag of REQUIRED_TWITTER_TAGS) {
    const key = tag.slice(8)
    const value = meta.twitter[key]
    const issue = validatePresence(meta, tag, value, true)
    if (issue) issues.push(issue)
  }

  // 7. Twitter recommended
  for (const tag of RECOMMENDED_TWITTER_TAGS) {
    const key = tag.slice(8)
    if (!meta.twitter[key]) {
      issues.push({
        rule: `${tag}-missing`,
        severity: 'info',
        message: `Meta tag "${tag}" não encontrada (recomendada)`,
        suggestion: `Adicionar "${tag}" para melhor compartilhamento no Twitter`,
      })
    }

    if (tag === 'twitter:description' && meta.twitter.description) {
      issues.push(...validateLength(meta.twitter.description, META_LENGTH_LIMITS.twitterDescription, 'Twitter Description'))
    }
  }

  // 8. Deprecated tags
  for (const deprecatedTag of Object.keys(meta.other)) {
    if (DEPRECATED_META_TAGS.includes(deprecatedTag)) {
      issues.push({
        rule: `deprecated-tag-${deprecatedTag}`,
        severity: 'warning',
        message: `Meta tag depreciada "${deprecatedTag}" encontrada`,
        suggestion: `Remover "<meta name="${deprecatedTag}">" — não é mais suportada por motores de busca`,
      })
    }
  }

  // Check deprecated in og/twitter too
  // (og variants are not checked for deprecation currently)

  // 9. Calculate score
  const score = calculateScore(issues)

  return {
    route: route || '/',
    issues,
    score,
    timestamp: new Date().toISOString(),
  }
}

// ============================================================================
// Image validation
// ============================================================================

function validateImageTag(imageUrl: string, route: string): SeoIssue[] {
  const issues: SeoIssue[] = []

  // Check if URL is valid
  try {
    new URL(imageUrl)
    // External URL — can't verify existence
  }
  catch {
    // Relative URL — check if it starts with /
    if (!imageUrl.startsWith('/') && !imageUrl.startsWith('http')) {
      issues.push({
        rule: 'og-image-relative',
        severity: 'warning',
        message: `og:image usa caminho relativo: "${imageUrl}"`,
        suggestion: 'Usar URL absoluto ou caminho iniciando com /',
        location: route,
      })
    }
  }

  // Check extension
  const ext = imageUrl.split('?')[0]!.split('.').pop()?.toLowerCase()
  if (ext && !['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'].includes(ext)) {
    issues.push({
      rule: 'og-image-extension',
      severity: 'warning',
      message: `og:image pode ter formato não otimizado: "${imageUrl}"`,
      suggestion: 'Usar .webp, .jpg ou .png para melhor compatibilidade',
    })
  }

  return issues
}

// ============================================================================
// Scoring
// ============================================================================

function calculateScore(issues: SeoIssue[]): number {
  let score = 100
  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        score -= 15
        break
      case 'warning':
        score -= 5
        break
      case 'info':
        score -= 1
        break
    }
  }
  return Math.max(0, Math.min(100, score))
}

// ============================================================================
// Auto-replication — copia tags existentes para tags ausentes
// ============================================================================

export function replicateMissingTags(html: string, meta: ExtractedMeta): { html: string, meta: ExtractedMeta, replicated: SeoIssue[] } {
  const { document } = parseHTML(html)
  const replicated: SeoIssue[] = []

  for (const rule of REPLICATION_RULES) {
    // Check if target already exists
    let existingValue: string | undefined

    if (rule.targetType === 'property') {
      // Check og: or twitter:
      const prefix = rule.target.startsWith('twitter:') ? 'twitter:' : rule.target.startsWith('og:') ? 'og:' : ''
      const key = rule.target.replace(prefix, '')
      if (prefix === 'og:') existingValue = meta.og[key]
      else if (prefix === 'twitter:') existingValue = meta.twitter[key]
    }
    else {
      // name attribute
      if (rule.target === 'description') existingValue = meta.description
    }

    if (existingValue) continue // Already exists

    // Find source value
    let sourceValue: string | undefined
    for (const source of rule.sources) {
      if (source.type === 'title') {
        sourceValue = meta.title || undefined
      }
      else if (source.type === 'meta') {
        sourceValue = meta[source.key as keyof ExtractedMeta] as string || undefined
      }
      else if (source.type === 'og') {
        sourceValue = meta.og[source.key] || undefined
      }
      else if (source.type === 'twitter') {
        sourceValue = meta.twitter[source.key] || undefined
      }

      if (sourceValue) break
    }

    if (!sourceValue) continue

    // Inject the meta tag
    const metaEl = document.createElement('meta')

    if (rule.targetType === 'property') {
      metaEl.setAttribute('property', rule.target)
      // Update meta object
      const prefix = rule.target.startsWith('twitter:') ? 'twitter:' : 'og:'
      const key = rule.target.replace(prefix, '')
      if (prefix === 'og:') meta.og[key] = sourceValue
      else if (prefix === 'twitter:') meta.twitter[key] = sourceValue
    }
    else {
      metaEl.setAttribute('name', rule.target)
      if (rule.target === 'description') meta.description = sourceValue
    }

    metaEl.setAttribute('content', sourceValue)

    // Insert before </head>
    const head = document.querySelector('head')
    if (head) head.appendChild(metaEl)

    replicated.push({
      rule: 'auto-replicated',
      severity: 'info',
      message: `Tag "${rule.target}" criada automaticamente a partir de "${rule.sources[0]?.key || rule.sources[0]?.type}"`,
      suggestion: undefined,
    })
  }

  return {
    html: document.toString(),
    meta,
    replicated,
  }
}

// ============================================================================
// Auto-inject — insere tags essenciais faltantes com valores padrão
// ============================================================================

export function autoInjectMissingTags(html: string, meta: ExtractedMeta, route: string = ''): { html: string, meta: ExtractedMeta, injected: SeoIssue[] } {
  const { document } = parseHTML(html)
  const injected: SeoIssue[] = []

  // Ensure charset
  if (!meta.charset) {
    meta.charset = 'utf-8'
    const charsetEl = document.createElement('meta')
    charsetEl.setAttribute('charset', 'utf-8')
    const head = document.querySelector('head')
    if (head) head.insertBefore(charsetEl, head.firstChild)
    injected.push({
      rule: 'auto-injected',
      severity: 'info',
      message: 'charset=utf-8 injetado automaticamente',
    })
  }

  // Ensure viewport
  if (!meta.viewport) {
    meta.viewport = 'width=device-width, initial-scale=1'
    const vpEl = document.createElement('meta')
    vpEl.setAttribute('name', 'viewport')
    vpEl.setAttribute('content', meta.viewport)
    const head = document.querySelector('head')
    if (head) head.appendChild(vpEl)
    injected.push({
      rule: 'auto-injected',
      severity: 'info',
      message: 'viewport injetado automaticamente',
    })
  }

  // Ensure og:type
  if (!meta.og.type) {
    meta.og.type = 'website'
    const typeEl = document.createElement('meta')
    typeEl.setAttribute('property', 'og:type')
    typeEl.setAttribute('content', 'website')
    const head = document.querySelector('head')
    if (head) head.appendChild(typeEl)
    injected.push({
      rule: 'auto-injected',
      severity: 'info',
      message: 'og:type=website injetado automaticamente',
    })
  }

  // Ensure og:url
  if (!meta.og.url && meta.canonical) {
    meta.og.url = meta.canonical
    const urlEl = document.createElement('meta')
    urlEl.setAttribute('property', 'og:url')
    urlEl.setAttribute('content', meta.canonical)
    const head = document.querySelector('head')
    if (head) head.appendChild(urlEl)
    injected.push({
      rule: 'auto-injected',
      severity: 'info',
      message: 'og:url injetado a partir do canonical',
    })
  }
  else if (!meta.og.url && route) {
    const fullUrl = route.startsWith('/') ? route : `/${route}`
    meta.og.url = fullUrl
    const urlEl = document.createElement('meta')
    urlEl.setAttribute('property', 'og:url')
    urlEl.setAttribute('content', fullUrl)
    const head = document.querySelector('head')
    if (head) head.appendChild(urlEl)
    injected.push({
      rule: 'auto-injected',
      severity: 'info',
      message: `og:url=${fullUrl} injetado automaticamente`,
    })
  }

  // Ensure twitter:card
  if (!meta.twitter.card) {
    meta.twitter.card = 'summary_large_image'
    const cardEl = document.createElement('meta')
    cardEl.setAttribute('name', 'twitter:card')
    cardEl.setAttribute('content', 'summary_large_image')
    const head = document.querySelector('head')
    if (head) head.appendChild(cardEl)
    injected.push({
      rule: 'auto-injected',
      severity: 'info',
      message: 'twitter:card=summary_large_image injetado automaticamente',
    })
  }

  return {
    html: document.toString(),
    meta,
    injected,
  }
}

// ============================================================================
// Auto-fix — tenta preencher tags ausentes usando conteúdo do DOM (ex: <h1>, primeira <img>)
// ============================================================================

export function autoFixFromDom(html: string, meta: ExtractedMeta): { html: string, meta: ExtractedMeta, fixed: SeoIssue[] } {
  const { document } = parseHTML(html)
  const fixed: SeoIssue[] = []

  // Try to find H1 for title/og:title if missing
  if (!meta.title || !meta.og.title) {
    const h1 = document.querySelector('h1')
    if (h1 && h1.textContent) {
      const h1Text = h1.textContent.trim()
      if (!meta.title) {
        const titleEl = document.createElement('title')
        titleEl.textContent = h1Text
        const head = document.querySelector('head')
        if (head) head.appendChild(titleEl)
        meta.title = h1Text
        fixed.push({ rule: 'auto-fix-title', severity: 'info', message: 'Tag <title> gerada a partir do primeiro <h1>' })
      }
      if (!meta.og.title) {
        const ogTitle = document.createElement('meta')
        ogTitle.setAttribute('property', 'og:title')
        ogTitle.setAttribute('content', h1Text)
        const head = document.querySelector('head')
        if (head) head.appendChild(ogTitle)
        meta.og.title = h1Text
        fixed.push({ rule: 'auto-fix-og-title', severity: 'info', message: 'Tag og:title gerada a partir do primeiro <h1>' })
      }
    }
  }

  // Try to find first image for og:image if missing
  if (!meta.og.image) {
    const firstImg = document.querySelector('main img[src], body img[src]')
    if (firstImg) {
      const src = firstImg.getAttribute('src')
      if (src) {
        const ogImage = document.createElement('meta')
        ogImage.setAttribute('property', 'og:image')
        ogImage.setAttribute('content', src)
        const head = document.querySelector('head')
        if (head) head.appendChild(ogImage)
        meta.og.image = src
        fixed.push({ rule: 'auto-fix-og-image', severity: 'info', message: 'Tag og:image gerada a partir da primeira imagem do corpo' })
      }
    }
  }

  return {
    html: document.toString(),
    meta,
    fixed,
  }
}

// ============================================================================
// Main entry point — processa HTML e retorna relatório + HTML modificado
// ============================================================================

export interface SeoMetaResult {
  html: string
  report: SeoReport
  meta: ExtractedMeta
}

export function processSeoMeta(
  html: string,
  route: string = '',
  mode: 'analyze' | 'fix' | 'none' = 'analyze',
): SeoMetaResult {
  // 1. Extract meta tags first (needed for result)
  const meta = extractMetaTags(html)

  // If mode is none, return empty report
  if (mode === 'none') {
    return {
      html,
      report: {
        route: route || '/',
        issues: [],
        score: 100,
        timestamp: new Date().toISOString(),
      },
      meta,
    }
  }

  // 2. Full analysis
  const report = analyzeMetaTags(html, route)
  let processedHtml = html

  // 3. Auto-fix / Replication (ONLY in fix mode)
  if (mode === 'fix') {
    // a. Auto-replicate
    const replicated = replicateMissingTags(processedHtml, meta)
    processedHtml = replicated.html
    report.issues.push(...replicated.replicated)

    // b. Fix from DOM
    const domFixed = autoFixFromDom(processedHtml, meta)
    processedHtml = domFixed.html
    report.issues.push(...domFixed.fixed)

    // c. Auto-inject missing tags
    const injected = autoInjectMissingTags(processedHtml, meta, route)
    processedHtml = injected.html
    report.issues.push(...injected.injected)
  }

  // 4. Recalculate score after fixes
  report.score = calculateScore(report.issues.filter(i => !i.rule.startsWith('auto-')))

  return {
    html: processedHtml,
    report,
    meta,
  }
}
