export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: true },
  compatibilityDate: 'latest',
  nuxtLite: {
    optimizeCss: 'inline',
    cleanHtml: true,
  },
  dir: {
    pages: 'pages'
  }
})
