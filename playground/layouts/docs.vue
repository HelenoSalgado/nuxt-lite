<template>
  <div class="docs-layout">
    <div class="docs-container">
      <aside class="docs-sidebar">
        <div class="docs-logo">
          <NuxtLink to="/docs">
            <span class="docs-logo-icon">⚡</span>
            <span class="docs-logo-text">nuxt-lite</span>
          </NuxtLink>
        </div>
        <nav class="docs-nav">
          <div
            v-for="item in navItems"
            :key="item._path"
            class="docs-nav-item"
            :class="{ active: isActive(item._path) }"
          >
            <NuxtLink :to="item._path">
              <span class="docs-nav-icon">{{ item.navigation?.icon || '📄' }}</span>
              <span class="docs-nav-title">{{ item.navigation?.title || item.title }}</span>
            </NuxtLink>
          </div>
        </nav>
        <div class="docs-sidebar-footer">
          <p>
            <NuxtLink to="/">← Voltar ao Playground</NuxtLink>
          </p>
        </div>
      </aside>
      <main class="docs-content">
        <div class="docs-article">
          <slot />
        </div>
        <div class="docs-footer">
          <div class="docs-footer-nav">
            <NuxtLink
              v-if="prevItem"
              :to="prevItem._path"
              class="docs-footer-link prev"
            >
              <span class="arrow">←</span>
              <span class="label">Anterior</span>
              <span class="title">{{ prevItem.navigation?.title || prevItem.title }}</span>
            </NuxtLink>
            <div
              v-else
              class="docs-footer-link prev disabled"
            />
            <NuxtLink
              v-if="nextItem"
              :to="nextItem._path"
              class="docs-footer-link next"
            >
              <span class="arrow">→</span>
              <span class="label">Próximo</span>
              <span class="title">{{ nextItem.navigation?.title || nextItem.title }}</span>
            </NuxtLink>
            <div
              v-else
              class="docs-footer-link next disabled"
            />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const { data: navItems } = await useAsyncData('docs-nav', () =>
  queryCollectionNavigation('docs'),
{ default: () => [] },
)

function isActive(path) {
  return route.path === path
}

function findCurrentIndex() {
  if (!navItems.value) return -1
  const currentPath = route.path.replace(/\/$/, '')
  return navItems.value.findIndex(item => item._path.replace(/\/$/, '') === currentPath)
}

const currentIndex = computed(() => findCurrentIndex())
const prevItem = computed(() => {
  const idx = currentIndex.value
  return idx > 0 ? navItems.value[idx - 1] : null
})
const nextItem = computed(() => {
  const idx = currentIndex.value
  return idx >= 0 && idx < navItems.value.length - 1 ? navItems.value[idx + 1] : null
})
</script>

<style scoped>
.docs-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.docs-container {
  display: flex;
  flex: 1;
}

/* Sidebar */
.docs-sidebar {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid #e5e7eb;
  background: #f9fafb;
  padding: 1.5rem 0;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.docs-logo {
  padding: 0 1.5rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 1rem;
}

.docs-logo a {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: inherit;
}

.docs-logo-icon {
  font-size: 1.5rem;
}

.docs-logo-text {
  font-size: 1.25rem;
  font-weight: 700;
}

.docs-nav {
  flex: 1;
  padding: 0 0.75rem;
}

.docs-nav-item {
  margin-bottom: 0.25rem;
}

.docs-nav-item a {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  text-decoration: none;
  color: #374151;
  transition: all 0.15s ease;
}

.docs-nav-item a:hover {
  background: #e5e7eb;
  color: #111827;
}

.docs-nav-item.active a {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 500;
}

.docs-nav-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.docs-nav-title {
  font-size: 0.875rem;
}

.docs-sidebar-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.875rem;
}

.docs-sidebar-footer a {
  color: #6b7280;
  text-decoration: none;
}

.docs-sidebar-footer a:hover {
  color: #111827;
}

/* Main content */
.docs-content {
  flex: 1;
  padding: 2rem 3rem;
  max-width: 900px;
}

.docs-article {
  margin-bottom: 3rem;
}

/* Footer navigation */
.docs-footer {
  border-top: 1px solid #e5e7eb;
  padding-top: 2rem;
}

.docs-footer-nav {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.docs-footer-link {
  display: flex;
  flex-direction: column;
  padding: 1rem 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  text-decoration: none;
  transition: all 0.15s ease;
  min-width: 200px;
}

.docs-footer-link:hover {
  border-color: #3b82f6;
  background: #f0f7ff;
}

.docs-footer-link.prev {
  align-items: flex-start;
}

.docs-footer-link.next {
  align-items: flex-end;
  text-align: right;
}

.docs-footer-link .arrow {
  font-size: 1.25rem;
  color: #3b82f6;
}

.docs-footer-link .label {
  font-size: 0.75rem;
  color: #6b7280;
}

.docs-footer-link .title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

.docs-footer-link.disabled {
  opacity: 0;
  pointer-events: none;
}

/* Responsive */
@media (max-width: 768px) {
  .docs-container {
    flex-direction: column;
  }

  .docs-sidebar {
    width: 100%;
    min-width: auto;
    height: auto;
    position: relative;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
  }

  .docs-content {
    padding: 1.5rem;
  }

  .docs-footer-nav {
    flex-direction: column;
  }

  .docs-footer-link {
    min-width: auto;
  }
}
</style>
