# Design Doc: Payload-Aware Navigation no nuxt-lite

## Problema

### Situação Atual

O nuxt-lite hoje faz **full HTML swap** na navegação SPA. Quando o usuário clica de `/manuscritos/despertar` para `/manuscritos/ao-redor-do-portao`:

```
Atualmente:
  1. fetch('/manuscritos/ao-redor-do-portao/index.html')  → 47KB baixados
  2. DOMParser.parseFromString(rawHtml)
  3. contentEl.innerHTML = newDoc.querySelector('main').innerHTML
  4. updateMeta(rawHtml)
```

### O Gargalo

Duas páginas de mesmo layout compartilham ~73% de HTML idêntico (header, footer, nav, scripts, CSS). Só o conteúdo do artigo muda.

| Página | Total | Layout compartilhado | Conteúdo único |
|---|---|---|---|
| despertar | 47KB | ~34KB (73%) | ~13KB (27%) |
| ao-redor-do-portao | 37KB | ~34KB (73%) | ~8KB (27%) |

Baixamos **47KB** quando só precisamos de **~8KB**.

### O Dilema Central

> "Como hidratar apenas o conteúdo se não tenho o estado da próxima página? E pior, como mudar a estrutura HTML dessa próxima página dinamicamente se ela for diferente?"

O Nuxt resolve isso com **VDOM**: re-renderiza componentes Vue com dados do payload e faz patch no DOM. Sem Vue runtime, não temos equivalente.

---

## Restrições

1. **Portabilidade zero config** — deve funcionar com qualquer projeto Nuxt sem ajustes manuais
2. **Não conhecer a estrutura do projeto** — sem chaves hardcoded, sem fingerprinting frágil
3. **Manter compatibilidade** — fallback para comportamento atual se otimização não for viável
4. **Usar payloads que já existem** — o Nuxt já gera `_payload.json` por página

---

## Soluções Exploradas (e Descartadas)

### 1. ❌ Fingerprinting de Layout por Hash

**Ideia:** Hash do layout (sem conteúdo) para agrupar páginas por template.

**Problema:** Se mudar uma classe sequer, o hash muda. Frágil, quebra com qualquer alteração. Não-portátil.

### 2. ❌ Chaves de Payload Hardcoded

**Ideia:** Extrair `post.title`, `post.body`, etc. e injetar em seletores conhecidos.

**Problema:** Advinha estrutura específica do projeto. Zero portabilidade.

### 3. ❌ Só Baixar `<main>`

**Ideia:** Extrair conteúdo de `<main>` para arquivo separado, baixar só isso.

**Problema:** Conteúdo dinâmico fica FORA do `<main>` — posts relacionados, navegação entre artigos, curtidas. ~10KB de conteúdo variável ficam fora.

### 4. ❌ Renderizar Minimark no Cliente

**Ideia:** Usar AST Minimark do payload para renderizar HTML no cliente.

**Problema:** Requer conhecer o template HTML exato de cada componente. Diferentes layouts (artigo, listagem, sobre) têm estruturas incompatíveis.

---

## Decisão Final: Template Superset + Payloads com Slots Sempre Definidos

### A Descoberta Chave

> "Cada página tem seus próprios index independente das páginas comparadas, a comparação serve tão somente para descobrir ou não descobrir index de ambos os lados, isso quer dizer, também que cada payload terá seu próprio tamanho de index, sendo que o index 0 mapeia para o index 0 da página real no navegador a qual aquele payload pertence."

### O Problema: Índices Ausentes

Se o Artigo 3 tem `<author>` que o Artigo 1 não tem, o payload do Artigo 2 não teria índice 2. No runtime, ao navegar de Artigo 3 para Artigo 2, os marcadores `<!--NL:2-->` do DOM não teriam correspondência.

### A Solução: Slots Sempre Existentes, Mesmo que Vazios

> "Um payload não pode simplesmente ter blocos/index indefinidos, eles devem existir, ainda que sem conteúdo, assim são indicações de em outra página, em algum lugar, aquele index está preenchido."

**Estrutura:**

1. **Template Superset** — contém TODOS os marcadores encontrados em TODAS as comparações:
```html
<html>
  <header>...</header>
  <!--NL:0-->  ← conteúdo principal
  <!--NL:1-->  ← posts relacionados
  <!--NL:2-->  ← autor
  <!--NL:3-->  ← data
  <!--NL:4-->  ← navegação entre posts
  <footer>...</footer>
</html>
```

