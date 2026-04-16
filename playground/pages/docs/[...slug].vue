<template>
  <NuxtLayout name="docs">
    <ContentRenderer
      v-if="page"
      :value="page"
    >
      <template #empty>
        <p>Documento não encontrado.</p>
      </template>
    </ContentRenderer>
    <div
      v-else
      class="loading"
    >
      <p>Carregando...</p>
    </div>
  </NuxtLayout>
</template>

<script setup>
const route = useRoute()

const path = route.path === '/docs' ? '/docs/0.index' : route.path

const { data: page } = await useAsyncData(`content-${path}`, () => {
  return queryCollection('docs').path(path).first()
})

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Página não encontrada',
  })
}

useHead({
  title: page.value?.title ? `${page.value.title} — nuxt-lite` : 'nuxt-lite Docs',
})
</script>

<style scoped>
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  color: #6b7280;
}
</style>
