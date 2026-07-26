# Changelog


## v0.0.3

[compare changes](https://github.com/orarelabutar/nuxt-lite/compare/v0.0.2...v0.0.3)

## v0.0.2


### 🚀 Enhancements

- Nuxt-lite module — lightweight hydration, CSS tree-shaking, SPA navigation ([2e9455c](https://github.com/orarelabutar/nuxt-lite/commit/2e9455c))
- Payload-aware navigation com diff HTML 1-para-muitos ([43f9903](https://github.com/orarelabutar/nuxt-lite/commit/43f9903))
- Add SVG optimization and lightweight color mode ([7872284](https://github.com/orarelabutar/nuxt-lite/commit/7872284))
- Implement dynamic per-page CSS and critical inline CSS extraction ([009d900](https://github.com/orarelabutar/nuxt-lite/commit/009d900))
- Implement payload cache and prefetch on hover ([23943f3](https://github.com/orarelabutar/nuxt-lite/commit/23943f3))

### 🩹 Fixes

- Separar head do body no diff, payloads no caminho da rota ([3259f06](https://github.com/orarelabutar/nuxt-lite/commit/3259f06))
- Processar em temp, template + payload separado, hydration inicial ([b4c5897](https://github.com/orarelabutar/nuxt-lite/commit/b4c5897))
- Melhorar prefetch on-hover com debounce e protecao contra duplicatas ([0c7cb05](https://github.com/orarelabutar/nuxt-lite/commit/0c7cb05))
- Correção na geração de payloads e ajustes no modo de análise SEO ([6986848](https://github.com/orarelabutar/nuxt-lite/commit/6986848))
- Core type safety improvements and test cleanup ([a2e7a40](https://github.com/orarelabutar/nuxt-lite/commit/a2e7a40))
- **runtime:** Prevent DOM re-render on hash navigation (footnotes bug) ([3009bdf](https://github.com/orarelabutar/nuxt-lite/commit/3009bdf))

### 💅 Refactors

- Otimização completa de hidratação e payloads ([4b75518](https://github.com/orarelabutar/nuxt-lite/commit/4b75518))
- Simplificar runtime para HTML-only swap + prefetch nativo ([f0d6cce](https://github.com/orarelabutar/nuxt-lite/commit/f0d6cce))
- Reestruturação do módulo, remoção de arquivos não utilizados, nova serialização HTML e runtime TypeScript ([34f7964](https://github.com/orarelabutar/nuxt-lite/commit/34f7964))
- Consolidate extractMetaTags into utils/meta.ts ([7ea02ad](https://github.com/orarelabutar/nuxt-lite/commit/7ea02ad))
- Apply remaining phase 2 and 3 refactoring (headers, translations, module orchestration) ([6fbb496](https://github.com/orarelabutar/nuxt-lite/commit/6fbb496))

### 📖 Documentation

- Remove obsolete guide docs and summarize next steps for performance ([024e2ad](https://github.com/orarelabutar/nuxt-lite/commit/024e2ad))
- Completely revamp README with better structure and clarity ([3baab33](https://github.com/orarelabutar/nuxt-lite/commit/3baab33))

### 🏡 Chore

- Remove unused variables, types and vague comments ([bb6fc51](https://github.com/orarelabutar/nuxt-lite/commit/bb6fc51))

### 🎨 Styles

- Translate Portuguese comments to English ([369279f](https://github.com/orarelabutar/nuxt-lite/commit/369279f))
- Apply automatic lint fixes ([9744ed4](https://github.com/orarelabutar/nuxt-lite/commit/9744ed4))

### ❤️ Contributors

- Heleno Salgado <helenosalgado19@gmail.com>

