import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { readFileSync } from 'node:fs'
import type { ModuleOptions } from './types'
import { resolveCssMode, findOutputDir } from './types'
import { processAllHtml } from './html/process'

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

    nuxt.hook('close', async () => {
      const outputDir = findOutputDir(nuxt)
      if (!outputDir) {
        console.warn('[nuxt-lite] No output dir found — skipping')
        return
      }

      const runtimeSrc = readFileSync(resolver.resolve('./runtime/lite.js'), 'utf-8')
      const cssMode = resolveCssMode(options)

      const results = processAllHtml(outputDir, { ...options, _cssMode: cssMode }, runtimeSrc)
      console.log(
        `[nuxt-lite] Done — HTML: ${results.cleaned}`
        + ` | Payloads: ${results.payloads}`
        + ` | CSS optimized: ${results.cssOptimized}`,
      )
    })
  },
})
