import { defineContentConfig, defineCollection, z } from '@nuxt/content'

// ============================================================================
// Schema de frontmatter para documentos de documentação
// ============================================================================

const docSchema = z.object({
  // Identificação
  title: z.string().describe('Título do documento (usado no <title> e sidebar)'),
  description: z.string().describe('Descrição curta para SEO e meta description'),

  // Navegação
  navigation: z.object({
    title: z.string().describe('Título exibido na sidebar de navegação'),
    icon: z.string().emoji().describe('Emoji exibido como ícone na sidebar'),
    order: z.number().optional().describe('Ordem de exibição (fallback: ordem do arquivo)'),
  }).optional(),

  // SEO
  seo: z.object({
    keywords: z.array(z.string()).optional().describe('Palavras-chave para meta keywords'),
    ogImage: z.string().url().optional().describe('URL da imagem para Open Graph'),
    ogType: z.string().optional().describe('Tipo OG (website, article, etc.)'),
    canonical: z.string().url().optional().describe('URL canônico para evitar conteúdo duplicado'),
  }).optional(),

  // Metadados do documento
  meta: z.object({
    author: z.string().optional(),
    category: z.string().optional().describe('Categoria do documento'),
    tags: z.array(z.string()).optional().describe('Tags para busca e filtro'),
    version: z.string().optional().describe('Versão do módulo que o documento se refere'),
    lastUpdated: z.string().date().optional().describe('Data da última atualização (ISO 8601)'),
  }).optional(),

  // Controle de renderização
  draft: z.boolean().optional().describe('Se true, o documento não é exibido'),
  toc: z.boolean().optional().describe('Exibir índice do documento (padrão: true)'),
})

// ============================================================================
// Coleções
// ============================================================================

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: 'docs/*.mdc',
      schema: docSchema,
    }),
  },
})
