<template>
  <div>
    <h1>Contato</h1>
    <nav>
      <NuxtLink to="/">Home</NuxtLink>
      <NuxtLink to="/sobre">Sobre</NuxtLink>
      <NuxtLink to="/contato">Contato</NuxtLink>
    </nav>
    
    <main data-page-content>
      <h2 data-page-title>Contato</h2>
      <div data-page-body>
        <p>Entre em contato conosco!</p>
        <form @submit.prevent="submitForm">
          <input v-model="email" type="email" placeholder="Seu email" />
          <button type="submit">Enviar</button>
        </form>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const email = ref('')

function submitForm() {
  alert(`Obrigado! Contato registrado para: ${email.value}`)
}

onMounted(() => {
  if (window.__NuxtLite) {
    // Testar reatividade customizada
    const { subscribe } = window.__NuxtLite
    subscribe('*', () => {
      console.log('State changed!')
    })
  }
})
</script>
