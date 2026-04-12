import { defineNitroPlugin } from 'nitropack/runtime'

export default defineNitroPlugin(async (nitroApp) => {
  console.log('[nuxt-lite] Server plugin initialized')

  // Note: The main payload extraction is handled in the Nuxt module
  // via the nitro:config and prerender:generate hooks.
  // This server plugin can be used for additional runtime logic if needed.
  
  // Example: Add custom headers or modify responses
  nitroApp.hooks.hook('render:response', async (response, { event }) => {
    // Add custom headers for caching
    if (response.headers && (event.path?.endsWith('.html') || event.path === '/')) {
      response.headers['X-Nuxt-Lite'] = 'true'
    }
  })
})
