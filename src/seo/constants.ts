// ============================================================================
// SEO Constants — Listas de tags essenciais, depreciadas e padrões de validação
// ============================================================================

// ============================================================================
// Meta tags essenciais que toda página deve ter
// ============================================================================

export const REQUIRED_META_TAGS = Object.freeze([
  'description',
  'viewport',
  'charset',
]) as ReadonlyArray<string>

export const REQUIRED_OG_TAGS = Object.freeze([
  'og:title',
  'og:description',
  'og:type',
  'og:url',
]) as ReadonlyArray<string>

export const RECOMMENDED_OG_TAGS = Object.freeze([
  'og:image',
  'og:site_name',
  'og:locale',
]) as ReadonlyArray<string>

export const REQUIRED_TWITTER_TAGS = Object.freeze([
  'twitter:card',
]) as ReadonlyArray<string>

export const RECOMMENDED_TWITTER_TAGS = Object.freeze([
  'twitter:title',
  'twitter:description',
  'twitter:image',
]) as ReadonlyArray<string>

// ============================================================================
// Meta tags depreciadas / obsoletas
// ============================================================================

export const DEPRECATED_META_TAGS = Object.freeze([
  'keywords', // 搜索引擎不再使用
  'revised', // Não suportado por motores de busca
  'abstract', // Obsoleto
  'topic', // Obsoleto
  'summary', // Obsoleto
  'author', // Usar schema.org em vez disso
  'owner', // Obsoleto
  'url', // Usar canonical em vez disso
  'identifier-URL', // Obsoleto
  'category', // Obsoleto
  'coverage', // Obsoleto
  'distribution', // Obsoleto
  'rating', // Obsoleto
  'revisit-after', // Google ignora isso
  'generator', // Expondo tecnologia usada (segurança)
  'cache-control', // Usar HTTP headers em vez disso
  'pragma', // Usar HTTP headers em vez disso
  'expires', // Usar HTTP headers em vez disso
]) as ReadonlyArray<string>

// ============================================================================
// Regras de replicação automática
// Source -> Target: se target ausente, copiar de source
// ============================================================================

export interface ReplicationRule {
  target: string
  targetType: 'property' | 'name'
  sources: Array<{ type: 'title' | 'meta' | 'og' | 'twitter', key: string }>
}

export const AUTO_REPLICATE_RULES: ReplicationRule[] = Object.freeze([
  {
    target: 'og:title',
    targetType: 'property',
    sources: [{ type: 'og', key: 'title' }, { type: 'title', key: '' }],
  },
  {
    target: 'og:description',
    targetType: 'property',
    sources: [
      { type: 'og', key: 'description' },
      { type: 'meta', key: 'description' },
    ],
  },
  {
    target: 'og:image:alt',
    targetType: 'property',
    sources: [{ type: 'meta', key: 'description' }, { type: 'title', key: '' }],
  },
  {
    target: 'twitter:title',
    targetType: 'name',
    sources: [
      { type: 'twitter', key: 'title' },
      { type: 'og', key: 'title' },
      { type: 'title', key: '' },
    ],
  },
  {
    target: 'twitter:description',
    targetType: 'name',
    sources: [
      { type: 'twitter', key: 'description' },
      { type: 'og', key: 'description' },
      { type: 'meta', key: 'description' },
    ],
  },
  {
    target: 'twitter:image',
    targetType: 'name',
    sources: [
      { type: 'twitter', key: 'image' },
      { type: 'og', key: 'image' },
    ],
  },
  {
    target: 'twitter:image:alt',
    targetType: 'name',
    sources: [{ type: 'og', key: 'image:alt' }, { type: 'meta', key: 'description' }],
  },
]) as ReadonlyArray<ReplicationRule>

// ============================================================================
// Limites de tamanho para conteúdo de meta tags
// ============================================================================

export const META_LENGTH_LIMITS = Object.freeze({
  title: {
    min: 10,
    recommendedMin: 30,
    recommendedMax: 60,
    absoluteMax: 70,
  },
  description: {
    min: 50,
    recommendedMin: 120,
    recommendedMax: 160,
    absoluteMax: 300,
  },
  ogTitle: {
    min: 10,
    recommendedMax: 65,
  },
  ogDescription: {
    min: 50,
    recommendedMax: 200,
  },
  twitterDescription: {
    min: 50,
    recommendedMax: 200,
  },
}) as Readonly<{ [key: string]: { min?: number, recommendedMin?: number, recommendedMax?: number, absoluteMax?: number } }>

// ============================================================================
// Tipos de conteúdo og:image suportados
// ============================================================================

export const SUPPORTED_IMAGE_EXTENSIONS = Object.freeze([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif',
]) as ReadonlyArray<string>

