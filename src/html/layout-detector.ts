/**
 * layout-detector.ts — Detecta o layout de cada página para agrupamento
 *
 * Páginas que compartilham o mesmo layout Nuxt (ex: layouts/default.vue)
 * têm estrutura HTML similar e podem ser comparadas via diff.
 *
 * Detecção: componente wrapper do `<main>` ou classe raiz do componente.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface PageInfo {
  route: string
  htmlPath: string
  html: string
  layout: string
}

/**
 * Detecta o layout de uma página HTML analisando seu componente wrapper.
 */
export function detectLayout(html: string): string {
  // Estratégia 1: data-v-hash do wrapper do <main>
  const beforeMain = html.substring(0, html.indexOf('<main') + 50)
  const wrapperMatch = beforeMain.match(/data-v-([a-zA-Z0-9_-]+)/)
  if (wrapperMatch) {
    return `layout-${wrapperMatch[1]}`
  }

  // Estratégia 2: classe do <main>
  const mainMatch = html.match(/<main[^>]*\bclass="([^"]*)"/i)
  if (mainMatch) {
    const firstClass = mainMatch[1]!.split(/\s+/)[0]
    if (firstClass && firstClass.length > 0) {
      return `layout-${firstClass}`
    }
  }

  // Estratégia 3: primeira classe significativa após <body>
  const bodySection = html.substring(0, html.indexOf('</head>') + 200)
  const classMatch = bodySection.match(/\bclass="([a-zA-Z][a-zA-Z0-9_-]*)/)
  if (classMatch) {
    return `layout-${classMatch[1]}`
  }

  return 'unknown'
}

/**
 * Coleta todas as páginas HTML do dist/ e agrupa por layout.
 */
export function collectPagesByLayout(distDir: string): Map<string, PageInfo[]> {
  const htmlFiles: string[] = []

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
      if (entry === 'index.html' || entry === '404.html' || entry === '200.html') {
        htmlFiles.push(full)
      }
    }
  }
  walk(distDir)

  const groups = new Map<string, PageInfo[]>()

  for (const htmlPath of htmlFiles) {
    const html = readFileSync(htmlPath, 'utf-8')
    const rel = relative(distDir, htmlPath)
    const route = '/' + rel
      .replace(/\/index\.html$/, '')
      .replace(/\.html$/, '')
      .replace(/\\/g, '/') || '/'

    const layout = detectLayout(html)

    if (!groups.has(layout)) groups.set(layout, [])
    groups.get(layout)!.push({ route, htmlPath, html, layout })
  }

  return groups
}
