import { defineNuxtPlugin, useRouter } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  if (typeof window === 'undefined') {
    return
  }

  const router = useRouter()

  // ===== IntersectionObserver for prefetching =====
  const observerOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1,
  }

  const prefetchedRoutes = new Set<string>()

  const prefetchObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const link = entry.target as HTMLAnchorElement
        if (link.href && link.hostname === window.location.hostname) {
          prefetchRoute(link.pathname)
        }
        // Stop observing after prefetch trigger
        prefetchObserver.unobserve(entry.target)
      }
    }
  }, observerOptions)

  // ===== Observe NuxtLink elements =====
  function observeLinks() {
    const links = document.querySelectorAll('a[data-nuxt-link], a[href^="/"]')
    links.forEach(link => {
      prefetchObserver.observe(link)
    })
  }

  // ===== Prefetch on hover for faster interaction =====
  let hoverPrefetchEnabled = true
  document.addEventListener('mouseover', (event) => {
    if (!hoverPrefetchEnabled) return
    
    const link = event.target as HTMLAnchorElement
    if (link.tagName === 'A' && link.hostname === window.location.hostname) {
      prefetchRoute(link.pathname)
      // Only prefetch once per hover
      hoverPrefetchEnabled = false
      setTimeout(() => { hoverPrefetchEnabled = true }, 1000)
    }
  })

  // ===== Initial setup =====
  observeLinks()

  // Re-observe after page transitions
  router.afterEach(() => {
    setTimeout(observeLinks, 100)
  })

  console.log('[nuxt-lite] Prefetch plugin initialized')
})

/**
 * Prefetch a route's payload
 */
const prefetchedRoutes = new Set<string>()

async function prefetchRoute(path: string) {
  // Skip if already prefetched or is current route
  if (prefetchedRoutes.has(path) || path === window.location.pathname) {
    return
  }
  
  prefetchedRoutes.add(path)

  const payloadPath = path.endsWith('/') 
    ? `${path}payload.json`
    : `${path}/payload.json`

  try {
    // Use browser prefetch API
    if ('connection' in navigator) {
      const conn = (navigator as any).connection
      // Don't prefetch on slow connections
      if (conn.effectiveType === '2g' || conn.saveData) {
        return
      }
    }

    // Create prefetch link
    const linkEl = document.createElement('link')
    linkEl.rel = 'prefetch'
    linkEl.as = 'fetch'
    linkEl.href = payloadPath
    linkEl.crossOrigin = 'anonymous'
    document.head.appendChild(linkEl)

    console.log('[nuxt-lite] Prefetching:', path)
  } catch (e) {
    // Silently fail - prefetch is optional enhancement
  }
}

// Expose prefetch function globally
;(window as any).__NUXT_LITE_PREFETCH__ = prefetchRoute
