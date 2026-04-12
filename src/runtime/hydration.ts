import { defineNuxtPlugin, useRoute, useRouter } from '#app'

export default defineNuxtPlugin(async (nuxtApp) => {
  if (typeof window === 'undefined') {
    return
  }

  const route = useRoute()
  const router = useRouter()

  // Wait for core reactive system to load
  await new Promise<void>(resolve => {
    const checkCore = () => {
      if ((window as any).__NuxtLite) {
        resolve()
      } else {
        setTimeout(checkCore, 10)
      }
    }
    checkCore()
  })

  const { reactive } = (window as any).__NuxtLite

  // ===== Load page payload =====
  let pageState: Record<string, any> = {}

  // Try inline payload first (embedded during prerender)
  const payloadScript = document.querySelector<HTMLScriptElement>('script[type="application/json"][data-nuxt-lite-payload]')
  if (payloadScript) {
    try {
      pageState = JSON.parse(payloadScript.textContent || '{}')
    } catch (e) {
      console.warn('[nuxt-lite] Failed to parse inline payload:', e)
    }
  }

  // Create reactive state from payload
  const state = reactive(pageState)

  // Expose state globally for components
  ;(window as any).__NUXT_LITE_STATE__ = state

  // ===== Page transition system =====
  let isTransitioning = false
  const transitionDuration = 300 // ms

  router.beforeEach(async (to, from) => {
    // Prevent double navigation
    if (isTransitioning) {
      return false
    }

    // Same page, no transition
    if (to.path === from.path) {
      return true
    }

    isTransitioning = true

    // Get current page content
    const currentPage = document.querySelector('[data-page-content]')
    
    // Start leave transition
    if (currentPage) {
      currentPage.style.transition = `opacity ${transitionDuration}ms ease`
      currentPage.style.opacity = '0'
    }

    // Wait for leave transition
    await new Promise(resolve => setTimeout(resolve, transitionDuration))

    // Fetch new page payload
    const newPayload = await fetchPayload(to.path)
    
    if (newPayload) {
      // Update reactive state
      Object.assign(state, newPayload)

      // Update DOM content
      updatePageContent(newPayload)

      // Update URL
      history.pushState({}, '', to.path)
    }

    // Start enter transition
    if (currentPage) {
      currentPage.style.opacity = '0'
      
      // Force reflow
      currentPage.offsetHeight
      
      currentPage.style.opacity = '1'
    }

    // Wait for enter transition
    await new Promise(resolve => setTimeout(resolve, transitionDuration))

    isTransitioning = false
  })

  console.log('[nuxt-lite] Hydration plugin initialized')
  console.log('[nuxt-lite] State:', state)
})

/**
 * Fetch payload for a given path
 */
async function fetchPayload(path: string): Promise<Record<string, any> | null> {
  // Convert path to payload path
  const payloadPath = path.endsWith('/') 
    ? `${path}payload.json`
    : `${path}/payload.json`

  try {
    const response = await fetch(payloadPath, {
      headers: { 'Accept': 'application/json' }
    })
    
    if (response.ok) {
      return await response.json()
    }
  } catch (e) {
    console.warn('[nuxt-lite] Failed to fetch payload for', path, e)
  }

  return null
}

/**
 * Update page content in DOM
 */
function updatePageContent(payload: Record<string, any>) {
  // Update title
  if (payload.title) {
    const titleEl = document.querySelector('h1, [data-page-title]')
    if (titleEl) {
      titleEl.textContent = payload.title
    }
    
    // Update document title
    document.title = payload.title
  }

  // Update content body
  if (payload.content) {
    const contentBody = document.querySelector('[data-page-body]')
    if (contentBody) {
      contentBody.innerHTML = payload.content
    }
  }

  // Update meta tags
  if (payload.meta && typeof payload.meta === 'object') {
    for (const [key, value] of Object.entries(payload.meta)) {
      if (typeof value === 'string') {
        const metaEl = document.querySelector(`meta[name="${key}"]`)
        if (metaEl) {
          metaEl.setAttribute('content', value)
        }
      }
    }
  }
}
