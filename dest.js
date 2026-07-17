/* ===== Destination subpage engine (shared) =====
   Reads a global DEST object and builds: header, category sections with
   item cards + photo galleries, a Leaflet map of all items, and a lightbox. */
(function () {
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function el(id) { return document.getElementById(id); }
  function mapsHref(c) { return c ? 'https://www.google.com/maps/dir//' + c[0] + ',' + c[1] : ''; }
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  var CATS = [
    { k: 'gem',   label: 'Hidden Gems',         cls: 'c-gem',   color: '#5a8a5f' },
    { k: 'do',    label: 'Things to Do',        cls: 'c-do',    color: '#0e3a5f' },
    { k: 'event', label: "Events & What's On",  cls: 'c-event', color: '#c75d4c' }
  ];
  function catOf(k) { for (var i = 0; i < CATS.length; i++) if (CATS[i].k === k) return CATS[i]; return CATS[1]; }

  // Free vs. "needs booking & money": an item is free unless it needs a ticket, fare,
  // tour or booking. Auto-derived from the price in `meta` ("Free …" -> free, otherwise
  // paid). An explicit `cost: 'free'|'paid'` on an item overrides the guess — used for the
  // few free sights/markets whose meta leads with an optional cost (a snack, a parking fee).
  function costOf(it) { return it.cost || (/\bfree\b/i.test(it.meta || '') ? 'free' : 'paid'); }

  // All stops, in trip order — used to build the "explore another destination" strip.
  var ALL_DESTS = [
    { name: 'Rennes',             href: 'dest-rennes.html' },
    { name: 'Mont-Saint-Michel', href: 'dest-mont-saint-michel.html' },
    { name: 'Saint-Malo',         href: 'dest-saint-malo.html' },
    { name: 'Pink Granite Coast', href: 'dest-pink-granite-coast.html' },
    { name: 'Morlaix',            href: 'dest-morlaix.html' },
    { name: 'Quimper',            href: 'dest-quimper.html' },
    { name: 'Lorient',            href: 'dest-lorient.html' },
    { name: 'Quiberon',           href: 'dest-quiberon.html' },
    { name: 'Vannes',             href: 'dest-vannes.html' },
    { name: 'Nantes',             href: 'dest-nantes.html' }
  ];
  function buildNav(D) {
    var foot = document.querySelector('.dz-foot');
    if (!foot) return;
    var back = (D.backHref || 'brittany-overview.html') + '#destinations';
    var chips = ALL_DESTS.map(function (d) {
      return d.name === D.name
        ? '<span class="dz-chip cur" aria-current="page">' + esc(d.name) + '</span>'
        : '<a class="dz-chip" href="' + d.href + '">' + esc(d.name) + '</a>';
    }).join('');
    var nav = document.createElement('nav');
    nav.className = 'dz-nav';
    nav.setAttribute('aria-label', 'All destinations');
    nav.innerHTML =
      '<div class="dz-nav-top">' +
        '<div class="dz-nav-label">Explore another destination</div>' +
        '<a class="dz-nav-all" href="' + back + '">&lsaquo;&nbsp; All destinations</a>' +
      '</div>' +
      '<div class="dz-chips">' + chips + '</div>';
    foot.parentNode.insertBefore(nav, foot);
  }

  // Optional "From a local" tips panel — rendered only if the page provides D.local.
  function buildLocal(D) {
    if (!D.local) return;
    var host = el('dz-items');
    if (!host) return;
    var L = D.local;
    var groups = (L.groups || []).map(function (g) {
      var lis = (g.items || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
      return '<div class="dz-local-group"><h3>' + esc(g.h) + '</h3><ul>' + lis + '</ul></div>';
    }).join('');
    var sec = document.createElement('section');
    sec.className = 'dz-local';
    sec.innerHTML =
      '<div class="dz-local-head"><span class="dz-local-badge">Local tip</span><h2>' + esc(L.title || 'From a local') + '</h2></div>' +
      (L.intro ? '<p class="dz-local-intro">' + esc(L.intro) + '</p>' : '') +
      '<div class="dz-local-grid">' + groups + '</div>';
    host.insertAdjacentElement('afterend', sec);
  }

  // Optional "Where to eat" callout — rendered only if the page provides D.food.
  function buildFood(D) {
    if (!D.food || !D.food.length) return;
    var host = el('dz-items');
    if (!host) return;
    function navHref(q) { return 'https://www.google.com/maps/dir//' + encodeURIComponent(String(q).trim()).replace(/%20/g, '+').replace(/%2C/g, ','); }
    var lis = D.food.map(function (f) {
      var go = f.nav ? '<a class="dz-food-go" href="' + navHref(f.nav) + '" target="_blank" rel="noopener">Directions &nearr;</a>' : '';
      return '<li><span class="dz-food-main"><b>' + esc(f.name) + '</b>' + (f.blurb ? ' — ' + esc(f.blurb) : '') + '</span>' +
        (f.meta ? '<span class="dz-food-meta">' + esc(f.meta) + '</span>' : '') + go + '</li>';
    }).join('');
    var sec = document.createElement('section');
    sec.className = 'dz-food';
    sec.innerHTML = '<div class="dz-food-head"><span class="dz-food-badge">Where to eat</span></div><ul>' + lis + '</ul>';
    var localSec = document.querySelector('.dz-local');
    (localSec || host).insertAdjacentElement('afterend', sec);
  }

  ready(function () {
    var D = window.DEST;
    if (!D) return;
    document.title = D.name + ' · 13 Days in Brittany';
    setText('dz-name', D.name);
    setText('dz-eyebrow', D.eyebrow || '');
    setText('dz-sub', D.tagline || '');
    if (el('dz-sub') && D.center) el('dz-sub').insertAdjacentHTML('afterend', '<a class="dz-go dz-go-stop" href="' + mapsHref(D.center) + '" target="_blank" rel="noopener">Navigate to ' + esc(D.name) + ' &nearr;</a>');
    if (el('dz-intro') && D.intro) el('dz-intro').innerHTML = D.intro;
    if (el('dz-back')) el('dz-back').setAttribute('href', D.backHref || 'brittany-overview.html');
    if (el('dz-foot-name')) el('dz-foot-name').textContent = D.name;

    D.items.forEach(function (it, i) { it._n = i + 1; });

    // ---- free / "needs booking & money" filter bar ----
    var host = el('dz-items');
    var nFree = D.items.filter(function (it) { return costOf(it) === 'free'; }).length;
    var nPaid = D.items.length - nFree;
    var bar = document.createElement('div');
    bar.className = 'dz-filter';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Filter what-to-do by cost');
    bar.innerHTML =
      '<span class="dz-filter-lbl">Show</span>' +
      '<button type="button" class="dz-fbtn is-on" data-f="all">Everything <b>' + D.items.length + '</b></button>' +
      '<button type="button" class="dz-fbtn" data-f="free">Free <b>' + nFree + '</b></button>' +
      '<button type="button" class="dz-fbtn" data-f="paid">Needs booking &amp; &euro; <b>' + nPaid + '</b></button>';
    host.appendChild(bar);

    // ---- build category sections + cards ----
    CATS.forEach(function (cat) {
      var list = D.items.filter(function (it) { return it.cat === cat.k; });
      if (!list.length) return;
      var sec = document.createElement('section');
      sec.className = 'dz-cat ' + cat.cls;
      var h = document.createElement('h2'); h.className = 'dz-cat-h'; h.textContent = cat.label;
      sec.appendChild(h);
      list.forEach(function (it) {
        var art = document.createElement('article');
        art.className = 'dz-item ' + cat.cls;
        art.id = 'item-' + it._n;
        var cost = costOf(it);
        art.setAttribute('data-cost', cost);
        var gal = it.photos.slice(0, 3).map(function (p, pi) {
          return '<figure class="dz-ph" data-n="' + it._n + '" data-p="' + pi + '">' +
            '<img loading="lazy" decoding="async" src="' + p.src + '" alt="' + esc(it.name) + '">' +
            '<figcaption>' + esc(p.cap) + '</figcaption></figure>';
        }).join('');
        art.innerHTML =
          '<div class="dz-gal">' + gal + '</div>' +
          '<div class="dz-txt">' +
            '<div class="dz-tagrow"><span class="dz-num">' + it._n + '</span><span class="dz-tag">' + cat.label + '</span>' +
              '<span class="dz-cost ' + (cost === 'free' ? 'is-free' : 'is-paid') + '">' + (cost === 'free' ? 'Free' : '&euro; Pay &amp; book') + '</span></div>' +
            '<h3>' + esc(it.name) + '</h3>' +
            (it.note ? '<div class="dz-note">' + esc(it.note) + '</div>' : '') +
            '<p>' + it.desc + '</p>' +
            (it.meta ? '<div class="dz-meta">' + it.meta + '</div>' : '') +
            (it.coords ? '<a class="dz-go" href="' + mapsHref(it.coords) + '" target="_blank" rel="noopener">Navigate &nearr;</a>' : '') +
          '</div>';
        sec.appendChild(art);
      });
      host.appendChild(sec);
    });

    // ---- wire the free/paid filter ----
    function applyFilter(f) {
      host.querySelectorAll('.dz-item').forEach(function (a) {
        a.style.display = (f === 'all' || a.getAttribute('data-cost') === f) ? '' : 'none';
      });
      host.querySelectorAll('.dz-cat').forEach(function (sec) {
        var vis = 0;
        sec.querySelectorAll('.dz-item').forEach(function (a) { if (a.style.display !== 'none') vis++; });
        sec.style.display = vis ? '' : 'none';
      });
      bar.querySelectorAll('.dz-fbtn').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-f') === f); });
    }
    bar.querySelectorAll('.dz-fbtn').forEach(function (b) {
      b.addEventListener('click', function () { applyFilter(b.getAttribute('data-f')); });
    });

    setupLightbox(D);
    if (window.L && el('dz-map')) setupMap(D);
    buildNav(D);
    buildLocal(D);
    buildFood(D);
  });

  function setText(id, t) { var e = el(id); if (e) e.textContent = t; }

  /* ---------- Lightbox ---------- */
  var lb, lbImg, lbCap, lbCount, lbPrev, lbNext, list = [], idx = 0, title = '';
  function setupLightbox(D) {
    lb = document.createElement('div'); lb.className = 'dz-lb'; lb.hidden = true;
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
    lb.innerHTML =
      '<button class="dz-lb-x" aria-label="Close">&times;</button>' +
      '<button class="dz-lb-nav dz-lb-prev" aria-label="Previous">&lsaquo;</button>' +
      '<img alt=""><div class="dz-lb-cap"></div><div class="dz-lb-count"></div>' +
      '<button class="dz-lb-nav dz-lb-next" aria-label="Next">&rsaquo;</button>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector('img'); lbCap = lb.querySelector('.dz-lb-cap');
    lbCount = lb.querySelector('.dz-lb-count'); lbPrev = lb.querySelector('.dz-lb-prev'); lbNext = lb.querySelector('.dz-lb-next');
    lb.querySelector('.dz-lb-x').addEventListener('click', closeLb);
    lbPrev.addEventListener('click', function (e) { e.stopPropagation(); move(-1); });
    lbNext.addEventListener('click', function (e) { e.stopPropagation(); move(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb();
      else if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
    });
    // open from any gallery figure
    document.querySelectorAll('.dz-ph').forEach(function (ph) {
      ph.addEventListener('click', function () {
        openItem(+ph.getAttribute('data-n'), +ph.getAttribute('data-p'));
      });
    });
    window.__dzOpen = function (n, p) { openItem(n, p || 0); };
  }
  function openItem(n, p) {
    var it = window.DEST.items[n - 1]; if (!it) return;
    title = it.name;
    list = it.photos.slice(0, 3);
    idx = Math.max(0, Math.min(p, list.length - 1));
    show(); lb.hidden = false;
  }
  function show() {
    var it = list[idx];
    lbImg.src = it.src; lbImg.alt = title;
    lbCap.innerHTML = '<b>' + escAttr(title) + '</b>' + (it.cap ? ' · ' + escAttr(it.cap) : '');
    var single = list.length <= 1;
    lbCount.textContent = single ? '' : (idx + 1) + ' / ' + list.length;
    lbPrev.style.display = single ? 'none' : ''; lbNext.style.display = single ? 'none' : '';
  }
  function escAttr(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function move(d) { idx = (idx + d + list.length) % list.length; show(); }
  function closeLb() { lb.hidden = true; lbImg.src = ''; }

  /* ---------- Map (Leaflet) ---------- */
  function setupMap(D) {
    var map = L.map('dz-map', { scrollWheelZoom: false, attributionControl: true })
      .setView(D.center || [48, -3], D.zoom || 12);
    // zoomable: +/- buttons, double-click and pinch always work; scroll-zoom activates
    // once you click/enter the map, and releases when you leave so the page scrolls freely.
    var mapEl = document.getElementById('dz-map');
    map.on('click focus', function () { map.scrollWheelZoom.enable(); });
    mapEl.addEventListener('mouseleave', function () { map.scrollWheelZoom.disable(); });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    var bounds = [];
    D.items.forEach(function (it) {
      if (!it.coords) return;
      var cat = catOf(it.cat);
      var icon = L.divIcon({
        className: '', html: '<div class="dz-pin" style="background:' + cat.color + '">' + it._n + '</div>',
        iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -14]
      });
      var m = L.marker(it.coords, { icon: icon, title: it.name }).addTo(map);
      m.bindPopup(
        '<div class="dz-pop"><b>' + esc(it.name) + '</b>' +
        '<div class="pc" style="color:' + cat.color + '">' + cat.label + '</div>' +
        '<button type="button" onclick="window.__dzGo(' + it._n + ')">View photos &rsaquo;</button>' +
        '<a class="dz-pop-go" href="' + mapsHref(it.coords) + '" target="_blank" rel="noopener">Directions &nearr;</a></div>'
      );
      bounds.push(it.coords);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    setTimeout(function () { map.invalidateSize(); }, 200);

    window.__dzGo = function (n) {
      var card = el('item-' + n);
      if (card) { card.scrollIntoView({ block: 'center' }); card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash'); }
      window.__dzOpen(n, 0);
    };
  }
})();
