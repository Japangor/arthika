/**
 * Arthika page-slots loader — ported from the proven Rail24 monetisation kit.
 *
 * Uses the GJam AdSense account (ca-pub-3483870164836220) with the Rail24
 * ad units (display slot 4698617583, multiplex 5000477595).
 *
 * - Single deduped AdSense script tag.
 * - Page-level Auto Ads (Anchor + Vignette + Side-rail) enabled once per load.
 * - Lazy-fills each `.mkt-slot` when it nears the viewport.
 * - MutationObserver catches slots injected by the SPA router (app.js) and
 *   the history.pushState hook refills in-view slots on every tab/route change
 *   so each SPA view = fresh, compliant impressions.
 * - Skips entirely when ad-free (localStorage `arthika_adfree`).
 *
 * Neutral filename + class names ("mkt-slot") so ad-blocker cosmetic/network
 * filters don't strip our first-party slot-creation logic.
 */
(function () {
  'use strict';

  var ADSENSE_CLIENT = 'ca-pub-3483870164836220';
  var DEFAULT_SLOT = '4698617583';
  var SCRIPT_SRC =
    'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
    ADSENSE_CLIENT;
  var loaderInjected = false;
  var autoAdsPushed = false;
  var observer = null;

  function isAdFree() {
    if (document.documentElement.classList.contains('ad-free')) return true;
    if (document.body && document.body.classList.contains('ad-free')) return true;
    try {
      if (localStorage.getItem('arthika_adfree')) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function enableAutoAds() {
    if (autoAdsPushed) return;
    autoAdsPushed = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({
        google_ad_client: ADSENSE_CLIENT,
        enable_page_level_ads: true,
        overlays: { bottom: true },
        tag_partner: 'arthika_markets',
      });
    } catch (e) {
      autoAdsPushed = false;
    }
  }

  function injectLoader() {
    if (loaderInjected) return;
    loaderInjected = true;
    var existing = document.querySelectorAll('script[src*="adsbygoogle.js"]');
    for (var i = 1; i < existing.length; i++) {
      existing[i].parentNode && existing[i].parentNode.removeChild(existing[i]);
    }
    if (existing.length === 0) {
      var s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = SCRIPT_SRC;
      s.onload = enableAutoAds;
      document.head.appendChild(s);
    } else {
      enableAutoAds();
    }
  }

  function fillSlot(container) {
    if (container.__adFilled) return;
    // Don't fill a zero-width / hidden slot — AdSense can't size it and the
    // impression is burned. It'll be filled once visible.
    if (!container.offsetWidth || !container.offsetParent) return;
    container.__adFilled = true;

    var slot = container.getAttribute('data-ad-slot') || DEFAULT_SLOT;
    var format = container.getAttribute('data-ad-format') || 'auto';
    var responsive = container.getAttribute('data-full-width-responsive');
    var layout = container.getAttribute('data-ad-layout');
    var layoutKey = container.getAttribute('data-ad-layout-key');

    container.innerHTML = '';
    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', ADSENSE_CLIENT);
    ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', format);
    if (layout) ins.setAttribute('data-ad-layout', layout);
    if (layoutKey) ins.setAttribute('data-ad-layout-key', layoutKey);
    if (format !== 'autorelaxed' && format !== 'fluid') {
      ins.setAttribute('data-full-width-responsive', responsive || 'true');
    }
    container.appendChild(ins);

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      container.__adFilled = false;
    }
  }

  function observeSlot(slot) {
    if (slot.__adObserved) return;
    slot.__adObserved = true;
    if (observer) observer.observe(slot);
    else fillSlot(slot);
  }

  function observeAllSlots() {
    var slots = document.querySelectorAll('.mkt-slot');
    for (var i = 0; i < slots.length; i++) observeSlot(slots[i]);
  }

  function activateAdsIn(container) {
    if (isAdFree()) return;
    var scope = container && container.querySelectorAll ? container : document;
    var slots = scope.querySelectorAll('.mkt-slot');
    for (var i = 0; i < slots.length; i++) {
      if (!slots[i].__adFilled) fillSlot(slots[i]);
    }
  }

  function onSpaNavigation() {
    if (isAdFree()) return;
    setTimeout(observeAllSlots, 120);
  }

  function init() {
    if (isAdFree()) return;
    injectLoader();
    enableAutoAds();

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (isAdFree()) { observer.unobserve(entry.target); return; }
            fillSlot(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '800px 0px' });
    }

    observeAllSlots();

    if ('MutationObserver' in window) {
      var mo = new MutationObserver(function () { observeAllSlots(); });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    var origPush = history.pushState;
    history.pushState = function () {
      var ret = origPush.apply(this, arguments);
      onSpaNavigation();
      return ret;
    };
    window.addEventListener('popstate', onSpaNavigation);
  }

  window.ArthikaAds = {
    init: init,
    activateAdsIn: activateAdsIn,
    refreshAdFreeState: function () {
      if (isAdFree()) {
        document.querySelectorAll('.mkt-slot').forEach(function (el) { el.innerHTML = ''; });
      }
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
