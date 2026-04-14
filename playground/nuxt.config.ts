export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: true },
  dir: {
    pages: 'pages',
  },
  compatibilityDate: 'latest',
  nuxtLite: {
    optimizeCss: 'inline',
    cleanHtml: true,
  },
})
