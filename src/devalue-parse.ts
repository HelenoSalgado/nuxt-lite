/* eslint-disable @typescript-eslint/no-explicit-any, unicorn/no-new-array */
/**
 * devalue-parse.ts — Parser compatível com o formato de serialização do Nuxt 4
 *
 * O Nuxt usa `devalue` para serializar payloads. Este módulo recria a lógica
 * de unflatten/parse para desserializar os _payload.json no cliente nuxt-lite.
 *
 * Referência: node_modules/devalue/src/parse.js
 *
 * ZERO conhecimento sobre o conteúdo do payload — apenas desserializa o formato.
 */

// Constantes do devalue
const UNDEFINED = -1
const NAN = -2
const POSITIVE_INFINITY = -3
const NEGATIVE_INFINITY = -4
const NEGATIVE_ZERO = -5
const HOLE = -6
const SPARSE = -7

// Revivers padrão do Nuxt (node_modules/nuxt/dist/app/plugins/revive-payload.client.js)
// Apenas desembrulham os wrappers de reatividade — retornam o dado puro
const NUXT_REVIVERS: Record<string, (value: any) => any> = {
  NuxtError: data => data,
  EmptyShallowRef: data => data,
  EmptyRef: data => data,
  ShallowRef: data => data,
  ShallowReactive: data => data,
  Ref: data => data,
  Reactive: data => data,
}

/**
 * Parseia um payload serializado pelo devalue (formato do Nuxt)
 * @param serialized JSON string ou array já parseado
 * @returns Objeto desserializado — exatamente como o Nuxt faria no cliente
 */
export function parsePayload(serialized: string | any[]): Record<string, any> {
  const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized
  return unflatten(parsed, NUXT_REVIVERS)
}

/**
 * Revive um valor flattened pelo devalue
 * Adaptado de: node_modules/devalue/src/parse.js → unflatten()
 *
 * Não faz nenhuma suposição sobre o conteúdo — apenas revive a estrutura.
 */
function unflatten(parsed: number | any[], revivers?: Record<string, (value: any) => any>): any {
  if (typeof parsed === 'number') return hydrate(parsed, true)

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('[nuxt-lite] Invalid payload: not an array or empty')
  }

  const values = parsed as any[]
  const hydrated = Array.from({ length: values.length })

  function hydrate(index: number, standalone = false): any {
    if (index === UNDEFINED) return undefined
    if (index === NAN) return Number.NaN
    if (index === POSITIVE_INFINITY) return Infinity
    if (index === NEGATIVE_INFINITY) return -Infinity
    if (index === NEGATIVE_ZERO) return -0

    if (standalone || typeof index !== 'number') {
      throw new Error(`[nuxt-lite] Invalid payload: bad index ${index}`)
    }

    if (index in hydrated) return hydrated[index]

    const value = values[index]

    if (!value || typeof value !== 'object') {
      hydrated[index] = value
      return hydrated[index]
    }

    if (Array.isArray(value)) {
      if (typeof value[0] === 'string') {
        const type = value[0]
        const reviver = revivers?.[type]

        if (reviver) {
          let i = value[1]
          if (typeof i !== 'number') {
            i = values.push(value[1]) - 1
          }
          hydrated[index] = reviver(hydrate(i))
          return hydrated[index]
        }

        switch (type) {
          case 'Date':
            hydrated[index] = new Date(value[1])
            break
          case 'Set': {
            const set = new Set()
            hydrated[index] = set
            for (let i = 1; i < value.length; i++) {
              set.add(hydrate(value[i]))
            }
            break
          }
          case 'Map': {
            const map = new Map()
            hydrated[index] = map
            for (let i = 1; i < value.length; i += 2) {
              map.set(hydrate(value[i]), hydrate(value[i + 1]))
            }
            break
          }
          case 'RegExp':
            hydrated[index] = new RegExp(value[1], value[2])
            break
          case 'Object': {
            const obj = Object.create(null)
            hydrated[index] = obj
            for (let i = 1; i < value.length; i += 2) {
              if (value[i] === '__proto__') {
                throw new Error('[nuxt-lite] Cannot parse object with __proto__')
              }
              obj[value[i]] = hydrate(value[i + 1])
            }
            break
          }
          case 'BigInt':
            hydrated[index] = BigInt(value[1])
            break
          case 'null': {
            const obj: Record<string, any> = {}
            hydrated[index] = obj
            for (let i = 1; i < value.length; i += 2) {
              if (value[i] === '__proto__') {
                throw new Error('[nuxt-lite] Cannot parse object with __proto__')
              }
              obj[value[i]] = hydrate(value[i + 1])
            }
            break
          }
          default:
            hydrated[index] = value
        }
      }
      else if (value[0] === SPARSE) {
        const len = value[1]
        const array = new Array(len)
        hydrated[index] = array
        for (let i = 2; i < value.length; i += 2) {
          array[value[i]] = hydrate(value[i + 1])
        }
      }
      else {
        const array = Array.from({ length: value.length })
        hydrated[index] = array
        for (let i = 0; i < value.length; i++) {
          const n = value[i]
          if (n === HOLE) continue
          array[i] = hydrate(n)
        }
      }
      return hydrated[index]
    }

    // Objeto plano
    const object: Record<string, any> = {}
    hydrated[index] = object

    for (const key of Object.keys(value)) {
      if (key === '__proto__') {
        throw new Error('[nuxt-lite] Cannot parse object with __proto__')
      }
      object[key] = hydrate(value[key])
    }

    return hydrated[index]
  }

  return hydrate(0)
}
