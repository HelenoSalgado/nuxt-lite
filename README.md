# 🚀 nuxt-lite

> **Um runtime JavaScript mínimo (~6KB) para sites estáticos com navegação SPA ultrarrápida**

Módulo Nuxt que substitui o Vue/Nuxt JavaScript no cliente por um runtime otimizado que gerencia navegação SPA e troca de conteúdo via JSON. Perfeito para blogs, documentação e sites informativos.

---

## 🎯 Visão Geral

O **nuxt-lite** é feito para `nuxt generate`. Durante o build:
- Cada página é convertida em um **payload JSON compacto**
- O HTML é limpo de artefatos Vue/Nuxt
- Um **runtime minúsculo** (~6KB) é injetado

No navegador:
- Links são interceptados e o conteúdo é trocado via JavaScript
- **Sem carregar o Vue** (economiza ~500KB!)
- **Transições CSS suaves** entre páginas
- **Prefetch automático** ao passar o mouse sobre links

---

## ✨ Características

| Feature | Descrição |
|---------|-----------|
| 📦 **Payload JSON** | Conteúdo de cada página em JSON, sem Redux/State Management |
| ⚡ **Runtime leve** | ~6KB minificado (vs ~500KB do Vue) |
| 🔀 **Navegação SPA** | Links interceptados, prefetch no hover, transições CSS |
| 🎨 **CSS Otimizado** | Purgas automática via tree-shaking de seletores não usados |
| ♿ **A11y** | Foco automático em `<h1>`, suporte a navegação por teclado |
| 🧹 **HTML Limpo** | Remove `__NUXT_DATA__`, comentários, scripts desnecessários |
| 🔍 **SEO Analysis** | Valida metatags, hierarquia de headings, estrutura do DOM |

---

## ⚠️ O que NÃO faz

- ❌ Não é hidratação Vue (sem `ref`, `reactive` no cliente)
- ❌ Não funciona com SSR ou `nuxt dev` (apenas `nuxt generate`)
- ❌ Sem reatividade no cliente (use Web Components ou vanilla JS)

---

## 📦 Instalação

### 1. Adicione ao `nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  modules: [
    './nuxt-lite/src/module',  // ⚠️ Deve ser o PRIMEIRO módulo
    '@nuxt/content',
    // ... outros módulos
  ],
  
  nuxtLite: {
    optimizeCss: true,          // Ativar otimização de CSS
    cleanHtml: true,            // Remover artefatos Nuxt/Vue
    safelist: ['is-active'],    // Classes a preservar
    optimizeSeo: 'analyze',     // Analisar SEO
    pruneOutput: true,          // Limpar artifacts não utilizados
  }
})
```

### 2. Execute o build

```bash
npm run generate
```

---

## ⚙️ Configurações

| Opção | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `optimizeCss` | boolean | `false` | Ativar purga de CSS não utilizado |
| `safelist` | string[] | `[]` | Classes/seletores a preservar durante tree-shaking |
| `cleanHtml` | boolean | `true` | Remover `__NUXT_DATA__`, comentários, scripts |
| `optimizeSeo` | boolean \| string | `false` | `'analyze'` = reportar issues, `'fix'` = auto-corrigir |
| `pruneOutput` | boolean | `false` | Remover `.js`, `.map` não utilizados |

### Exemplo Completo

```typescript
nuxtLite: {
  optimizeCss: true,
  safelist: [
    'is-active',
    'is-open',
    'dark-mode',
  ],
  cleanHtml: true,
  optimizeSeo: {
    mode: 'analyze',
    failOnError: false,
    writeReport: true,
  },
  pruneOutput: true,
}
```

---

## 🔍 SEO Analysis

Ative a análise automática para validar metatags e estrutura HTML:

```typescript
nuxtLite: {
  optimizeSeo: 'analyze',  // ou 'fix' para auto-corrigir
}
```

### O que é verificado

**Metatags:**
- ✅ Presença de `title`, `description`, `canonical`
- ✅ Open Graph (`og:title`, `og:image`, etc.)
- ✅ Twitter Card
- ✅ Tamanho de texto (title: 30-60 chars, description: 120-160 chars)

**Estrutura do DOM:**
- ✅ Apenas 1 `<h1>` por página
- ✅ Hierarquia correta de headings
- ✅ Sem aninhamento excessivo (>8 níveis = erro)
- ✅ `alt` em todas as imagens
- ✅ Texto em todos os links

### Output do Build

```
[nuxt-lite:seo] /blog/article-1 — Score: 92/100
[nuxt-lite:seo] /about — Score: 88/100
[nuxt-lite:seo] /contact — Score: 95/100

┌─ nuxt-lite: SEO Analysis Summary ─────────────┐
│ Pages analyzed:  3                            │
│ Total issues:    5                            │
│ Average score:   92/100                       │
└───────────────────────────────────────────────┘

📄 Relatório completo em: .seo/analise.md
```

---

## 🏗️ Estrutura de Páginas

O runtime substitui conteúdo dentro de `<main>` ou `[data-page-content]`:

```vue
<!-- layouts/default.vue -->
<template>
  <div class="app">
    <header class="navbar">
      <!-- Fixo em todas as páginas -->
    </header>

    <main data-page-content>
      <!-- ⬅️ Este conteúdo é trocado na navegação SPA -->
      <slot />
    </main>

    <footer class="footer">
      <!-- Fixo em todas as páginas -->
    </footer>
  </div>
