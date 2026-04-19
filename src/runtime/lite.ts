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
  t?: 'e' | 't' | 'c' // type: e=element (default), t=text, c=comment
  g?: string // tag (ex: div, span)
  a?: Record<string, string> // attrs
  c?: DomNode[] // children
  v?: string // value (content for text or comment)
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
  symbols?: { id: string, content: string, attributes: string }[]
  css?: string
}

(function () {
  'use strict'

  if ((window as any).__NUXT_LITE_RUNNING__) return
  ;(window as any).__NUXT_LITE_RUNNING__ = true

  const subs = new Map<string, Set<(v: any, o: any) => void>>()
  let transitionMs: number = 0
  let navigating = false
  let currentRoute: string = normalizeHref(location.pathname)
  const payloadCache = new Map<string, Promise<PagePayload | null>>()

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

  function getPayloadUrl(route: string): string {
    return route === '/' ? '/_payload.json' : route + '_payload.json'
  }

  function cachedFetchPayload(route: string): Promise<PagePayload | null> {
    if (!payloadCache.has(route)) {
      payloadCache.set(route, fetchJSON<PagePayload>(getPayloadUrl(route)))
    }
    return payloadCache.get(route)!
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

      const type = n.t || 'e'

      if (type === 't') {
        frag.appendChild(document.createTextNode(n.v || ''))
      }
      else if (type === 'c') {
        frag.appendChild(document.createComment(n.v || ''))
      }
      else {
        const tag = n.g || 'div'
        const el = SVG_TAGS[tag]
          ? document.createElementNS(SVG_NS, tag)
          : document.createElement(tag)

        if (n.a) {
          for (const a in n.a) {
            if (Object.prototype.hasOwnProperty.call(n.a, a)) {
              const val = n.a[a]
              if (val !== undefined) {
                el.setAttribute(a, val)
              }
            }
          }
        }
        if (n.c && n.c.length > 0) {
          el.appendChild(buildDom(n.c))
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

  // ===== SVG Symbols Update =====
  function updateSymbols(symbols: PagePayload['symbols']) {
    if (!symbols || symbols.length === 0) return

    let sprite: Element | null = document.getElementById('__NUXT_LITE_SPRITE__')
    if (!sprite) {
      const s = document.createElementNS(SVG_NS, 'svg')
      s.id = '__NUXT_LITE_SPRITE__'
      ;(s as any).style.display = 'none'
      document.body.appendChild(s)
      sprite = s
    }

    for (let i = 0; i < symbols.length; i++) {
      const s = symbols[i]
      if (!s || !sprite || document.getElementById(s.id)) continue

      const viewBoxMatch = s.attributes.match(/viewBox="([^"]*)"/)

      const symbol = document.createElementNS(SVG_NS, 'symbol')
      symbol.id = s.id
      if (viewBoxMatch && viewBoxMatch[1]) symbol.setAttribute('viewBox', viewBoxMatch[1])
      symbol.innerHTML = s.content
      sprite.appendChild(symbol)
    }
  }

  // ===== Swap =====
  function swapWithPayload(payload: PagePayload): boolean {
    const el = document.querySelector('[data-page-content]') || document.querySelector('main')
    if (!el || !payload || !payload.dom) return false

    // Update dynamic CSS
    if (payload.css !== undefined) {
      let dynamicStyle = document.querySelector('style[data-nl-dynamic]')
      if (!dynamicStyle) {
        dynamicStyle = document.createElement('style')
        dynamicStyle.setAttribute('data-nl-dynamic', '')
        document.head.appendChild(dynamicStyle)
      }
      dynamicStyle.textContent = payload.css
    }

    // Update symbols first so <use> can find them
    updateSymbols(payload.symbols)

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

      // Phase 2: Fetch Payload (use cache)
      const payloadPromise = cachedFetchPayload(route)

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

  // ===== Event Delegation =====
  function init() {
    // Intercept clicks
    document.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement
      if (!link) return

      const href = link.getAttribute('href')
      // Only handle internal links that are Nuxt pages
      if (!isNuxtPage(href)) return

      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
      if (link.target && link.target !== '_self') return

      e.preventDefault()
      navigate(href)
    }, false)

    // Prefetch on hover
    const prefetchCache = new Set<string>()
    document.addEventListener('mouseover', (e) => {
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement
      if (!link) return

      const href = link.getAttribute('href')
      if (!isNuxtPage(href)) return

      // Skip anchors (#)
      if (href.includes('#')) return

      const route = normalizeHref(href)
      
      // Skip current page
      if (route === currentRoute) return
      
      // Skip if already prefetched
      if (prefetchCache.has(route)) return

      prefetchCache.add(route)
      cachedFetchPayload(route)
    }, false)

    // Popstate (back/forward)
    window.addEventListener('popstate', () => {
      navigate(window.location.pathname, false)
    })
  }

  if (document.readyState === 'complete') {
    setTimeout(init, 50)
  }
  else {
    window.addEventListener('load', () => setTimeout(init, 50))
  }
})()
