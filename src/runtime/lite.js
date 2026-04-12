/**
 * nuxt-lite — Global SPA hydration controller
 */

(function() {
  'use strict'

  if (window.__NUXT_LITE_RUNNING__) return
  window.__NUXT_LITE_RUNNING__ = true

  // ===== Reactive System =====
  const subs = new Map()
  function reactive(obj) {
    return new Proxy(obj, {
      set(t, p, v) {
        const o = t[p]; t[p] = v
        if (o !== v) notify(p, v, o)
        return true
      }
    })
  }
  function on(prop, fn) {
    if (!subs.has(prop)) subs.set(prop, new Set())
    subs.get(prop).add(fn)
    return () => subs.get(prop)?.delete(fn)
  }
  function notify(prop, nv, ov) {
    for (const fn of subs.get(prop) || []) fn(nv, ov)
    for (const fn of subs.get('*') || []) fn(nv, ov)
  }

  // ===== State =====
  const state = reactive({ page: location.pathname, data: null })
  window.__NUXT_LITE_STATE__ = state
  window.__NuxtLite = { reactive, on }

  // ===== Caches =====
  const htmlCache = new Map()
  const payloadCache = new Map()
  const visitedRoutes = new Set()
  const prefetching = new Set()

  // ===== Normalize path =====
  function normalizePath(path) {
    return path.replace(/\/index$/, '').replace(/\/+$/, '') || '/'
  }

  // ===== Check if route is a Nuxt page =====
  function isNuxtPage(href) {
    // Skip static files, API routes, _nuxt assets
    if (!href || !href.startsWith('/')) return false
    if (href.startsWith('/_nuxt') || href.startsWith('/__')) return false
    if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|mp4|webm|mp3|ogg|zip|gz|css|js)(\?.*)?$/i.test(href)) return false
    return true
  }

  // ===== Parse Nuxt payload =====
  function parsePayload(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return null
    const entry = raw[0]
    if (!entry || typeof entry.data !== 'number') return null
    return resolveRefs(raw, entry.data, new Set())
  }

  function resolveRefs(raw, idx, visited) {
    if (typeof idx === 'number') {
      if (visited.has(idx)) return '[circular]'
      visited.add(idx)
      return resolveRefs(raw, raw[idx], visited)
    }
    if (Array.isArray(idx)) {
      if (idx[0] === 'ShallowReactive' || idx[0] === 'Reactive' || idx[0] === 'Ref') {
        return resolveRefs(raw, idx[1], visited)
      }
      return idx.map(item => resolveRefs(raw, item, new Set(visited)))
    }
    if (idx && typeof idx === 'object') {
      const out = {}
      for (const [k, v] of Object.entries(idx)) {
        out[k] = resolveRefs(raw, v, new Set(visited))
      }
      return out
    }
    return idx
  }

  // ===== Fetch HTML =====
  async function fetchHTML(href) {
    const key = normalizePath(new URL(href, location.origin).pathname)
    if (htmlCache.has(key)) return htmlCache.get(key)

    try {
      const res = await fetch(href, { headers: { Accept: 'text/html' } })
      if (!res.ok) return null
      const text = await res.text()
      const doc = new DOMParser().parseFromString(text, 'text/html')
      htmlCache.set(key, doc)
      return doc
    } catch (e) {
      return null
    }
  }

  // ===== Fetch payload =====
  async function fetchPayload(route) {
    const key = normalizePath(route)
    if (payloadCache.has(key)) return payloadCache.get(key)

    try {
      const url = key === '/' ? '/_payload.json' : `${key}/_payload.json`
      const res = await fetch(url, { cache: 'force-cache' })
      if (!res.ok) return null
      const raw = await res.json()
      const data = parsePayload(raw)
      if (data) payloadCache.set(key, data)
      return data
    } catch (e) {
      return null
    }
  }

  // ===== Prefetch (only Nuxt pages) =====
  function prefetch(href) {
    if (!isNuxtPage(href)) return
    
    const key = normalizePath(new URL(href, location.origin).pathname)
    if (prefetching.has(key)) return
    prefetching.add(key)

    Promise.all([fetchHTML(href), fetchPayload(key)])
      .finally(() => prefetching.delete(key))
  }

  // ===== Swap content =====
  function swapContentFromDoc(newDoc) {
    const oldContent = document.querySelector('[data-page-content]') || document.querySelector('main')
    const newContent = newDoc.querySelector('[data-page-content]') || newDoc.querySelector('main')
    if (!oldContent || !newContent) return false

    while (oldContent.firstChild) oldContent.removeChild(oldContent.firstChild)
    for (const child of newContent.childNodes) {
      oldContent.appendChild(document.importNode(child, true))
    }
    return true
  }

  function updateMetaFromDoc(newDoc) {
    if (newDoc.title) document.title = newDoc.title
    const newDesc = newDoc.querySelector('meta[name="description"]')
    const oldDesc = document.querySelector('meta[name="description"]')
    if (newDesc?.content && oldDesc) oldDesc.content = newDesc.content
    const newCanonical = newDoc.querySelector('link[rel="canonical"]')
    const oldCanonical = document.querySelector('link[rel="canonical"]')
    if (newCanonical?.href && oldCanonical) oldCanonical.href = newCanonical.href
  }

  // ===== Navigate =====
  let navigating = false

  function getTransitionMs() {
    const el = document.querySelector('.page-enter-active, .page-leave-active')
    if (!el) return 400
    const style = getComputedStyle(el)
    const dur = style.transitionDuration
    if (!dur) return 400
    const ms = parseFloat(dur)
    return dur.includes('ms') ? ms : ms * 1000
  }

  async function navigate(href, updateHistory = true) {
    if (navigating) return
    navigating = true

    const contentEl = document.querySelector('[data-page-content]') || document.querySelector('main')
    if (!contentEl) {
      window.location.href = href
      navigating = false
      return
    }

    // Non-Nuxt pages: hard navigation
    if (!isNuxtPage(href)) {
      window.location.href = href
      navigating = false
      return
    }

    try {
      const transitionMs = getTransitionMs()
      const targetKey = normalizePath(href)
      const isFirstVisit = !visitedRoutes.has(targetKey)

      // Leave
      contentEl.classList.add('page-leave-active', 'page-leave-from')
      contentEl.offsetHeight
      contentEl.classList.remove('page-leave-from')
      contentEl.classList.add('page-leave-to')

      let doc = null
      let payload = null

      if (isFirstVisit) {
        const [htmlResult, payloadResult] = await Promise.allSettled([
          fetchHTML(href),
          fetchPayload(href)
        ])
        if (htmlResult.status === 'fulfilled' && htmlResult.value) {
          doc = htmlResult.value
          visitedRoutes.add(targetKey)
        }
        if (payloadResult.status === 'fulfilled' && payloadResult.value) {
          payload = payloadResult.value
        }
      } else {
        doc = htmlCache.get(targetKey)
        payload = payloadCache.get(targetKey) || await fetchPayload(href)
      }

      await new Promise(r => setTimeout(r, transitionMs))

      if (!doc) {
        if (updateHistory) window.location.href = href
        navigating = false
        contentEl.classList.remove('page-leave-active', 'page-leave-from', 'page-leave-to')
        return
      }

      swapContentFromDoc(doc)
      updateMetaFromDoc(doc)

      if (payload) {
        state.data = payload
        notify('data', payload, state.data)
      }
      state.page = targetKey
      if (updateHistory) history.pushState({}, '', href)

      // Enter
      contentEl.classList.remove('page-leave-active', 'page-leave-from', 'page-leave-to')
      contentEl.classList.add('page-enter-active', 'page-enter-from')
      contentEl.offsetHeight
      contentEl.classList.remove('page-enter-from')
      contentEl.classList.add('page-enter-to')

      await new Promise(r => setTimeout(r, transitionMs))
      contentEl.classList.remove('page-enter-active', 'page-enter-from', 'page-enter-to')
      window.scrollTo({ top: 0, behavior: 'instant' })

      schedulePrefetch()

    } catch (err) {
      console.error('[nuxt-lite] Nav error:', err)
      window.location.href = href
    }

    navigating = false
  }

  // ===== Intersection Observer =====
  let observer = null
  function schedulePrefetch() {
    if (observer) observer.disconnect()
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const href = entry.target.getAttribute('href')
          if (href && isNuxtPage(href)) {
            prefetch(href)
          }
          observer.unobserve(entry.target)
        }
      }
    }, { rootMargin: '200px' })

    document.querySelectorAll('a[href^="/"]:not([href^="/_"]):not([href^="/__"])')
      .forEach(link => observer.observe(link))
  }

  // ===== Hover =====
  let hoverTimeout
  document.addEventListener('mouseover', (e) => {
    const link = e.target.closest('a[href]')
    if (!link) return
    const href = link.getAttribute('href')
    if (!isNuxtPage(href)) return
    if (link.target === '_blank') return
    clearTimeout(hoverTimeout)
    hoverTimeout = setTimeout(() => prefetch(href), 80)
  }, { passive: true })

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('a[href]')) clearTimeout(hoverTimeout)
  }, { passive: true })

  // ===== Click =====
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]')
    if (!link) return
    const href = link.getAttribute('href')
    if (!href || !href.startsWith('/') || href.startsWith('/_nuxt') || href.startsWith('/__')) return
    if (e.ctrlKey || e.metaKey || e.button !== 0) return
    if (link.target === '_blank' || link.target === '_parent') return
    e.preventDefault()
    navigate(href)
  }, { passive: false })

  // ===== Popstate =====
  window.addEventListener('popstate', () => navigate(window.location.pathname, false))

  // ===== Initial =====
  async function hydrateIfNotIndex() {
    const path = normalizePath(location.pathname)
    if (path === '/') return
    const data = await fetchPayload(path)
    if (data) state.data = data
  }

  schedulePrefetch()
  hydrateIfNotIndex()

})()
