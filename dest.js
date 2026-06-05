/* ===== Destination subpage engine (shared) =====
   Reads a global DEST object and builds: header, category sections with
   item cards + photo galleries, a Leaflet map of all items, and a lightbox. */
(function () {
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function el(id) { return document.getElementById(id); }
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  var CATS = [
    { k: 'gem',   label: 'Hidden Gems',         cls: 'c-gem',   color: '#5a8a5f' },
    { k: 'do',    label: 'Things to Do',        cls: 'c-do',    color: '#0e3a5f' },
    { k: 'event', label: "Events & What's On",  cls: 'c-event', color: '#c75d4c' }
  ];
  function catOf(k) { for (var i = 0; i < CATS.length; i++) if (CATS[i].k === k) return CATS[i]; return CATS[1]; }

  // All stops, in trip order — used to build the "explore another destination" strip.
  var ALL_DESTS = [
    { name: 'Rennes',             href: 'dest-rennes.html' },
    { name: 'Saint-Malo',         href: 'dest-saint-malo.html' },
    { name: 'Pink Granite Coast', href: 'dest-pink-granite-coast.html' },
    { name: 'Morlaix',            href: 'dest-morlaix.html' },
    { name: 'Brest',              href: 'dest-brest.html' },
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

  ready(function () {
    var D = window.DEST;
    if (!D) return;
    document.title = D.name + ' · 13 Days in Brittany';
    setText('dz-name', D.name);
    setText('dz-eyebrow', D.eyebrow || '');
    setText('dz-sub', D.tagline || '');
    if (el('dz-intro') && D.intro) el('dz-intro').innerHTML = D.intro;
    if (el('dz-back')) el('dz-back').setAttribute('href', D.backHref || 'brittany-overview.html');
    if (el('dz-foot-name')) el('dz-foot-name').textContent = D.name;

    D.items.forEach(function (it, i) { it._n = i + 1; });

    // ---- build category sections + cards ----
    var host = el('dz-items');
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
        var gal = it.photos.slice(0, 3).map(function (p, pi) {
          return '<figure class="dz-ph" data-n="' + it._n + '" data-p="' + pi + '">' +
            '<img loading="lazy" decoding="async" src="' + p.src + '" alt="' + esc(it.name) + '">' +
            '<figcaption>' + esc(p.cap) + '</figcaption></figure>';
        }).join('');
        art.innerHTML =
          '<div class="dz-gal">' + gal + '</div>' +
          '<div class="dz-txt">' +
            '<div class="dz-tagrow"><span class="dz-num">' + it._n + '</span><span class="dz-tag">' + cat.label + '</span></div>' +
            '<h3>' + esc(it.name) + '</h3>' +
            (it.note ? '<div class="dz-note">' + esc(it.note) + '</div>' : '') +
            '<p>' + it.desc + '</p>' +
            (it.meta ? '<div class="dz-meta">' + it.meta + '</div>' : '') +
          '</div>';
        sec.appendChild(art);
      });
      host.appendChild(sec);
    });

    setupLightbox(D);
    if (window.L && el('dz-map')) setupMap(D);
    buildNav(D);
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
        '<button type="button" onclick="window.__dzGo(' + it._n + ')">View photos &rsaquo;</button></div>'
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
