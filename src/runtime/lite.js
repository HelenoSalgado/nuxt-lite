/**
 * nuxt-lite — SPA navigation with payload-aware hydration
 *
 * Navigation:
 * - If next page shares template with current: fetch only payload JSON
 * - Replace <!--NL:N--> markers with payload content
 * - Empty payload ("") → remove marker from DOM
 * - Fallback: full HTML swap for different templates
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
  var manifest = null;
  var currentTemplate = null;

  // ===== Reactive System =====
  function reactive(obj) {
    return new Proxy(obj, {
      set: function(t, p, v) {
        var o = t[p];
        t[p] = v;
        if (o !== v) {
          var arr = subs.get(p);
          if (arr) { arr.forEach(function(fn) { fn(v, o); }); }
          var star = subs.get('*');
          if (star) { star.forEach(function(fn) { fn(v, o); }); }
        }
        return true;
      }
    });
  }

  function on(prop, fn) {
    if (!subs.has(prop)) subs.set(prop, new Set());
    subs.get(prop).add(fn);
    return function() {
      var s = subs.get(prop);
      if (s) s.delete(fn);
    };
  }

  var state = reactive({ page: location.pathname });
  window.__NUXT_LITE_STATE__ = state;
  window.__NuxtLite = { reactive: reactive, on: on };

  // ===== Helpers =====
  function normalizeHref(href) {
    return href.split('?')[0].replace(/\/index$/, '').replace(/\/+$/, '') || '/';
  }

  function isNuxtPage(href) {
    if (!href || href[0] !== '/') return false;
    if (href.startsWith('/_nuxt') || href.startsWith('/__') || href.startsWith('/_nuxt-lite')) return false;
    if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|mp4|webm|mp3|ogg|zip|gz|css|js)(\?.*)?$/i.test(href)) return false;
    return true;
  }

  async function fetchJSON(url) {
    try {
      var res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('[nuxt-lite] fetch error:', e);
      return null;
    }
  }

  async function fetchText(url) {
    try {
      var res = await fetch(url);
      if (!res.ok) return null;
      return await res.text();
    } catch (e) {
      console.error('[nuxt-lite] fetch error:', e);
      return null;
    }
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

  // ===== Marker replacement =====
  function applyPayload(payload) {
    var contentEl = document.querySelector('[data-page-content]') || document.querySelector('main');
    if (!contentEl) return false;

    // Find all NL markers in the page
    var walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_COMMENT, null, false);
    var markers = [];
    var node;
    while (node = walker.nextNode()) {
      if (node.textContent.match(/^NL:(\d+)$/)) {
        markers.push(node);
      }
    }

    // Also search outside main if needed
    walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT, null, false);
    while (node = walker.nextNode()) {
      if (node.textContent.match(/^NL:(\d+)$/)) {
        markers.push(node);
      }
    }

    // Apply payload to each marker
    var applied = 0;
    for (var i = 0; i < markers.length; i++) {
      var marker = markers[i];
      var match = marker.textContent.match(/^NL:(\d+)$/);
      if (!match) continue;

      var idx = match[1];
      var content = payload[idx] || '';

      if (content === '') {
        // Empty payload: remove marker
        marker.parentNode.removeChild(marker);
      } else {
        // Replace marker with content
        var temp = document.createElement('template');
        temp.innerHTML = content.trim();
        var fragment = temp.content;
        marker.parentNode.replaceChild(fragment, marker);
        applied++;
      }
    }

    return applied > 0;
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
    if (doc.title) document.title = doc.title;
    var nd = doc.querySelector('meta[name="description"]');
    var od = document.querySelector('meta[name="description"]');
    if (nd && nd.content && od) od.content = nd.content;
    var nc = doc.querySelector('link[rel="canonical"]');
    var oc = document.querySelector('link[rel="canonical"]');
    if (nc && nc.href && oc) oc.href = nc.href;
    var metaTags = doc.querySelectorAll('meta');
    metaTags.forEach(function(meta) {
      var name = meta.getAttribute('name');
      var property = meta.getAttribute('property');
      var content = meta.getAttribute('content');
      if (content) {
        var target;
        if (name) target = document.querySelector('meta[name="' + name + '"]');
        else if (property) target = document.querySelector('meta[property="' + property + '"]');
        if (target) target.setAttribute('content', content);
      }
    });
  }

  function getTransitionMs() {
    if (transitionMs > 0) return transitionMs;
    var el = document.querySelector('.page-enter-active, .page-leave-active');
    if (!el) { transitionMs = 400; return 400; }
    var dur = getComputedStyle(el).transitionDuration;
    if (!dur) { transitionMs = 400; return 400; }
    var ms = Number.parseFloat(dur);
    transitionMs = dur.includes('ms') ? ms : ms * 1000;
    return transitionMs;
  }

  // ===== Load manifest =====
  async function loadManifest() {
    if (manifest) return manifest;
    manifest = await fetchJSON('/_nuxt-lite/manifest.json');
    return manifest;
  }

  // ===== Navigate =====
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

      var targetRoute = normalizeHref(href);
      var tpl = await loadManifest();
      var targetInfo = tpl ? tpl[targetRoute] : null;

      if (targetInfo && currentTemplate === targetInfo.template) {
        // === MESMO TEMPLATE: fetch payload only ===
        var payloadUrl = targetRoute === '/'
          ? '/_payload.json'
          : targetRoute + '/_payload.json';
        var payload = await fetchJSON(payloadUrl);

        await new Promise(function(r) { setTimeout(r, ms); });

        if (payload) {
          applyPayload(payload);
          state.page = targetRoute;
          if (updateHistory) history.pushState({}, '', href);
        } else {
          // Fallback: full swap
          var rawHtml = await fetchText(href);
          if (!rawHtml) { window.location.href = href; navigating = false; return; }
          swapContent(rawHtml);
          updateMeta(rawHtml);
          state.page = targetRoute;
          if (updateHistory) history.pushState({}, '', href);
        }

      } else {
        // === TEMPLATE DIFERENTE: full swap ===
        var rawHtml = await fetchText(href);
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
        state.page = targetRoute;
        if (updateHistory) history.pushState({}, '', href);
      }

      contentEl.classList.remove('page-leave-active', 'page-leave-from', 'page-leave-to');
      contentEl.classList.add('page-enter-active', 'page-enter-from');
      void contentEl.offsetHeight;
      contentEl.classList.remove('page-enter-from');
      contentEl.classList.add('page-enter-to');
      await new Promise(function(r) { setTimeout(r, ms); });
      contentEl.classList.remove('page-enter-active', 'page-enter-from', 'page-enter-to');
      window.scrollTo({ top: 0, behavior: 'instant' });

      // Update current template
      if (tpl && tpl[targetRoute]) {
        currentTemplate = tpl[targetRoute].template;
      }

    } catch (err) {
      console.error('[nuxt-lite] navigate error:', err);
      window.location.href = href;
    }
    navigating = false;
  }

  // ===== Initialize: detect current template =====
  function detectCurrentTemplate() {
    // Scan for NL markers to determine template
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT, null, false);
    var node;
    var maxIdx = -1;
    while (node = walker.nextNode()) {
      var m = node.textContent.match(/^NL:(\d+)$/);
      if (m) maxIdx = Math.max(maxIdx, parseInt(m[1]));
    }
    // If we have markers, we know the template has markers
    // If not, template is unknown — will be set on first navigation
    return maxIdx >= 0 ? 'known' : 'unknown';
  }

  // Load manifest asynchronously
  loadManifest().then(function(tpl) {
    var route = normalizeHref(location.pathname);
    if (tpl && tpl[route]) {
      currentTemplate = tpl[route].template;
    }
  });

  // ===== Event listeners =====
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
