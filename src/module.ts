import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ModuleOptions } from './types'
import { resolveCssMode, findOutputDir } from './types'
import { processAllHtml } from './html/process'
import { collectPagesByLayout } from './html/layout-detector'
import { diffGroup } from './html/diff'

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
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Only run nuxt-lite for production builds (nuxt generate)
    if (nuxt.options.dev) {
      return
    }

    nuxt.hook('close', async () => {
      const outputDir = findOutputDir(nuxt)
      if (!outputDir) {
        console.warn('[nuxt-lite] No output dir found — skipping')
        return
      }

      const runtimeSrc = readFileSync(resolver.resolve('./runtime/lite.js'), 'utf-8')
      const cssMode = resolveCssMode(options)

      // Phase 1: CSS optimization + HTML processing (existente)
      const results = processAllHtml(outputDir, { ...options, _cssMode: cssMode }, runtimeSrc)

      // Phase 2: Detect layouts + diff pages + generate payloads
      console.log('\n  ┌─ nuxt-lite: diff & payloads ──────')
      const layoutGroups = collectPagesByLayout(outputDir)

      const nlDir = join(outputDir, '_nuxt-lite')
      mkdirSync(nlDir, { recursive: true })

      const manifest: Record<string, { template: string; blocks: number }> = {}
      let totalPayloads = 0
      let totalBlocks = 0

      for (const [layout, pages] of layoutGroups) {
        if (pages.length === 0) continue

        console.log(`  │  Layout "${layout}": ${pages.length} pages`)

        const diffResult = diffGroup(pages)

        if (diffResult.blockCount === 0) continue

        // Salvar template
        const templateName = layout.replace(/[^a-zA-Z0-9_-]/g, '_')
        const templatePath = join(nlDir, `${templateName}.html`)
        writeFileSync(templatePath, diffResult.templateHtml, 'utf-8')

        // Substituir o HTML de cada página pelo template com marcadores
        // Assim o runtime encontra <!--NL:N--> no DOM
        for (const page of pages) {
          writeFileSync(page.htmlPath, diffResult.templateHtml, 'utf-8')
        }

        // Salvar payloads na estrutura de diretórios da rota
        for (const [route, payload] of diffResult.payloads) {
          // Gerar payload NO CAMINHO DA ROTA, substituindo o _payload.json do Nuxt
          // Ex: /manuscritos/despertar → dist/manuscritos/despertar/_payload.json
          // Ex: / → dist/_payload.json
          const routePath = route === '/' ? '' : route.replace(/^\//, '').replace(/\/$/, '')
          const payloadDir = routePath ? join(outputDir, routePath) : outputDir
          mkdirSync(payloadDir, { recursive: true })
          const payloadPath = join(payloadDir, '_payload.json')
          writeFileSync(payloadPath, JSON.stringify(payload), 'utf-8')
          totalPayloads++

          manifest[route] = {
            template: `${templateName}.html`,
            blocks: diffResult.blockCount,
          }
        }

        totalBlocks += diffResult.blockCount
      }

      // Salvar manifest
      writeFileSync(
        join(nlDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8',
      )

      console.log(`  │`)
      console.log(`  │  ✓ Groups:          ${layoutGroups.size}`)
      console.log(`  │  ✓ Payloads:        ${totalPayloads}`)
      console.log(`  │  ✓ Total blocks:    ${totalBlocks}`)
      console.log(`  │  ✓ Manifest:        _nuxt-lite/manifest.json`)
      console.log(`  └─────────────────────────────────────`)
    })
  },
})
