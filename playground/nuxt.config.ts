export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: true },
  compatibilityDate: 'latest',
  nuxtLite: {
    cleanHtml: true,
    payloadExtraction: true,
    hydration: true,
    prefetchRoutes: true
  },
  dir: {
    pages: 'pages'
  }
})
