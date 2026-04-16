/**
 * nuxt-lite — Client Runtime (TypeScript)
 *
 * - SPA navigation with DOM reconstruction via JSON payload
 * - Reactive state system (Proxy-based)
 * - A11y: focus management on navigation
 */

interface NuxtLiteState {
  page: string
  [key: string]: any
}

interface DomNode {
  type: 'element' | 'text' | 'comment'
  tag?: string
  attrs?: Record<string, string>
  children?: DomNode[]
  content?: string
}

interface PagePayload {
  dom: DomNode[]
  meta: {
    title: string
    description?: string
    canonical?: string
    og?: Record<string, string>
    twitter?: Record<string, string>
  }
}

(function () {
  'use strict'

  if ((window as any).__NUXT_LITE_RUNNING__) return
  ;(window as any).__NUXT_LITE_RUNNING__ = true

  const subs = new Map<string, Set<(v: any, o: any) => void>>()
  let transitionMs: number = 0
  let navigating = false
  let currentRoute: string = normalizeHref(location.pathname)

  // ===== Reactive System =====
  function createReactive<T extends object>(obj: T): T {
    return new Proxy(obj, {
      set(t: any, p: string, v: any) {
        const o = t[p]
        t[p] = v
        if (o !== v) {
          subs.get(p)?.forEach(fn => fn(v, o))
          subs.get('*')?.forEach(fn => fn(v, o))
        }
        return true
      },
    })
  }

  function on(prop: string, fn: (v: any, o: any) => void) {
    if (!subs.has(prop)) subs.set(prop, new Set())
    subs.get(prop)!.add(fn)
    return () => subs.get(prop)?.delete(fn)
  }

  const state = createReactive<NuxtLiteState>({ page: currentRoute })
  ;(window as any).__NUXT_LITE_STATE__ = state
  ;(window as any).__NuxtLite = { reactive: createReactive, on }

  // ===== Helpers =====
  function normalizeHref(href: string | undefined): string {
    if (!href) return '/'
    const parts = href.split('?')
    const path = parts[0] ?? ''
    const base = path.split('#')[0] ?? ''
    return (base.replace(/\/index$/, '').replace(/\/+$/, '') + '/') || '/'
  }

  function isNuxtPage(href: string | null): boolean {
    if (!href || href[0] !== '/') return false
    if (href.startsWith('/_nuxt') || href.startsWith('/__')) return false
    // Skip common file extensions
    if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|mp4|webm|mp3|ogg|zip|gz|css|js)(\?.*)?$/i.test(href)) return false
    return true
  }

  async function fetchJSON<T>(url: string): Promise<T | null> {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } })
      return r.ok ? r.json() : null
    }
    catch (e) {
      console.error('[nuxt-lite] fetch error:', e)
      return null
    }
  }

  // ===== DOM Reconstruction =====
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const SVG_TAGS: Record<string, number> = { svg: 1, path: 1, circle: 1, rect: 1, line: 1, polyline: 1, polygon: 1, ellipse: 1, g: 1, use: 1, text: 1, tspan: 1, textPath: 1, defs: 1, clipPath: 1, mask: 1, filter: 1, linearGradient: 1, radialGradient: 1, stop: 1, marker: 1, pattern: 1, image: 1, foreignObject: 1, desc: 1, title: 1, animate: 1, animateTransform: 1, animateMotion: 1, set: 1, mpath: 1, view: 1, script: 1, style: 1, symbol: 1 }

  function buildDom(nodes: DomNode[]): DocumentFragment {
    const frag = document.createDocumentFragment()
    if (!nodes || !Array.isArray(nodes)) return frag

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (!n) continue

      if (n.type === 'text') {
        frag.appendChild(document.createTextNode(n.content || ''))
      }
      else if (n.type === 'comment') {
        frag.appendChild(document.createComment(n.content || ''))
      }
      else if (n.type === 'element') {
        const tag = n.tag || 'div'
        const el = SVG_TAGS[tag]
          ? document.createElementNS(SVG_NS, tag)
          : document.createElement(tag)

        if (n.attrs) {
          for (const a in n.attrs) {
            if (Object.prototype.hasOwnProperty.call(n.attrs, a)) {
              const val = n.attrs[a]
              if (val !== undefined) {
                el.setAttribute(a, val)
              }
            }
          }
        }
        if (n.children && n.children.length > 0) {
          el.appendChild(buildDom(n.children))
        }

        frag.appendChild(el)
      }
    }
    return frag
  }

  // ===== Meta Update =====
  function updateMeta(meta: PagePayload['meta']) {
    if (!meta) return
    if (meta.title) document.title = meta.title

    const setMeta = (selector: string, content?: string) => {
      if (!content) return
      const el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement
      if (el) {
        if ('content' in el) el.content = content
        else if ('href' in el) el.href = content
      }
    }

    setMeta('meta[name="description"]', meta.description)
    setMeta('link[rel="canonical"]', meta.canonical)

    if (meta.og) {
      for (const p in meta.og) setMeta(`meta[property="og:${p}"]`, meta.og[p])
    }
    if (meta.twitter) {
      for (const n in meta.twitter) setMeta(`meta[name="twitter:${n}"]`, meta.twitter[n])
    }
  }

  // ===== Swap =====
  function swapWithPayload(payload: PagePayload): boolean {
    const el = document.querySelector('[data-page-content]') || document.querySelector('main')
    if (!el || !payload || !payload.dom) return false

    const frag = buildDom(payload.dom)

    // Efficiently swap content
    while (el.firstChild) el.removeChild(el.firstChild)
    el.appendChild(frag)

    updateMeta(payload.meta)

    // A11y: Reset focus and announced change
    const h1 = el.querySelector('h1')
    if (h1) {
      h1.tabIndex = -1
      h1.focus({ preventScroll: true })
    }
    else {
      (el as HTMLElement).tabIndex = -1
      ;(el as HTMLElement).focus({ preventScroll: true })
    }

    return true
  }

  // ===== Transitions =====
  function getTransitionMs(): number {
    if (transitionMs > 0) return transitionMs
    const el = document.querySelector('.page-enter-active, .page-leave-active')
    if (!el) return 400

    const style = getComputedStyle(el)
    const dur = style.transitionDuration || style.animationDuration
    if (!dur || dur === '0s') return 400

    const ms = Number.parseFloat(dur)
    transitionMs = dur.includes('ms') ? ms : ms * 1000
    return transitionMs || 400
  }

  // ===== Navigate =====
  async function navigate(href: string, updateHistory: boolean = true) {
    if (navigating) return
    const route = normalizeHref(href)
    if (route === currentRoute && updateHistory) return

    navigating = true
    const el = document.querySelector('[data-page-content]') || document.querySelector('main')

    if (!el || !isNuxtPage(href)) {
      window.location.href = href
      return
    }

    try {
      const ms = getTransitionMs()

      // Phase 1: Exit Transition
      el.classList.add('page-leave-active', 'page-leave-from')
      void (el as HTMLElement).offsetHeight // Trigger reflow
      el.classList.remove('page-leave-from')
      el.classList.add('page-leave-to')

      // Phase 2: Fetch Payload
      const payloadUrl = route === '/' ? '/_payload.json' : route + '_payload.json'
      const payloadPromise = fetchJSON<PagePayload>(payloadUrl)

      // Wait for animation AND data
      const [payload] = await Promise.all([
        payloadPromise,
        new Promise(r => setTimeout(r, ms)),
      ])

      if (payload && payload.dom) {
        swapWithPayload(payload)
      }
      else {
        // Fallback: Full reload if payload fails
        window.location.href = href
        return
      }

      state.page = route
      currentRoute = route
      if (updateHistory) history.pushState({}, '', href)

      // Phase 3: Enter Transition
      el.classList.remove('page-leave-active', 'page-leave-to')
      el.classList.add('page-enter-active', 'page-enter-from')
      void (el as HTMLElement).offsetHeight
      el.classList.remove('page-enter-from')
      el.classList.add('page-enter-to')

      await new Promise(r => setTimeout(r, ms))
      el.classList.remove('page-enter-active', 'page-enter-to')

      window.scrollTo({ top: 0, behavior: 'instant' as any })
    }
    catch (err) {
      console.error('[nuxt-lite] navigate error:', err)
      window.location.href = href
    }
    navigating = false
  }

  // ===== Prefetch Strategy =====
  // Hover-based prefetch with duplicate protection
  const prefetching = new Set<string>()

  function hasPrefetchLink(url: string): boolean {
    return !!document.querySelector(`link[rel="prefetch"][href="${url}"]`)
  }

  function prefetchRoute(href: string) {
    if (!isNuxtPage(href)) return
    const r = normalizeHref(href)
    if (r === state.page || prefetching.has(r)) return

    // Check for Save-Data header or slow connection
    if ((navigator as any).connection && ((navigator as any).connection.saveData || (navigator as any).connection.effectiveType.includes('2g'))) return

    const u = r === '/' ? '/_payload.json' : r + '_payload.json'

    // Check if link already exists in head
    if (hasPrefetchLink(u)) {
      prefetching.add(r)
      return
    }

    prefetching.add(r)
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = u
    link.as = 'fetch'
    document.head.appendChild(link)
  }

  // ===== Event Delegation =====
  function init() {
    // Intercept clicks
    document.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement
      if (!link) return

      const href = link.getAttribute('href')
      if (!href || href[0] !== '/' || href.startsWith('/_nuxt')) return
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
      if (link.target && link.target !== '_self') return

      e.preventDefault()
      navigate(href)
    }, false)

    // Popstate (back/forward)
    window.addEventListener('popstate', () => {
      navigate(window.location.pathname, false)
    })

    // Hover prefetch with debounce to avoid rapid-fire events
    let hoverTarget: HTMLElement | null = null
    let hoverTimer: ReturnType<typeof setTimeout> | null = null

    document.addEventListener('mouseover', (e) => {
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement
      if (!link) return

      // Clear previous timer
      if (hoverTimer) clearTimeout(hoverTimer)
      hoverTarget = link

      // Debounce: only prefetch after 100ms of stable hover
      hoverTimer = setTimeout(() => {
        if (hoverTarget === link) {
          prefetchRoute(link.getAttribute('href')!)
        }
      }, 100)
    }, { passive: true })

    document.addEventListener('mouseout', (e) => {
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement
      if (link && hoverTarget === link) {
        hoverTarget = null
        if (hoverTimer) {
          clearTimeout(hoverTimer)
          hoverTimer = null
        }
      }
    }, { passive: true })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  }
  else {
    init()
  }
})()
