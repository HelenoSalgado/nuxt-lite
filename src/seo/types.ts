// ============================================================================
// SEO Types — Interfaces for SEO analysis and reporting
// ============================================================================

export type SeoSeverity = 'error' | 'warning' | 'info' | 'success'

export interface SeoIssue {
  rule: string
  severity: SeoSeverity
  message: string
  details?: string
  suggestion?: string
  location?: string
}

export interface SeoReport {
  route: string
  issues: SeoIssue[]
  score: number // 0-100
  timestamp: string
}

// ============================================================================
// Metatag Types
// ============================================================================

export interface MetaTag {
  type: 'name' | 'property' | 'http-equiv' | 'charset'
  name: string
  content: string
}

export interface ExtractedMeta {
  title: string
  description?: string
  canonical?: string
  robots?: string
  viewport?: string
  charset?: string
  og: Record<string, string>
  twitter: Record<string, string>
  other: Record<string, string>
}

export interface MetaValidationRule {
  name: string
  required: boolean
  validate: (value: string | undefined, context: ExtractedMeta) => SeoIssue | null
  autoFix?: (value: string | undefined, context: ExtractedMeta) => string | null
}

export interface MetaAnalysisResult {
  present: boolean
  valid: boolean
  issues: SeoIssue[]
  value?: string
}

// ============================================================================
// DOM Analysis Types
// ============================================================================

export interface DomDepthIssue {
  element: string
  depth: number
  path: string
  severity: SeoSeverity
}

export interface DomStructureIssue {
  rule: string
  severity: SeoSeverity
  message: string
  element?: string
  path?: string
  suggestion?: string
}

export interface DomAccessibilityIssue {
  rule: string
  severity: SeoSeverity
  message: string
  element?: string
  path?: string
  suggestion?: string
}

export interface DomAnalysisResult {
  depthIssues: DomDepthIssue[]
  structureIssues: DomStructureIssue[]
  accessibilityIssues: DomAccessibilityIssue[]
  stats: DomStats
}

export interface DomStats {
  totalElements: number
  maxDepth: number
  avgDepth: number
  headingCount: number
  imageCount: number
  linkCount: number
  formCount: number
}

// ============================================================================
// SEO Module Options
// ============================================================================

export interface SeoModuleOptions {
  /**
   * Enable SEO analysis and auto-fix.
   * - `true` | `'analyze'`: Run analysis and report issues
   * - `'fix'`: Auto-fix issues where possible + report
   */
  optimizeSeo?: boolean | 'analyze' | 'fix'

  /**
   * Maximum allowed DOM depth before warning/error
   */
  maxDomDepth?: {
    warning: number
    error: number
  }

  /**
   * Auto-replicate meta tags (og:title from title, etc.)
   * @default true
   */
  autoReplicate?: boolean

  /**
   * Auto-inject missing meta tags
   * @default false (only in 'fix' mode)
   */
  autoInject?: boolean

  /**
   * Fail build on SEO errors
   * @default false
   */
  failOnError?: boolean

  /**
   * Output report file
   * @default true
   */
  writeReport?: boolean
}