</template>
```

---

## 🎬 Transições CSS

Defina transições suaves entre páginas:

```css
/* global.css */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  filter: blur(1rem);
}
```

O runtime aplica automaticamente:
1. `page-leave-active` + `page-leave-from` ao sair
2. Aguarda CSS transition
3. `page-enter-active` + `page-enter-from` ao entrar
4. Remove classes após conclusão

---

## 🚀 Como Funciona

### Durante o Build (`nuxt generate`)

```
Input HTML (SSR)
    ↓
1. Parse com linkedom
    ↓
2. Extrai conteúdo de <main>
    ↓
3. Serializa em JSON (_payload.json)
    ↓
4. Purga CSS (tree-shaking)
    ↓
5. Remove artefatos Vue/Nuxt
    ↓
6. Injeta runtime (~6KB)
    ↓
Output: HTML + _payload.json + lite.js
```

### No Navegador (Client-side)

```
1. Usuário passa mouse sobre link
   ↓
2. Prefetch: inicia download de _payload.json (com cache)
   ↓
3. Usuário clica no link
   ↓
4. Runtime reconstrói DOM do payload
   ↓
5. Aplica transições CSS
   ↓
6. Move foco para <h1> (acessibilidade)
   ↓
✅ Nova página renderizada
```

### Recursos Especiais

**Prefetch Inteligente:**
- Baixa payload ao passar mouse
- Reutiliza Promise entre hover e clique
- Sem duplicação de downloads

**Cache Global:**
- Payloads são armazenados em Map
- Navegação para trás (back) é instantânea
- Suporta navegação rápida entre múltiplas páginas

---

## 🛠️ Desenvolvimento

### Scripts disponíveis

```bash
npm run dev              # Rodar playground em modo dev
npm run dev:build        # Build do playground
npm run build:runtime    # Build do runtime (esbuild)
npm run prepack          # Build completo para publicação
npm run test             # Rodar testes
```

### Estrutura do Projeto

```
nuxt-lite/
├── src/
│   ├── module.ts              # Entry point do módulo Nuxt
│   ├── runtime/
│   │   └── lite.ts            # Runtime client (~6KB)
│   ├── html/
│   │   ├── process.ts         # Processamento de HTML
│   │   ├── clean.ts           # Limpeza de artefatos
│   │   ├── extract.ts         # Extração de seletores
│   │   └── serialize.ts       # Serialização em JSON
│   ├── css/
│   │   ├── parser.ts          # Parser de CSS
│   │   └── filter.ts          # Filtro de seletores
│   └── seo/
│       ├── metatags.ts        # Análise de metatags
│       └── dom-analysis.ts    # Análise de DOM
├── test/
├── playground/                # Demo do módulo
└── README.md
```

---

## 🎓 Casos de Uso

✅ **Perfeito para:**
- Blogs e revistas
- Sites informativos
- Documentação
- Portfólios
- Landing pages estáticas

❌ **Não recomendado para:**
- Aplicações web interativas
- Dashboards com tempo real
- Apps que precisam de state management
- Sites com muita reatividade no cliente

---

## 📊 Performance

### Comparação

| Métrica | Vue | nuxt-lite |
|---------|-----|-----------|
| JS Framework | ~500KB | ~6KB |
| Time to Interactive (TTI) | 2-4s | <500ms |
| First Paint (FP) | 1-2s | <200ms |
| Navegação SPA | Hidratação completa | Apenas conteúdo |

### Benchmarks

```
Build (113 páginas):        ~16s
Payload médio:              ~8KB
CSS média por página:       ~2KB
Runtime + overlay:          ~6KB
```

---

## 🚀 Deploy

O nuxt-lite gera um site completamente estático. Pode ser deployado em qualquer host:

```bash
# Build
npm run generate

# Deploy (Vercel, Netlify, Cloudflare Pages, etc)
npm run deploy  # ou conforme seu provedor
```

---

## 🐛 Troubleshooting

### CSS não está sendo aplicado no payload

**Solução:** Certifique-se de que:
1. O CSS está dentro de `<style scoped>` em um componente
2. As classes estão sendo usadas no template
3. `optimizeCss: true` está ativado no nuxt.config.ts

### Estilos desaparecem na navegação SPA

**Solução:** 
1. Coloque CSS compartilhado no `global.css`
2. Use `safelist` para classes dinâmicas:
   ```typescript
   nuxtLite: {
     safelist: ['is-active', 'dark-mode']
   }
   ```

### Prefetch não funciona

**Solução:** O prefetch é automático no hover. Se não funciona:
1. Verifique se os links usam `<a href>`
2. Confirme que não tem `target="_blank"` ou `rel="external"`
3. Abra DevTools → Network para ver os requests de prefetch

---

## 📝 Licença

MIT © 2026

---

## 🤝 Contribuindo

Contributions são bem-vindas! Abra uma issue ou PR.

## 📚 Referências

- [Documentação Nuxt](https://nuxt.com)
- [linkedom](https://github.com/WebReflection/linkedom) - DOM parsing
- [esbuild](https://esbuild.github.io) - Build tool

---

**Feito com ❤️ para sites estáticos ultrarrápidos**
