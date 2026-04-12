/**
 * nuxt-lite runtime — hydration + SPA navigation
 * Zero Vue dependency — ~4KB
 */

(function() {
  'use strict'

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
  const state = reactive({ page: location.pathname })
  window.__NUXT_LITE_STATE__ = state
  window.__NuxtLite = { reactive, on }

  // ===== Navigation =====
  let busy = false

  /**
   * Get transition duration from CSS classes configured in the project.
   * Reads computed transition from .page-leave-active or falls back to default.
   */
  function getTransitionDuration() {
    // Try to read from the configured .page-leave-active or .page-enter-active
    const styleEl = document.querySelector('.page-leave-active, .page-enter-active')
    if (styleEl) {
      const computed = getComputedStyle(styleEl)
      const duration = computed.transitionDuration
      if (duration) {
        // Parse "0.4s" or "400ms" → ms
        const val = parseFloat(duration)
        if (duration.includes('ms')) return val
        if (duration.includes('s')) return val * 1000
      }
    }
    return 400 // default fallback
  }

  /**
   * Apply Nuxt page transition classes to an element.
   * Respects the project's CSS transition configuration.
   * 
   * Nuxt transition classes work like this:
   * - From state: *-from (initial state before transition)
   * - To state: *-to (final state after transition)
   * - Active: *-active (contains the transition CSS properties)
   * 
   * For 'out-in' mode: leave first, then enter.
   */
  function applyTransition(element, phase) {
    // phase: 'leave' or 'enter'
    if (phase === 'leave') {
      // Start at leave-from (current visible state)
      element.classList.add('page-leave-active')
      element.classList.add('page-leave-from')
      // Force reflow so the browser applies the -from state
      element.offsetHeight
      // Move to leave-to (triggers the CSS transition)
      element.classList.remove('page-leave-from')
      element.classList.add('page-leave-to')
    } else {
      // Start at enter-from (hidden state)
      element.classList.add('page-enter-active')
      element.classList.add('page-enter-from')
      // Force reflow so the browser applies the -from state
      element.offsetHeight
      // Move to enter-to (triggers the CSS transition)
      element.classList.remove('page-enter-from')
      element.classList.add('page-enter-to')
    }
  }

  /**
   * Remove all Nuxt page transition classes from an element.
   */
  function clearTransition(element) {
    element.classList.remove(
      'page-enter-active', 'page-enter-from', 'page-enter-to',
      'page-leave-active', 'page-leave-from', 'page-leave-to'
    )
  }

  /**
   * Wait for CSS transition to complete.
   */
  function waitForTransition(element, duration) {
    return new Promise(resolve => {
      const onEnd = () => {
        element.removeEventListener('transitionend', onEnd)
        clearTimeout(fallback)
        resolve()
      }
      element.addEventListener('transitionend', onEnd, { once: true })
      // Fallback in case transitionend doesn't fire
      const fallback = setTimeout(onEnd, duration + 50)
    })
  }

  document.addEventListener('click', async (e) => {
    const link = e.target.closest('a[href]')
    if (!link) return

    const href = link.getAttribute('href')
    if (!href || !href.startsWith('/') || href.startsWith('/_') || href.startsWith('/api/')) return
    if (e.ctrlKey || e.metaKey || e.button !== 0) return

    const currentPath = window.location.pathname.replace(/\/$/, '')
    const targetPath = href.replace(/\/$/, '')
    if (targetPath === currentPath) return

    e.preventDefault()
    if (busy) return
    busy = true

    // Find main content area
    const content = document.querySelector('[data-page-content]')
      || document.getElementById('__nuxt')
      || document.querySelector('main')

    if (!content) { window.location.href = href; return }

    try {
      const duration = getTransitionDuration()

      // Leave transition using Nuxt CSS classes
      applyTransition(content, 'leave')
      await waitForTransition(content, duration)

      // Fetch new page HTML
      const res = await fetch(href, { headers: { Accept: 'text/html' } })
      if (!res.ok) { window.location.href = href; return }

      const text = await res.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'text/html')

      // Get new content
      const newContent = doc.querySelector('[data-page-content]')
        || doc.getElementById('__nuxt')
        || doc.querySelector('main')

      if (newContent) {
        content.innerHTML = newContent.innerHTML
      }

      // Clear leave transition classes after content swap
      clearTransition(content)

      // Update __NUXT_DATA__
      const oldData = document.getElementById('__NUXT_DATA__')
      const newData = doc.getElementById('__NUXT_DATA__')
      if (oldData && newData) oldData.textContent = newData.textContent

      // Update head metadata
      const newTitle = doc.querySelector('title')
      if (newTitle) document.title = newTitle.textContent

      for (const sel of ['meta[name="description"]', 'link[rel="canonical"]']) {
        const oldEl = document.querySelector(sel)
        const newEl = doc.querySelector(sel)
        if (oldEl && newEl) {
          if (oldEl.tagName === 'LINK') oldEl.setAttribute('href', newEl.getAttribute('href'))
          else oldEl.setAttribute('content', newEl.getAttribute('content'))
        }
      }

      // Update URL
      history.pushState({}, '', href)
      state.page = href

      // Enter transition using Nuxt CSS classes
      applyTransition(content, 'enter')
      await waitForTransition(content, duration)
      clearTransition(content)

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' })

    } catch(err) {
      console.warn('[nuxt-lite] Navigation failed:', err)
      window.location.href = href
      return
    }

    busy = false
    setupPrefetch()
  })

  // ===== Prefetch: only visible links =====
  function setupPrefetch() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const a = entry.target
          // Only prefetch internal, non-current routes
          if (a.hostname === location.hostname && a.pathname.replace(/\/$/, '') !== location.pathname.replace(/\/$/, '')) {
            // Prefetch with low priority (don't block current navigation)
            fetch(a.pathname, { priority: 'low' }).catch(() => {})
          }
          obs.unobserve(entry.target)
        }
      })
    }, {
      rootMargin: '200px',  // Only prefetch links ~200px from viewport
      threshold: 0
    })

    document.querySelectorAll('a[href^="/"]').forEach(a => obs.observe(a))
  }

  setupPrefetch()

})()
