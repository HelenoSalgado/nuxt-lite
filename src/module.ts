/**
 * module.ts — Main Nuxt module entry point
 *
 * Handles module lifecycle, hooks configuration, and coordinates
 * CSS optimization, HTML processing, and SEO analysis during build.
 */

// ============================================================================
// Node stdlib
// ============================================================================
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// ============================================================================
// External dependencies
// ============================================================================
import { createResolver, defineNuxtModule } from '@nuxt/kit'

// ============================================================================
// Type imports
// ============================================================================
import type { ExtendedOptions, ModuleOptions } from './types'

// ============================================================================
// Local imports - utils
// ============================================================================
import { findOutputDir, resolveColorConfig, resolveCssMode, resolveSeoConfig, resolveSvgConfig } from './types'

// ============================================================================
// Local imports - modules
// ============================================================================
import { filterCssBySelectors } from './css/filter'
import { parseCssRules } from './css/parser'
import { collectAllCssFiles, pruneNuxtArtifacts, removeRedundantCssFiles } from './fs'
import { processPageContent } from './html/process'
import { generateSpriteContainer } from './html/svg'

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
    const seoConfig = resolveSeoConfig(options)
    const svgConfig = resolveSvgConfig(options)
    const colorConfig = resolveColorConfig(options)
    const extendedOptions: ExtendedOptions = {
      ...options,
      _cssMode: cssMode,
      _seoMode: seoConfig.mode,
      _seoResolved: { ...seoConfig.settings, enabled: seoConfig.enabled },
      _svgResolved: { ...svgConfig.settings, enabled: svgConfig.enabled },
      _colorResolved: { ...colorConfig.settings, enabled: colorConfig.enabled },
      _buildAssetsDir: nuxt.options.app.buildAssetsDir || '/_nuxt/',
      criticalCss: options.criticalCss ?? false,
    }

    if (nuxt.options.dev) return

    const globalUsedSelectors = new Set<string>()
    const dataVMapping = new Map<string, string>()
    const routeSymbols = new Map<string, any[]>()
    const pageManifest: Record<string, { meta: any, domSize: number }> = {}
    const seoReports = new Map<string, import('./seo/types').SeoReport>()

    // Hook: nitro:config — intercept HTML, inject SLOT markers and process page
    nuxt.hook('nitro:config', (nitroConfig: any) => {
      nitroConfig.hooks = nitroConfig.hooks || {}

      nitroConfig.hooks['prerender:generate'] = async (route: any) => {
        if (!route || typeof route.contents !== 'string') return
        if (!route.route || route.skip) return
        if (route.route.startsWith('/_nuxt') || route.route.startsWith('/__') || route.route.startsWith('/_ipx/')) return
        if (route.route === '/200.html' || route.route === '/404.html' || route.error) return
        if (/\.(json|xml|txt|webp|png|jpg|svg|css|js)$/i.test(route.route)) return
        if (!route.contents.includes('<!DOCTYPE html>') && !route.contents.includes('<html')) return

        // Normalize route to avoid duplicates (e.g. /about vs /about/)
        const normalizedRoute = route.route === '/' ? '/' : route.route.replace(/\/$/, '')
        let html = route.contents as string

        // 1. Process Page (Clean, Inject Runtime script tag, etc.)
        const { html: processedHtml, usedSelectors, symbols } = processPageContent(html, extendedOptions, '')
        html = processedHtml

        // Store symbols for payload later
        if (symbols && symbols.size > 0) {
          routeSymbols.set(normalizedRoute, Array.from(symbols.values()))
        }

        // 1b. SEO Processing (if enabled)
        if (seoConfig.enabled && !seoReports.has(normalizedRoute)) {
          const { processSeoMeta } = await import('./seo/metatags')
          const { analyzeDom, domAnalysisToSeoIssues } = await import('./seo/dom-analysis')

          // Process meta tags
          const seoResult = processSeoMeta(html, normalizedRoute, seoConfig.mode)
          html = seoResult.html

          // Analyze DOM structure
          const domResult = analyzeDom(html, {
            maxDomDepth: seoConfig.settings.maxDomDepth,
          })

          // Combine issues
          seoResult.report.issues.push(...domAnalysisToSeoIssues(domResult))

          // Store report for consolidation
          seoReports.set(normalizedRoute, seoResult.report)

          // Log single page summary
          const scoreColor = seoResult.report.score >= 90 ? '\x1B[32m' : seoResult.report.score >= 70 ? '\x1B[33m' : '\x1B[31m'
          const reset = '\x1B[0m'
          console.log(`  [nuxt-lite:seo] ${normalizedRoute} — Score: ${scoreColor}${seoResult.report.score}${reset}/100`)
        }

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
            }
            else {
              depth--
              if (depth === 0) {
                marked = html.slice(0, afterOpen) + '<!--NL:SLOT_START-->' + html.slice(afterOpen, nc) + '<!--NL:SLOT_END-->' + html.slice(nc)
              }
              else {
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
          domSize: JSON.stringify(payload.dom).length,
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
      }
      catch {
        // Fallback to source if not found (should be there in production)
        try {
          runtimeSrc = readFileSync(resolver.resolve('./runtime/lite.js'), 'utf-8')
        }
        catch {
          runtimeSrc = 'console.warn("[nuxt-lite] Runtime not found")'
        }
      }
      writeFileSync(runtimePath, runtimeSrc, 'utf-8')

      let totalPayloads = 0

      // 2. CSS Optimization & Page Processing
      if (cssMode !== 'none' || options.cleanHtml) {
        const allCss = collectAllCssFiles(outputDir)
        let combined = ''
        for (const [, content] of allCss) combined += content + ' '
        const rules = parseCssRules(combined)

        // Identify alive data-v hashes and build mapping
        dataVMapping.clear()
        const aliveHashes = new Set<string>()
        for (const selector of rules.keys()) {
          const match = selector.match(/\[data-v-([a-z0-9]+)\]/i)
          if (match) aliveHashes.add(match[1])
        }
        let hashIdx = 1
        aliveHashes.forEach(h => dataVMapping.set(h, `s${hashIdx++}`))

        // Process all HTML files
        const htmlFiles: string[] = []
        function collectHtml(d: string) {
          if (!existsSync(d)) return
          for (const entry of readdirSync(d)) {
            if (entry.startsWith('.') || (entry.startsWith('_') && entry !== '_nuxt')) continue
            const full = join(d, entry)
            const st = statSync(full)
            if (st.isDirectory()) { collectHtml(full); continue }
            if (entry === 'index.html' || entry.endsWith('.html')) htmlFiles.push(full)
          }
        }
        collectHtml(outputDir)

        const { parseHTML } = await import('linkedom')
        const { stripDataVAttributes, stripNuxtScripts } = await import('./html/clean')
        const { extractUsedSelectors } = await import('./html/extract')
        const { extractSlotContent, extractMetaTags } = await import('./html/serialize')
        const { filterCssToMap, rulesMapToCss } = await import('./css/filter')

        for (const htmlPath of htmlFiles) {
          const html = readFileSync(htmlPath, 'utf-8')
          const { document } = parseHTML(html)

          // A) Extract Payload BEFORE stripping markers
          const relPath = relative(outputDir, htmlPath)
          let routePath = relPath.replace(/(^|\/)index\.html$/, '').replace(/\\/g, '/')
          if (routePath.endsWith('.html')) routePath = routePath.replace(/\.html$/, '')
          const route = routePath === '' ? '/' : '/' + routePath.replace(/\/$/, '') + '/'

          const startIdx = html.indexOf('<!--NL:SLOT_START-->')
          const endIdx = html.indexOf('<!--NL:SLOT_END-->')

          if (startIdx !== -1 && endIdx !== -1) {
            const slotHtml = html.substring(startIdx + '<!--NL:SLOT_START-->'.length, endIdx)
            const normalizedRoute = route === '/' ? '/' : route.replace(/\/$/, '')
            const symbols = routeSymbols.get(normalizedRoute) || []

            const payload = {
              dom: extractSlotContent(slotHtml),
              meta: extractMetaTags(html),
              symbols,
            }

            let payloadPath: string
            if (route === '/') payloadPath = join(outputDir, '_payload.json')
            else {
              const dir = join(outputDir, routePath)
              if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
              payloadPath = join(dir, '_payload.json')
            }
            writeFileSync(payloadPath, JSON.stringify(payload), 'utf-8')
            totalPayloads++

            // B) Strip data-v (Short-hashing only for alive hashes)
            if (options.cleanHtml) {
              stripDataVAttributes(document, dataVMapping)
            }

            // C) CSS Extraction with Duplication Prevention
            let criticalRules = new Map<string, string>()

            if (options.criticalCss && rules.size > 0) {
              const layoutSelectors = extractUsedSelectors(document.toString(), options.safelist, '[data-page-content], main')
              criticalRules = filterCssToMap(rules, layoutSelectors, dataVMapping)
              const criticalCss = rulesMapToCss(criticalRules)

              if (criticalCss) {
                const styleEl = document.createElement('style')
                styleEl.setAttribute('data-nl-critical', '')
                styleEl.textContent = criticalCss
                document.head.appendChild(styleEl)
              }
            }

            if (cssMode === 'inline') {
              const currentUsed = extractUsedSelectors(document.toString(), options.safelist)
              const allPageRules = filterCssToMap(rules, currentUsed, dataVMapping)

              // SUBTRACT critical rules from the full set to avoid duplication
              if (criticalRules.size > 0) {
                for (const key of criticalRules.keys()) {
                  allPageRules.delete(key)
                }
              }

              const optimized = rulesMapToCss(allPageRules)
              if (optimized) {
                const styleEl = document.createElement('style')
                styleEl.textContent = optimized
                document.head.appendChild(styleEl)
              }
            }

            // E) Final HTML cleanup
            let finalHtml = document.toString()
              .replace(/<!--NL:SLOT_START-->/g, '')
              .replace(/<!--NL:SLOT_END-->/g, '')

            // Inject SVG sprite
            if (symbols.length > 0) {
              const { generateSpriteContainer } = await import('./html/svg')
              const symbolMap = new Map(symbols.map((s: any) => [s.id, s]))
              const spriteContainer = generateSpriteContainer(symbolMap)
              finalHtml = finalHtml.replace('</body>', `${spriteContainer}</body>`)
            }

            writeFileSync(htmlPath, finalHtml, 'utf-8')
          }
        }

        if (cssMode === 'file') {
          const optimized = filterCssBySelectors(rules, globalUsedSelectors, dataVMapping)
          const cssDir = join(outputDir, 'css')
          if (!existsSync(cssDir)) mkdirSync(cssDir, { recursive: true })
          const outPath = join(cssDir, 'optimized.css')
          writeFileSync(outPath, optimized, 'utf-8')
          removeRedundantCssFiles(outputDir, outPath)
          console.log(`  │  ✓ CSS optimized:    ${(optimized.length / 1024).toFixed(1)}KB`)
        }
        else if (cssMode === 'inline') {
          console.log(`  │  ✓ CSS inlined:      ${htmlFiles.length} pages`)
        }
      }

      // 4. Finalize build artifacts
      if (options.pruneOutput) {
        const removed = pruneNuxtArtifacts(outputDir)
        if (removed.length > 0) {
          console.log(`  │  ✓ Pruned:           ${removed.length} unused artifacts`)
        }
      }

      writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(pageManifest, null, 2), 'utf-8')

      console.log(`  │  ✓ Payloads:      ${totalPayloads}`)
      console.log(`  │  ✓ Manifest:      /manifest.json`)
      console.log(`  │  ✓ Runtime:       /lite.min.js`)

      // 4. SEO Reports (if enabled)
      if (seoConfig.enabled && seoReports.size > 0) {
        const reportsArray = Array.from(seoReports.values())
        const { printAndSaveReports } = await import('./seo/report')
        const reportResult = printAndSaveReports(reportsArray, outputDir, seoConfig.settings.writeReport, nuxt.options.rootDir)
        if (reportResult.md) {
          console.log(`  │  ✓ SEO Report:      ${relative(nuxt.options.rootDir, reportResult.md)}`)
        }
        else if (reportResult.json) {
          console.log(`  │  ✓ SEO Report:      ${relative(outputDir, reportResult.json)}`)
        }

        // Check for SEO errors if failOnError is enabled
        if (seoConfig.settings.failOnError) {
          const errorCount = reportsArray.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'error').length, 0)
          if (errorCount > 0) {
            console.error(`\n  ❌ [nuxt-lite:seo] Build failed due to ${errorCount} SEO error(s)`)
            process.exit(1)
          }
        }
      }

      console.log(`  └─────────────────────────────────────`)
    })
  },
})
