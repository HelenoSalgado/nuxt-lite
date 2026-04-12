<template>
  <div>
    <h1>nuxt-lite Playground</h1>
    <nav>
      <NuxtLink to="/">Home</NuxtLink>
      <NuxtLink to="/sobre">Sobre</NuxtLink>
      <NuxtLink to="/contato">Contato</NuxtLink>
    </nav>
    
    <main data-page-content>
      <h2 data-page-title>Bem-vindo!</h2>
      <div data-page-body>
        <p>Este é o playground do nuxt-lite.</p>
        <p>Estado reativo: <span id="counter">{{ counter }}</span></p>
        <button @click="counter++">Incrementar</button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const counter = ref(0)

// Simular dados da página
const pageData = {
  title: 'Bem-vindo!',
  content: '<p>Este é o playground do nuxt-lite.</p>'
}

// Disponibilizar para payload
if (import.meta.server) {
  useHead({
    title: 'Home - nuxt-lite',
    script: [{
      type: 'application/json',
      children: JSON.stringify(pageData)
    }]
  })
}

onMounted(() => {
  // Testar sistema reativo customizado
  if (window.__NuxtLite) {
    console.log('Custom reactive system available!')
    const state = window.__NUXT_LITE_STATE__
    console.log('Page state:', state)
  }
})
</script>

<style>
nav {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
}

nav a {
  color: blue;
  text-decoration: underline;
}

button {
  padding: 0.5rem 1rem;
  background: #00dc82;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* Page transitions */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