export const RECOMMENDED_IMAGE_SIZE = Object.freeze({
  minWidth: 1200,
  minHeight: 630,
  recommendedWidth: 1200,
  recommendedHeight: 630,
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
}) as Readonly<{ [key: string]: number }>

// ============================================================================
// Default DOM depth thresholds
// ============================================================================

export const DEFAULT_DOM_DEPTH_LIMITS = Object.freeze({
  warning: 5,
  error: 8,
}) as Readonly<{ warning: number, error: number }>

// ============================================================================
// Heading order — sequência válida
// ============================================================================

export const VALID_HEADING_ORDER = Object.freeze(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) as ReadonlyArray<string>

export const RECOMMENDED_H1_COUNT = 1

// ============================================================================
// Void elements (não podem ter filhos)
// ============================================================================

export const VOID_ELEMENTS = Object.freeze([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]) as ReadonlyArray<string>

// ============================================================================
// Elementos que não devem conter certos filhos (regras HTML)
// ============================================================================

export const INVALID_NESTING_RULES = Object.freeze([
  { parent: 'p', cannotContain: ['div', 'section', 'article', 'aside', 'main', 'header', 'footer', 'nav', 'form', 'table', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'dl', 'figure', 'address', 'details', 'menu', 'hr'] },
  { parent: 'a', cannotContain: ['a'] },
  { parent: 'button', cannotContain: ['button', 'a', 'input', 'select', 'textarea'] },
  { parent: 'form', cannotContain: ['form'] },
  { parent: 'label', cannotContain: ['label'] },
  { parent: 'select', cannotContain: ['input', 'select', 'textarea'] },
  { parent: 'table', cannotContain: ['table'] },
  { parent: 'h1', cannotContain: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'main', 'section', 'article', 'aside', 'nav'] },
  { parent: 'h2', cannotContain: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'main', 'section', 'article', 'aside', 'nav'] },
  { parent: 'h3', cannotContain: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'main', 'section', 'article', 'aside', 'nav'] },
  { parent: 'h4', cannotContain: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'main', 'section', 'article', 'aside', 'nav'] },
  { parent: 'h5', cannotContain: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'main', 'section', 'article', 'aside', 'nav'] },
  { parent: 'h6', cannotContain: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'main', 'section', 'article', 'aside', 'nav'] },
  { parent: 'option', cannotContain: ['option'] },
  { parent: 'optgroup', cannotContain: ['optgroup'] },
  { parent: 'colgroup', cannotContain: ['colgroup', 'tbody', 'tfoot', 'thead'] },
  { parent: 'tbody', cannotContain: ['tbody', 'tfoot', 'thead'] },
  { parent: 'tfoot', cannotContain: ['tbody', 'tfoot', 'thead'] },
  { parent: 'thead', cannotContain: ['tbody', 'tfoot', 'thead'] },
  { parent: 'tr', cannotContain: ['tr'] },
  { parent: 'dd', cannotContain: ['dd', 'dt'] },
  { parent: 'dt', cannotContain: ['dd', 'dt'] },
  { parent: 'figcaption', cannotContain: ['figcaption'] },
  { parent: 'fieldset', cannotContain: ['fieldset'] },
  { parent: 'legend', cannotContain: ['legend'] },
  { parent: 'caption', cannotContain: ['caption'] },
  { parent: 'th', cannotContain: ['th', 'thead', 'tbody', 'tfoot', 'tr'] },
  { parent: 'td', cannotContain: ['th', 'thead', 'tbody', 'tfoot', 'tr'] },
]) as ReadonlyArray<{ parent: string, cannotContain: ReadonlyArray<string> }>

// ============================================================================
// Attributes that should always exist on certain elements
// ============================================================================

export const REQUIRED_ATTRIBUTES = Object.freeze([
  { element: 'img', attribute: 'alt', message: 'Imagens devem ter atributo alt para acessibilidade' },
  { element: 'img', attribute: 'src', message: 'Imagens devem ter atributo src' },
  { element: 'a', attribute: 'href', message: 'Links devem ter atributo href' },
  { element: 'input', attribute: 'type', message: 'Inputs devem ter atributo type' },
  { element: 'link', attribute: 'rel', message: 'Links de stylesheet devem ter rel' },
  { element: 'link', attribute: 'href', message: 'Links devem ter href' },
  { element: 'script', attribute: 'src', message: 'Scripts externos devem ter src' },
  { element: 'iframe', attribute: 'title', message: 'Iframes devem ter title para acessibilidade' },
  { element: 'button', attribute: 'type', message: 'Buttons devem ter type explícito' },
]) as ReadonlyArray<{ element: string, attribute: string, message: string }>

// ============================================================================
// Severity weights for scoring
// ============================================================================

export const SEVERITY_WEIGHTS = Object.freeze({
  error: 15,
  warning: 5,
  info: 1,
  success: 0,
}) as Readonly<{ [key in import('./types').SeoSeverity]: number }>