2. **Cada payload define TODOS os índices** — vazios (`""`) onde não há conteúdo:
```json
// Payload do Artigo 2 (sem autor, sem data)
{ "0": "<main>A</main>", "1": "<rel>B</rel>", "2": "", "3": "", "4": "<nav>prev/next</nav>" }

// Payload do Artigo 3 (com autor, com data)
{ "0": "<main>X</main>", "1": "<rel>C</rel>", "2": "<author>Z</author>", "3": "<date>mar</date>", "4": "<nav>prev/next</nav>" }

// Payload do Artigo 4 (só conteúdo principal)
{ "0": "<main>M</main>", "1": "", "2": "", "3": "", "4": "" }
```

3. **Runtime** — substitui TODOS os marcadores:
   - Índice com conteúdo → `marker.outerHTML = content`
   - Índice vazio (`""`) → `marker.remove()` (remove do DOM)

### Por que Isso Funciona

| Propriedade | Benefício |
|---|---|
| **Matriz previsível** | Runtime sempre sabe quantos índices existem — não precisa de lógica condicional |
| **Slot vazio = sem conteúdo** | Semântica clara — página não tem aquele bloco |
| **Slot preenchido = injetar** | Semântica clara — página tem aquele bloco |
| **Reatividade artificial** | Estado é sempre completo — sem `undefined` que quebraria bindings |

---

### 5. ✅ 1-para-Muitos Acumulativo (Abordagem Escolhida)

**Ideia:** A primeira página de um grupo é a referência. Cada página subsequente é comparada com a referência. Blocos variáveis são **acumulados** — cada nova comparação pode revelar blocos que não existiam nas anteriores.

**Como funcionaria:**
```
Referência (artigo 1):
  <main>Artigo 1</main>
  <related>Rel A</related>

Compare ref vs Artigo 2:
  bloco[0] = <main>Artigo 2</main>
  bloco[1] = <related>Rel B</related>
  → 2 blocos encontrados

Compare ref vs Artigo 3:
  bloco[0] = <main>Artigo 3</main>
  bloco[1] = <related>Rel C</related>
  bloco[2] = <author>Autor X</author>   ← NOVO! não existia na ref
  → 3 blocos, template precisa expandir

Compare ref vs Artigo 4:
  bloco[0] = <main>Artigo 4</main>
  bloco[1] = <related>Rel D</related>
  bloco[2] = <author>Autor Y</author>
  bloco[3] = <date>10 mar 2024</date>   ← MAIS UM novo!
  → 4 blocos

Template final (referência expandida):
  <main><!--NL:0--></main>
  <related><!--NL:1--></related>
  <author><!--NL:2--></author>
  <date><!--NL:3--></date>

Payload do Artigo 2: { "0": "...", "1": "..." }              ← 2 blocos
Payload do Artigo 3: { "0": "...", "1": "...", "2": "..." }  ← 3 blocos
Payload do Artigo 4: { "0": "...", "1": "...", "2": "...", "3": "..." }  ← 4 blocos
```

**Pró:**
- Genérico — funciona com qualquer HTML, sem conhecer estrutura
- Portátil — zero configuração
- Acumulativo — descobre TODOS os slots variáveis automaticamente
- O(N) comparações — referência vs N-1 páginas
- Runtime simples — fetch payload + injetar nos marcadores

**Contra:**
- Se páginas de layouts MUITO diferentes forem agrupadas, acumula blocos demais → ineficiente
- Precisa agrupar páginas por tipo antes de diffar (ex: artigos com artigos, listagens com listagens)
- LCS em HTML de 60KB é custoso (mas só O(N) vezes, não O(N²))

---

## Proposta Consolidada (Afunicando)

### Abordagem Híbrida: **Common Substring + Múltiplos Blocos**

Em vez de diff sequencial arbitrário ou muitos-para-muitos, a ideia é:

1. **Ordenar páginas por similaridade estrutural** antes de comparar
   - Agrupar por tipo: articles (scriptorium-post), listings (sacred-grid), etc.
   - Detectar tipo pelo primeiro elemento filho de `<main>` ou classes do componente raiz
   - Isso garante que comparações sejam entre páginas realmente similares

