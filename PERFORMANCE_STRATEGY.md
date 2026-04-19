# Estratégia de Performance: Módulo nuxt-lite

Este documento detalha as oportunidades de otimização identificadas após a análise do trace de performance do navegador e propõe melhorias estruturais no módulo para garantir o carregamento mais rápido possível.

## 1. Filosofia "Static-First"

A arquitetura do **nuxt-lite** assume que o primeiro carregamento (via URL direta) é puramente estático. O mecanismo SPA e a hidratação só são ativados para navegações internas subsequentes. Portanto, o caminho crítico inicial deve ser otimizado ignorando o JavaScript.

### 1.1. Critical CSS (Layout)
*   **Problema:** Carregar todo o CSS de uma vez (mesmo otimizado) pode atrasar o First Contentful Paint (FCP).
*   **Melhoria Implementada:** Opção `criticalCss: true`. O módulo agora identifica todos os seletores CSS usados *fora* do conteúdo dinâmico (`<main>` ou `[data-page-content]`) e os injeta inline no `<head>`. Isso garante que o Header, Footer e estrutura básica do site apareçam instantaneamente, sem depender de arquivos externos.

### 1.2. Adiamento Extremo do Runtime
*   **Melhoria:** O script `lite.js` agora é injetado com `defer` por padrão e deve ser considerado o recurso de menor prioridade no carregamento inicial. Ele não deve competir com fontes ou imagens.

## 2. Refinamento de Priorização de Recursos

### 2.1. Preload de Fontes (Próximo Passo)
*   **Otimização:** Identificar automaticamente os arquivos de fonte declarados no CSS e injetar links de `preload` com `crossorigin` no HTML. Isso elimina o "pulo" de fonte (FOIT/FOUT).

### 2.2. Font-Display Swap
*   **Melhoria:** Forçar a inclusão de `font-display: swap` em todas as regras `@font-face` processadas pelo módulo.

## 3. Redução da Complexidade de Renderização

Identificamos um tempo de `UpdateLayoutTree` de 16ms para um DOM pequeno (323 nós).

*   **Melhoria Implementada:** Remoção total de atributos `data-v-` mortos. Apenas os hashes que possuem regras CSS correspondentes são mantidos (e encurtados para `s1`, `s2`, etc.). Isso reduz o tamanho do DOM e o custo de matching do motor de CSS.
*   **CSS Containment (Próximo Passo):** Injetar automaticamente `contain: content` em containers estruturais estáveis.

## 4. Otimização do Runtime (`lite.ts`)

### 4.1. Speculative Prefetch
*   Implementar prefetch dos payloads JSON baseado em `requestIdleCallback` para links visíveis na viewport, garantindo que a navegação interna seja instantânea quando ocorrer.

## 5. Pruning e Higienização de Saída (Build Time)

*   **Aggressive Pruning:** O módulo agora remove recursivamente artefatos de build do Nuxt original (`.js`, `.map`) via `pruneOutput: true`, garantindo que o diretório de saída contenha apenas o essencial.

---

### Checkist de Implementação Atual

- [x] Suporte a `buildAssetsDir` customizado.
- [x] Filtro CSS estrito (casamento de todos os componentes do seletor).
- [x] Short-hashing de `data-v` (apenas para hashes vivos).
- [x] Injeção de Critical CSS (Layout).
- [x] Remoção de preloads redundantes do Nuxt original.
