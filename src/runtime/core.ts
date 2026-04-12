/**
 * Core reactivity system for nuxt-lite
 * Custom reactive state management without Vue runtime
 */

import { defineNuxtPlugin } from '#app'

// ===== Reactive Proxy System =====

const reactiveMap = new WeakMap<object, any>()

function createReactiveProxy<T extends object>(target: T): T {
  // Return existing proxy if available
  if (reactiveMap.has(target)) {
    return reactiveMap.get(target)
  }

  const proxy = new Proxy(target, {
    get(obj, prop) {
      const value = Reflect.get(obj, prop)
      // Nested objects become reactive too
      if (typeof value === 'object' && value !== null) {
        return createReactiveProxy(value)
      }
      return value
    },
    set(obj, prop, value) {
      const oldValue = Reflect.get(obj, prop)
      const result = Reflect.set(obj, prop, value)
      
      // Notify subscribers if value changed
      if (oldValue !== value) {
        notifySubscribers(prop as string, value, oldValue)
      }
      
      return result
    },
    deleteProperty(obj, prop) {
      const result = Reflect.deleteProperty(obj, prop)
      notifySubscribers(prop as string, undefined, obj[prop as keyof typeof obj])
      return result
    }
  })

  reactiveMap.set(target, proxy)
  return proxy
}

// ===== Subscriber System =====

type Subscriber = (newValue: any, oldValue: any) => void
const subscribers = new Map<string, Set<Subscriber>>()

/**
 * Subscribe to changes on a specific property or all properties (*)
 */
function subscribe(prop: string, callback: Subscriber): () => void {
  if (!subscribers.has(prop)) {
    subscribers.set(prop, new Set())
  }
  subscribers.get(prop)!.add(callback)

  // Return unsubscribe function
  return () => {
    subscribers.get(prop)?.delete(callback)
  }
}

/**
 * Notify all subscribers about a property change
 */
function notifySubscribers(prop: string, newValue: any, oldValue: any) {
  // Notify specific property subscribers
  const propSubs = subscribers.get(prop)
  if (propSubs) {
    for (const callback of propSubs) {
      try {
        callback(newValue, oldValue)
      } catch (e) {
        console.error('[nuxt-lite] Error in subscriber callback:', e)
      }
    }
  }
  
  // Notify wildcard subscribers (all changes)
  const wildcardSubs = subscribers.get('*')
  if (wildcardSubs) {
    for (const callback of wildcardSubs) {
      try {
        callback(newValue, oldValue)
      } catch (e) {
        console.error('[nuxt-lite] Error in wildcard subscriber:', e)
      }
    }
  }
}

// ===== Computed Values =====

interface ComputedRef<T> {
  readonly value: T
}

function computed<T>(getter: () => T): ComputedRef<T> {
  return new Proxy({} as ComputedRef<T>, {
    get(_target, prop) {
      if (prop === 'value') {
        return getter()
      }
      return undefined
    }
  })
}

// ===== Watch System =====

function watch<T>(getter: () => T, callback: (newValue: T, oldValue: T) => void): () => void {
  let oldValue = getter()
  
  return subscribe('*', (newValue) => {
    const currentValue = getter()
    if (currentValue !== oldValue) {
      callback(currentValue, oldValue)
      oldValue = currentValue
    }
  })
}

// ===== Export to Window =====
// (Handled by Nuxt plugin below)

export { createReactiveProxy, subscribe, computed, watch }
export type { ComputedRef, Subscriber }

// Nuxt plugin export
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return
  
  // Initialize once
  if (!(window as any).__NuxtLite) {
    ;(window as any).__NuxtLite = {
      reactive: createReactiveProxy,
      subscribe,
      computed,
      watch,
    }
    
    console.log('[nuxt-lite] Core reactive system initialized')
  }
})