2. **Dentro de cada grupo, LCS iterativo** para encontrar todos os blocos variáveis
   - Comparar página N com página N-1 do mesmo grupo
   - Encontrar maior substring comum → tudo antes é bloco diff, tudo depois é bloco diff
   - Repetir recursivamente nos blocos diff até estabilizar
   - Resultado: N blocos variáveis indexados

3. **Gerar dois artefatos por grupo:**
   - `template.html` — HTML da primeira página com marcadores `<!--NL:0-->`, `<!--NL:1-->`...
   - `payloads/route.json` — `{ "0": "<main>...</main>", "1": "<section>...</section>" }`

4. **Runtime inteligente:**
   ```js
   // Carregar manifest uma vez
   manifest = await fetch('/_nuxt-lite/manifest.json').then(r => r.json())
   // manifest = { "/manuscritos/despertar": { template: "template-article", blocks: [0,1] }, ... }

   async function navigate(href) {
     var current = manifest[currentRoute]
     var target = manifest[targetRoute]

     if (current.template === target.template) {
       // MESMO TEMPLATE! Fetch só os blocos
       var payload = await fetch(`/_nuxt-lite/${targetRoute}.json`)
       for (const [idx, content] of Object.entries(payload)) {
         var marker = document.querySelector(`[data-nl="${idx}"]`)
         if (marker) marker.outerHTML = content
       }
     } else {
       // TEMPLATE DIFERENTE → fallback: full swap
       fullPageSwap(href)
     }
   }
   ```

### Métricas Esperadas

| Métrica | Atualmente | Proposta |
|---|---|---|
| Transferência (mesmo template) | 47KB | ~10KB (payload) |
| Transferência (template diferente) | 47KB | 47KB (fallback) |
| JS runtime | ~4KB | ~6KB (+lógica de markers) |
| Build time | X | X + O(N × LCS) |
| Configuração | Zero | Zero |

---

## Pergertas em Aberto

1. **✅ Agrupamento por layout do Nuxt:** Identificar layout comum pelo componente wrapper de `<NuxtPage>`. Páginas com mesmo layout = grupo comparável.

2. **✅ Pretty-print HTML + LCS customizado:** HTML do dist/ está em uma linha → formatar antes do diff. LCS customizado é preferível ao `diff` do npm.

3. **✅ Payloads próprios — `payloadExtraction: false`:** Desabilitar extração do Nuxt. Gerar payloads com HTML variável + head exclusivo (title, meta, link).

4. ~~O `diff` do npm deve ser usado?~~ Decidido: LCS customizado com HTML pretty-print.

---

## Histórico de Decisões

| Data | Decisão | Racional |
|---|---|---|
| 2025-04-12 | Descartar fingerprinting | Frágil — muda com qualquer alteração no HTML |
| 2025-04-12 | Descartar chaves hardcoded | Zero portabilidade |
| 2025-04-12 | Descartar "só baixar `<main>`" | Conteúdo dinâmico fora do main é ignorado |
| 2025-04-12 | Descartar Renderizar Minimark | Requer conhecer template de cada componente |
| 2025-04-12 | Adotar 1-para-muitos acumulativo | Referência vs todas as páginas, blocos acumulam |
| 2025-04-12 | Template Superset com TODOS os índices | Resolve problema de blocos ausentes entre páginas |
| 2025-04-12 | Payloads têm slots sempre definidos | String vazia `""` para ausente — nunca `undefined` |
| 2025-04-12 | Runtime: slot vazio → `marker.remove()` | Semântica clara — página não tem aquele conteúdo |
| 2025-04-12 | Discutir LCS vs diff lib | LCS é mais adequado para HTML contínuo |

---

## Próximos Passos

- [ ] **1.** `src/html/pretty-print.ts` — formatar HTML minificado para diff
- [ ] **2.** `src/html/diff.ts` — LCS iterativo acumulativo 1-para-muitos
- [ ] **3.** `src/html/layout-detector.ts` — detectar layout de cada página
- [ ] **4.** `src/html/payload-gen.ts` — gerar template superset + payloads JSON
- [ ] **5.** Atualizar `src/module.ts` — integrar tudo no hook `close`
- [ ] **6.** Atualizar `src/runtime/lite.js` — fetch payloads + substituir marcadores
- [ ] **7.** Atualizar `src/types.ts` — novos tipos
- [ ] **8.** Testar com build real do Orar e Labutar
