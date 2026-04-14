<template>
  <div>
    <h1>Sobre</h1>
    <nav>
      <NuxtLink to="/">Home</NuxtLink>
      <NuxtLink to="/sobre">Sobre</NuxtLink>
      <NuxtLink to="/contato">Contato</NuxtLink>
    </nav>

    <main data-page-content>
      <h2 data-page-title>
        Sobre o nuxt-lite
      </h2>
      <div data-page-body>
        <p>nuxt-lite é um módulo para geração estática com hidratação leve.</p>
        <ul>
          <li>Remove Vue runtime do cliente</li>
          <li>Extrai payloads para JSON</li>
          <li>Sistema reativo próprio com Proxies</li>
        </ul>
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

const _pageData = {
  title: 'Sobre o nuxt-lite',
  content: '<p>nuxt-lite é um módulo para geração estática com hidratação leve.</p>',
}

onMounted(() => {
  if (window.__NUXT_LITE_STATE__) {
    console.log('State on /sobre:', window.__NUXT_LITE_STATE__)
  }
})
</script>
