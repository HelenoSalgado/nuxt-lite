import { CSS_LINK_RE, STYLE_TAG_RE, VUE_RUNTIME_RE, MODULEPRELOAD_RE, PREFETCH_RE, NUXT_DATA_RE, NUXT_CONFIG_RE, TELEPORTS_RE } from '../types'

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

/** Remove Nuxt artifacts from HTML */
export function stripNuxtScripts(html: string): string {
  let result = html
    .replace(NUXT_DATA_RE, '')
    .replace(NUXT_CONFIG_RE, '')
    .replace(TELEPORTS_RE, '')
    .replace(/<script>window\.__NUXT__=[\s\S]*?<\/script>\s*/g, '')

  // Unwrap <div id="__nuxt"> — find its opening and matching closing tag
  const startIdx = result.search(/<div[^>]*id=["']?__nuxt["']?[^>]*>/)
  if (startIdx !== -1) {
    const openMatch = result.match(/<div[^>]*id=["']?__nuxt["']?[^>]*>/)
    if (openMatch) {
      const openTagEnd = startIdx + (openMatch?.[0]?.length || 0)
      // Count divs to find matching close
      let depth = 1
      let pos = openTagEnd
      while (depth > 0 && pos < result.length) {
        const nextOpen = result.indexOf('<div', pos)
        const nextClose = result.indexOf('</div>', pos)
        if (nextClose === -1) break
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++
          pos = nextOpen + 4
        } else {
          depth--
          if (depth === 0) {
            // Found matching close tag
            const before = result.slice(0, startIdx)
            const inner = result.slice(openTagEnd, nextClose)
            const after = result.slice(nextClose + 6).trimStart()
            result = before + inner + after
          } else {
            pos = nextClose + 6
          }
        }
      }
    }
  }

  return result
}
