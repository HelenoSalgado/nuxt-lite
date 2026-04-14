import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { ModuleOptions, ExtendedOptions } from './types'
import { resolveCssMode, findOutputDir } from './types'
import { processPageContent } from './html/process'
import { collectAllCssFiles, removeRedundantCssFiles } from './fs'
import { parseCssRules } from './css/parser'
import { filterCssBySelectors } from './css/filter'

export type { ModuleOptions } from './types'

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-lite',
    configKey: 'nuxtLite',
    compatibility: { nuxt: '^4.0.0' },
  },
  defaults: {
    optimizeCss: false,
    inlineStyles: false,
    cleanHtml: true,
    safelist: [],
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    const cssMode = resolveCssMode(options)
    const extendedOptions: ExtendedOptions = { ...options, _cssMode: cssMode }

    if (nuxt.options.dev) return

    let cssRules: Map<string, string> | null = null
    const globalUsedSelectors = new Set<string>()
    const pageManifest: Record<string, { meta: any, domSize: number }> = {}

    // Hook: nitro:config — intercept HTML, inject SLOT markers and process page
    nuxt.hook('nitro:config', (nitroConfig: any) => {
      nitroConfig.hooks = nitroConfig.hooks || {}
      
      nitroConfig.hooks['prerender:generate'] = async (route: any) => {
        // Only process HTML pages
        if (!route || typeof route.contents !== 'string') return
        if (!route.route || route.skip) return
        if (route.route.startsWith('/_nuxt') || route.route.startsWith('/__') || route.route.startsWith('/_ipx/')) return
        if (/\.(json|xml|txt|webp|png|jpg|svg|css|js)$/i.test(route.route)) return
        if (!route.contents.includes('<!DOCTYPE html>') && !route.contents.includes('<html')) return

        let html = route.contents as string

        // 1. Process Page (Clean, Inject Runtime script tag, etc.)
        const { html: processedHtml, usedSelectors } = processPageContent(html, extendedOptions, '')
        html = processedHtml

        // Accumulate selectors for global CSS mode
        if (cssMode === 'file') {
          usedSelectors.forEach(s => globalUsedSelectors.add(s))
        }

        // 2. Inject SLOT markers around <main> for payload extraction
        let marked = html
        const mainMatch = html.match(/<main([^>]*)>/i)
        if (mainMatch) {
          const openTag = `<main${mainMatch[1] || ''}>`
          const afterOpen = mainMatch.index! + openTag.length
          let depth = 1, pos = afterOpen
          while (depth > 0 && pos < html.length) {
            const no = html.indexOf('<main', pos)
            const nc = html.indexOf('</main>', pos)
            if (nc === -1) break
            if (no !== -1 && no < nc) {
              depth++
              pos = no + 5
            } else {
              depth--
              if (depth === 0) {
                marked = html.slice(0, afterOpen) + '<!--NL:SLOT_START-->' + html.slice(afterOpen, nc) + '<!--NL:SLOT_END-->' + html.slice(nc)
              } else {
                pos = nc + 7
              }
            }
          }
        }

        // 3. Extract payload
        const { serializePage } = await import('./html/serialize')
        const payload = serializePage(marked)
        
        // Save payload meta for manifest
        const routeKey = route.route === '' ? '/' : (route.route.endsWith('/') ? route.route : route.route + '/')
        pageManifest[routeKey] = { 
          meta: payload.meta, 
          domSize: JSON.stringify(payload.dom).length 
        }

        // Store payload in route so we can write it in nitro:close or similar
        // Actually, we can just write it here if we find the output dir
        // But better to do it once we have the output dir in 'close'
        
        route.contents = marked
      }
    })

    // Hook: close — CSS optimization + save payloads + manifest
    nuxt.hook('close', async () => {
      const outputDir = findOutputDir(nuxt)
      if (!outputDir) {
        console.warn('[nuxt-lite] No output dir — skipping post-processing')
        return
      }

      console.log('\n  ┌─ nuxt-lite: Finalizing build ───────')

      // 1. Setup Runtime (external file)
      const runtimePath = join(outputDir, 'lite.js')
      // Try to find the pre-built minified runtime
      let runtimeSrc: string
      try {
        runtimeSrc = readFileSync(resolver.resolve('../dist/runtime/lite.min.js'), 'utf-8')
      } catch {
        // Fallback to source if not found (should be there in production)
        try {
          runtimeSrc = readFileSync(resolver.resolve('./runtime/lite.js'), 'utf-8')
        } catch {
          runtimeSrc = 'console.warn("[nuxt-lite] Runtime not found")'
        }
      }
      writeFileSync(runtimePath, runtimeSrc, 'utf-8')

      // 2. CSS Optimization
      if (cssMode !== 'none') {
        const allCss = collectAllCssFiles(outputDir)
        if (allCss.size > 0) {
          let combined = ''
          for (const [, content] of allCss) combined += content + ' '
          const rules = parseCssRules(combined)

          if (cssMode === 'file') {
            const optimized = filterCssBySelectors(rules, globalUsedSelectors)
            const cssDir = join(outputDir, 'css')
            if (!existsSync(cssDir)) mkdirSync(cssDir, { recursive: true })
            const outPath = join(cssDir, 'optimized.css')
            writeFileSync(outPath, optimized, 'utf-8')
            removeRedundantCssFiles(outputDir, outPath)
            console.log(`  │  ✓ CSS optimized:    ${(optimized.length / 1024).toFixed(1)}KB`)
          } else if (cssMode === 'inline') {
             // In inline mode, we have to re-read HTML because we didn't have the CSS rules 
             // during prerender:generate (chicken-and-egg problem)
             // This is the ONLY time we read HTML back.
             const htmlFiles: string[] = []
             function collectHtml(d: string) {
               for (const entry of readdirSync(d)) {
                 const full = join(d, entry)
                 if (statSync(full).isDirectory()) collectHtml(full)
                 else if (entry === 'index.html') htmlFiles.push(full)
               }
             }
             collectHtml(outputDir)
             
             for (const path of htmlFiles) {
               let html = readFileSync(path, 'utf-8')
               const used = new Set(globalUsedSelectors) // Fallback or re-extract
               // For accuracy, we re-extract used selectors from the processed HTML
               const { extractUsedSelectors } = await import('./html/extract')
               const currentUsed = extractUsedSelectors(html, options.safelist)
               const optimized = filterCssBySelectors(rules, currentUsed)
               html = html.replace('</head>', `<style>${optimized}</style></head>`)
               writeFileSync(path, html, 'utf-8')
             }
             console.log(`  │  ✓ CSS inlined:      ${htmlFiles.length} pages`)
          }
        }
      }

      // 3. Save Payloads & Manifest
      let totalPayloads = 0
      const htmlFiles: string[] = []
      function collectHtml(d: string) {
        if (!existsSync(d)) return
        for (const entry of readdirSync(d)) {
          if (entry.startsWith('.') || entry.startsWith('_')) continue
          const full = join(d, entry)
          const st = statSync(full)
          if (st.isDirectory()) { collectHtml(full); continue }
          if (entry === 'index.html') htmlFiles.push(full)
        }
      }
      collectHtml(outputDir)

      const { extractSlotContent, extractMetaTags } = await import('./html/serialize')

      for (const htmlPath of htmlFiles) {
        const html = readFileSync(htmlPath, 'utf-8')
        const relPath = relative(outputDir, htmlPath)
        
        let routePath = relPath.replace(/(^|\/)index\.html$/, '').replace(/\\/g, '/')
        if (routePath.endsWith('.html')) routePath = routePath.replace(/\.html$/, '')
        const route = routePath === '' ? '/' : '/' + routePath.replace(/\/$/, '') + '/'

        const startIdx = html.indexOf('<!--NL:SLOT_START-->')
        const endIdx = html.indexOf('<!--NL:SLOT_END-->')
        if (startIdx !== -1 && endIdx !== -1) {
          const slotHtml = html.substring(startIdx + '<!--NL:SLOT_START-->'.length, endIdx)
          const payload = { dom: extractSlotContent(slotHtml), meta: extractMetaTags(html) }
          
          let payloadPath: string
          if (route === '/') {
            payloadPath = join(outputDir, '_payload.json')
          } else {
            const dir = join(outputDir, routePath)
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
            payloadPath = join(dir, '_payload.json')
          }
          writeFileSync(payloadPath, JSON.stringify(payload), 'utf-8')
          totalPayloads++
        }
      }

      writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(pageManifest, null, 2), 'utf-8')

      console.log(`  │  ✓ Payloads:      ${totalPayloads}`)
      console.log(`  │  ✓ Manifest:      /manifest.json`)
      console.log(`  │  ✓ Runtime:       /lite.js`)
      console.log(`  └─────────────────────────────────────`)
    })
  },
})
