import type { ColorModeOptions } from '../types'

/**
 * Generates an ultra-fast, non-blocking inline script for color mode management.
 * This script runs immediately after being parsed to avoid theme flashing (FOUC)
 * without causing long tasks on the main thread.
 */
export function generateColorModeScript(options: ColorModeOptions): string {
  const { preference, fallback, storageKey, classSuffix } = options

  // Script minimalista e robusto
  // Usamos aspas simples e evitamos dependências externas
  return `(function(k,p,s){
    var h=document.documentElement,
        m=document.cookie.match('(^|;)\\\\s*'+k+'\\\\s*=\\\\s*([^;]+)'),
        v=m?m.pop():p;
    if(v==='system')v=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
    h.classList.add(v+s);
    h.setAttribute('data-color-mode',v);
  })('${storageKey}','${preference}','${classSuffix || ''}')`.replace(/\n\s*/g, '')
}
