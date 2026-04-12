/**
 * nuxt-lite — SPA navigation with native prefetch
 *
 * Prefetch strategy:
 * - Injects <link rel="prefetch" as="document"> on hover
 * - Browser manages priority, cache, and concurrency natively
 * - Respects Save-Data and Data-Saver automatically
 *
 * Navigation:
 * - Fetches HTML via fetch() only on click (if not already prefetched)
 * - Uses browser cache when available (prefetch populates HTTP cache)
 * - Swaps content via innerHTML (no DOM node theft)
 */
(function() {
  'use strict';

  if (window.__NUXT_LITE_RUNNING__) {
    return;
  }
  window.__NUXT_LITE_RUNNING__ = true;

  var subs = new Map();
  var transitionMs = 0;
  var navigating = false;
  var hoverTimeout;
  var prefetchLinks = new Set();

  function reactive(obj) {
    return new Proxy(obj, {
      set: function(t, p, v) {
        var o = t[p];
        t[p] = v;
        if (o !== v) {
          var arr = subs.get(p);
          if (arr) {
            arr.forEach(function(fn) { fn(v, o); });
          }
          var star = subs.get('*');
          if (star) {
            star.forEach(function(fn) { fn(v, o); });
          }
        }
        return true;
      }
    });
  }

  function on(prop, fn) {
    if (!subs.has(prop)) {
      subs.set(prop, new Set());
    }
    subs.get(prop).add(fn);
    return function() {
      var s = subs.get(prop);
      if (s) s.delete(fn);
    };
  }

  var state = reactive({ page: location.pathname });
  window.__NUXT_LITE_STATE__ = state;
  window.__NuxtLite = { reactive: reactive, on: on };

  function normalizeHref(href) {
    return href.split('?')[0].replace(/\/index$/, '').replace(/\/+$/, '') || '/';
  }

  function isNuxtPage(href) {
    if (!href || href[0] !== '/') return false;
    if (href.startsWith('/_nuxt') || href.startsWith('/__')) return false;
    if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|mp4|webm|mp3|ogg|zip|gz|css|js)(\?.*)?$/i.test(href)) return false;
    return true;
  }

  function nativePrefetch(href) {
    var key = normalizeHref(href);
    if (prefetchLinks.has(key)) return;
    prefetchLinks.add(key);
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'document';
    link.href = href;
    document.head.appendChild(link);
  }

  async function fetchHTML(href) {
    try {
      var res = await fetch(href, { headers: { Accept: 'text/html' } });
      if (!res.ok) return null;
      return await res.text();
    } catch (e) {
      console.error('[nuxt-lite] fetch error:', e);
      return null;
    }
  }

  function swapContent(rawHtml) {
    var doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    var newContent = doc.querySelector('[data-page-content]') || doc.querySelector('main');
    if (!newContent) return false;
    var contentEl = document.querySelector('[data-page-content]') || document.querySelector('main');
    if (!contentEl) return false;
    contentEl.innerHTML = newContent.innerHTML;
    return true;
  }

  function updateMeta(rawHtml) {
    var doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    if (doc.title) {
      document.title = doc.title;
    }
    var nd = doc.querySelector('meta[name="description"]');
    var od = document.querySelector('meta[name="description"]');
    if (nd && nd.content && od) {
      od.content = nd.content;
    }
    var nc = doc.querySelector('link[rel="canonical"]');
    var oc = document.querySelector('link[rel="canonical"]');
    if (nc && nc.href && oc) {
      oc.href = nc.href;
    }
    var metaTags = doc.querySelectorAll('meta');
    metaTags.forEach(function(meta) {
      var name = meta.getAttribute('name');
      var property = meta.getAttribute('property');
      var content = meta.getAttribute('content');
      if (content) {
        var target;
        if (name) {
          target = document.querySelector('meta[name="' + name + '"]');
        } else if (property) {
          target = document.querySelector('meta[property="' + property + '"]');
        }
        if (target) {
          target.setAttribute('content', content);
        }
      }
    });
  }

  function getTransitionMs() {
    if (transitionMs > 0) return transitionMs;
    var el = document.querySelector('.page-enter-active, .page-leave-active');
    if (!el) {
      transitionMs = 400;
      return 400;
    }
    var dur = getComputedStyle(el).transitionDuration;
    if (!dur) {
      transitionMs = 400;
      return 400;
    }
    var ms = Number.parseFloat(dur);
    transitionMs = dur.includes('ms') ? ms : ms * 1000;
    return transitionMs;
  }

  async function navigate(href, updateHistory) {
    if (updateHistory === undefined) updateHistory = true;
    if (navigating) return;
    navigating = true;
    var contentEl = document.querySelector('[data-page-content]') || document.querySelector('main');
    if (!contentEl || !isNuxtPage(href)) {
      window.location.href = href;
      navigating = false;
      return;
    }
    try {
      var ms = getTransitionMs();
      contentEl.classList.add('page-leave-active', 'page-leave-from');
      void contentEl.offsetHeight;
      contentEl.classList.remove('page-leave-from');
      contentEl.classList.add('page-leave-to');
      var rawHtml = await fetchHTML(href);
      await new Promise(function(r) { setTimeout(r, ms); });
      if (!rawHtml) {
        contentEl.classList.remove('page-leave-active', 'page-leave-from', 'page-leave-to');
        if (updateHistory) window.location.href = href;
        navigating = false;
        return;
      }
      var swapped = swapContent(rawHtml);
      if (!swapped) {
        contentEl.classList.remove('page-leave-active', 'page-leave-from', 'page-leave-to');
        if (updateHistory) window.location.href = href;
        navigating = false;
        return;
      }
      updateMeta(rawHtml);
      state.page = normalizeHref(href);
      if (updateHistory) history.pushState({}, '', href);
      contentEl.classList.remove('page-leave-active', 'page-leave-from', 'page-leave-to');
      contentEl.classList.add('page-enter-active', 'page-enter-from');
      void contentEl.offsetHeight;
      contentEl.classList.remove('page-enter-from');
      contentEl.classList.add('page-enter-to');
      await new Promise(function(r) { setTimeout(r, ms); });
      contentEl.classList.remove('page-enter-active', 'page-enter-from', 'page-enter-to');
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (err) {
      console.error('[nuxt-lite] navigate error:', err);
      window.location.href = href;
    }
    navigating = false;
  }

  document.addEventListener('mouseover', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!isNuxtPage(href) || link.target === '_blank') return;
    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(function() {
      nativePrefetch(href);
    }, 100);
  }, { passive: true });

  document.addEventListener('mouseout', function(e) {
    if (e.target.closest('a[href]')) {
      clearTimeout(hoverTimeout);
    }
  }, { passive: true });

  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href[0] !== '/' || href.startsWith('/_nuxt') || href.startsWith('/__')) return;
    if (e.ctrlKey || e.metaKey || e.button !== 0) return;
    if (link.target === '_blank' || link.target === '_parent' || link.target === '_top') return;
    e.preventDefault();
    navigate(href);
  }, { passive: false });

  window.addEventListener('popstate', function() {
    navigate(window.location.pathname, false);
  });

})();
