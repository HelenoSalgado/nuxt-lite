/**
 * dom-analysis.ts — DOM structural analysis for SEO and accessibility
 *
 * Checks for excessive nesting, invalid elements, heading hierarchy,
 * accessibility (alt, labels, etc.), and generates a structured report.
 */

// ============================================================================
// External dependencies
// ============================================================================
import { parseHTML } from 'linkedom'

// ============================================================================
// Type imports
// ============================================================================
import type {
  DomAccessibilityIssue,
  DomAnalysisResult,
  DomDepthIssue,
  DomStats,
  DomStructureIssue,
  SeoIssue,
  SeoSeverity,
} from './types'

// ============================================================================
// Local imports
// ============================================================================
import {
  DEFAULT_DOM_DEPTH_LIMITS,
  RECOMMENDED_H1_COUNT,
  INVALID_NESTING_RULES,
} from './constants'

// ============================================================================
// DOM Traversal — coleta estatísticas e analisa profundidade
// ============================================================================

interface TreeNode {
  tag: string
  depth: number
  path: string
  children: TreeNode[]
}

function buildTree(element: Element, depth: number, path: string, isInsideSvg: boolean = false): TreeNode {
  const tag = element.tagName.toLowerCase()
  const currentIsSvg = isInsideSvg || tag === 'svg'

  const node: TreeNode = {
    tag,
    depth,
    path,
    children: [],
  }

  for (const child of Array.from(element.children)) {
    const childPath = `${path} > ${child.tagName.toLowerCase()}`
    node.children.push(buildTree(child, currentIsSvg ? depth : depth + 1, childPath, currentIsSvg))
  }

  return node
}

function analyzeDepth(
  root: TreeNode,
  limits: { warning: number, error: number } = DEFAULT_DOM_DEPTH_LIMITS,
): DomDepthIssue[] {
  const issues: DomDepthIssue[] = []
  const svgTags = ['svg', 'path', 'circle', 'line', 'polyline', 'rect', 'polygon', 'g', 'defs', 'clipPath']

  function traverse(node: TreeNode) {
    if (!svgTags.includes(node.tag)) {
      if (node.depth > limits.error) {
        issues.push({
          element: node.tag,
          depth: node.depth,
          path: node.path,
          severity: 'error' as SeoSeverity,
        })
      }
      else if (node.depth > limits.warning) {
        issues.push({
          element: node.tag,
          depth: node.depth,
          path: node.path,
          severity: 'warning' as SeoSeverity,
        })
      }
    }

    for (const child of node.children) {
      traverse(child)
    }
  }

  traverse(root)
  return issues
}

// ============================================================================
// Structure Analysis — headings, nesting, invalid HTML
// ============================================================================

function getElementPath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el

  while (current && current.tagName.toLowerCase() !== 'html') {
    const tag = current.tagName.toLowerCase()
    let selector = tag

    if (current.id) {
      selector += `#${current.id}`
    }
    else {
      const classes = current.className
      if (typeof classes === 'string' && classes.trim()) {
        selector += `.${classes.trim().split(/\s+/).slice(0, 2).join('.')}`
      }
    }

    parts.unshift(selector)
    current = current.parentElement
  }

  return parts.join(' > ')
}

function analyzeHeadings(doc: Document): DomStructureIssue[] {
  const issues: DomStructureIssue[] = []

  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
  const headingTags = headings.map(el => el.tagName.toLowerCase())

  if (headingTags.length === 0) {
    issues.push({
      rule: 'no-headings',
      severity: 'error',
      message: 'Nenhum heading (h1-h6) encontrado na página',
      suggestion: 'Adicionar pelo menos um <h1> para estrutura de conteúdo',
    })
    return issues
  }

  const h1Count = headingTags.filter(t => t === 'h1').length
  if (h1Count > RECOMMENDED_H1_COUNT) {
    issues.push({
      rule: 'multiple-h1',
      severity: 'warning',
      message: `${h1Count} tags <h1> encontradas (recomendado: 1)`,
      suggestion: 'Usar apenas um <h1> por página para melhor SEO',
    })
  }

  if (h1Count === 0) {
    issues.push({
      rule: 'missing-h1',
      severity: 'error',
      message: 'Nenhum <h1> encontrado na página',
      suggestion: 'Adicionar exatamente um <h1> como título principal da página',
    })
  }

  let previousLevel = 0
  for (let i = 0; i < headingTags.length; i++) {
    const tag = headingTags[i]!
    const currentLevel = Number.parseInt(tag[1]!, 10)
    const el = headings[i]!

    if (currentLevel > previousLevel + 1 && previousLevel > 0) {
      const skippedLevels: string[] = []
      for (let lvl = previousLevel + 1; lvl < currentLevel; lvl++) {
        skippedLevels.push(`h${lvl}`)
      }
      issues.push({
        rule: 'heading-skip',
        severity: 'warning',
        message: `Heading pulou níveis: ${tag} após h${previousLevel} (faltando ${skippedLevels.join(', ')})`,
        suggestion: 'Manter hierarquia sequencial de headings',
        element: tag,
        path: getElementPath(el),
      })
    }

    previousLevel = currentLevel
  }

  return issues
}

