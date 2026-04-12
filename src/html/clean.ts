import { CSS_LINK_RE, STYLE_TAG_RE, VUE_RUNTIME_RE, MODULEPRELOAD_RE, PREFETCH_RE, NUXT_DATA_RE } from '../types'

/** Remove stylesheet links and existing <style> tags */
export function stripExistingCss(html: string): string {
  return html.replace(CSS_LINK_RE, '').replace(STYLE_TAG_RE, '')
}

/** Remove Vue runtime scripts and preload/prefetch links */
export function stripVueRuntime(html: string): string {
  return html
    .replace(VUE_RUNTIME_RE, '')
    .replace(MODULEPRELOAD_RE, '')
    .replace(PREFETCH_RE, '')
}

/** Extract __NUXT_DATA__ payload content from HTML */
export function extractPayload(html: string): string | null {
  const match = html.match(NUXT_DATA_RE)
  return match?.[1] ?? null
}
