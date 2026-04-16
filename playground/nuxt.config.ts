export default defineNuxtConfig({
  modules: ['../src/module', '@nuxt/content'],
  devtools: { enabled: true },
  content: {
    build: {
      markdown: {
        highlight: {
          theme: 'github-dark',
        },
      },
    },
  },
  dir: {
    pages: 'pages',
  },
  compatibilityDate: 'latest',
  nuxtLite: {
    optimizeCss: 'inline',
    cleanHtml: true,
    optimizeSeo: 'analyze',
  },
})