function isNestedInParent(child: Element, parent: Element, doc: Document): boolean {
  let current: Element | null = child.parentElement
  while (current) {
    if (current === parent) return true
    if (current === doc.body) return false
    current = current.parentElement
  }
  return false
}

function analyzeNesting(doc: Document, _root: Element): DomStructureIssue[] {
  const issues: DomStructureIssue[] = []

  for (const rule of INVALID_NESTING_RULES) {
    const parents = doc.querySelectorAll(rule.parent)
    parents.forEach((parent) => {
      for (const forbidden of rule.cannotContain) {
        const forbiddenChildren = parent.querySelectorAll(forbidden)
        forbiddenChildren.forEach((child) => {
          if (isNestedInParent(child, parent, doc)) {
            issues.push({
              rule: 'invalid-nesting',
              severity: 'error',
              message: `<${child.tagName.toLowerCase()}> não pode estar dentro de <${rule.parent}>`,
              suggestion: `Reestruturar HTML: mover <${forbidden}> para fora de <${rule.parent}>`,
              element: child.tagName.toLowerCase(),
              path: getElementPath(child),
            })
          }
        })
      }
    })
  }

  return issues
}

function analyzeEmptyElements(_root: Element): DomStructureIssue[] {
  const issues: DomStructureIssue[] = []

  const blockSelectors = 'div, section, article, aside, main, header, footer, nav, span'
  const elements = _root.querySelectorAll(blockSelectors)

  elements.forEach((el) => {
    const tag = el.tagName.toLowerCase()
    const hasContent = el.textContent?.trim() || el.children.length > 0
    const hasAttributes = el.attributes.length > 0

    if (!hasContent && !hasAttributes && tag !== 'br' && tag !== 'hr') {
      const parent = el.parentElement
      if (parent && parent.children.length === 1 && parent.tagName.toLowerCase() !== 'body') {
        issues.push({
          rule: 'unnecessary-wrapper',
          severity: 'info',
          message: `<${tag}> vazio sem atributos — possível wrapper desnecessário`,
          suggestion: 'Remover elemento wrapper vazio para simplificar o DOM',
          element: tag,
          path: getElementPath(el),
        })
      }
    }
  })

  return issues
}

// ============================================================================
// Accessibility Analysis
// ============================================================================

function analyzeAccessibility(root: Element): DomAccessibilityIssue[] {
  const issues: DomAccessibilityIssue[] = []

  // Images without alt
  root.querySelectorAll('img').forEach((img) => {
    if (!img.hasAttribute('alt')) {
      issues.push({
        rule: 'img-missing-alt',
        severity: 'error',
        message: 'Imagem sem atributo alt',
        suggestion: 'Adicionar alt="" para imagens decorativas ou texto descritivo para conteúdo',
        element: 'img',
        path: getElementPath(img),
      })
    }
  })

  // Images without src
  root.querySelectorAll('img:not([src])').forEach((img) => {
    issues.push({
      rule: 'img-missing-src',
      severity: 'error',
      message: 'Imagem sem atributo src',
      element: 'img',
      path: getElementPath(img),
    })
  })

  // Links without accessible text
  root.querySelectorAll('a').forEach((link) => {
    const text = link.textContent?.trim() || ''
    const ariaLabel = link.getAttribute('aria-label')
    const title = link.getAttribute('title')
    const hasImg = link.querySelector('img[alt]')

    if (!text && !ariaLabel && !title && !hasImg) {
      issues.push({
        rule: 'link-no-text',
        severity: 'error',
        message: 'Link sem texto acessível',
        suggestion: 'Adicionar texto visível, aria-label ou title ao link',
        element: 'a',
        path: getElementPath(link),
      })
    }
  })

  // Inputs without labels
  root.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach((input) => {
    const id = input.getAttribute('id')
    const ariaLabel = input.getAttribute('aria-label')
    const ariaLabelledBy = input.getAttribute('aria-labelledby')
    const title = input.getAttribute('title')
    const hasLabel = id && root.querySelector(`label[for="${id}"]`)
    const wrappedInLabel = input.closest('label')

    if (!hasLabel && !ariaLabel && !ariaLabelledBy && !title && !wrappedInLabel) {
      issues.push({
        rule: 'input-missing-label',
        severity: 'error',
        message: `Elemento <${input.tagName.toLowerCase()}> sem label associado`,
        suggestion: 'Adicionar <label for="id"> ou aria-label ao campo de formulário',
        element: input.tagName.toLowerCase(),
        path: getElementPath(input),
      })
    }
  })

  // Iframes without title
  root.querySelectorAll('iframe:not([title])').forEach((iframe) => {
    issues.push({
      rule: 'iframe-missing-title',
      severity: 'warning',
      message: 'Iframe sem atributo title',
      suggestion: 'Adicionar title="" ao iframe para acessibilidade',
      element: 'iframe',
      path: getElementPath(iframe),
    })
  })

  // Buttons without type
  root.querySelectorAll('button:not([type])').forEach((button) => {
    issues.push({
      rule: 'button-missing-type',
      severity: 'warning',
      message: 'Button sem atributo type explícito',
      suggestion: 'Adicionar type="button" ou type="submit" explicitamente',
      element: 'button',
      path: getElementPath(button),
    })
  })

  return issues
}

// ============================================================================
// Stats Collection
// ============================================================================

function collectStats(root: Element): DomStats {
  const allElements = root.querySelectorAll('*')
  const totalElements = allElements.length + 1

  let maxDepth = 0
  let totalDepth = 0
  let elementCount = 0

  function calculateDepth(element: Element, depth: number) {
    if (depth > maxDepth) maxDepth = depth
    totalDepth += depth
    elementCount++
    for (const child of Array.from(element.children)) {
      calculateDepth(child, depth + 1)
    }
  }

  const body = root.querySelector('body') || root
  calculateDepth(body, 0)

  const avgDepth = elementCount > 0 ? totalDepth / elementCount : 0

  return {
    totalElements,
    maxDepth,
    avgDepth: Math.round(avgDepth * 100) / 100,
    headingCount: root.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
    imageCount: root.querySelectorAll('img').length,
    linkCount: root.querySelectorAll('a').length,
    formCount: root.querySelectorAll('form').length,
  }
}

// ============================================================================
// Main entry point
// ============================================================================

export interface DomAnalysisOptions {
  maxDomDepth?: {
    warning: number
    error: number
  }
}

export function analyzeDom(
  html: string,
  options: DomAnalysisOptions = {},
): DomAnalysisResult {
  const { document: doc } = parseHTML(html)
  const root = doc.querySelector('body') || doc.documentElement

  const limits = options.maxDomDepth || DEFAULT_DOM_DEPTH_LIMITS

  // Build tree and analyze depth
  const body = doc.querySelector('body')
  const tree = body
    ? buildTree(body, 0, 'body')
    : { tag: 'html', depth: 0, path: 'html', children: [] }
  const depthIssues = analyzeDepth(tree, limits)

  // Analyze structure
  const headingIssues = analyzeHeadings(doc)
  const nestingIssues = analyzeNesting(doc, root)
  const emptyIssues = analyzeEmptyElements(root)

  // Analyze accessibility
  const accessibilityIssues = analyzeAccessibility(root)

  // Collect stats
  const stats = collectStats(root)

  return {
    depthIssues,
    structureIssues: [...headingIssues, ...nestingIssues, ...emptyIssues],
    accessibilityIssues,
    stats,
  }
}

// ============================================================================
// Convert DOM analysis to SeoIssue format for unified reporting
// ============================================================================

export function domAnalysisToSeoIssues(result: DomAnalysisResult): SeoIssue[] {
  const issues: SeoIssue[] = []

  for (const issue of result.depthIssues) {
    issues.push({
      rule: 'dom-depth',
      severity: issue.severity,
      message: `Aninhamento excessivo: ${issue.element} no nível ${issue.depth}`,
      details: issue.path,
      suggestion: issue.severity === 'error'
        ? 'Reduzir aninhamento — refatorar componentes ou layout'
        : 'Considerar reduzir profundidade do DOM',
      location: issue.path,
    })
  }

  for (const issue of result.structureIssues) {
    issues.push({
      rule: issue.rule,
      severity: issue.severity,
      message: issue.message,
      suggestion: issue.suggestion,
      location: issue.path,
    })
  }

  for (const issue of result.accessibilityIssues) {
    issues.push({
      rule: issue.rule,
      severity: issue.severity,
      message: issue.message,
      suggestion: issue.suggestion,
      location: issue.path,
    })
  }

  return issues
}
