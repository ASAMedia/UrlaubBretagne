# 13 Days in Brittany · Erfurt → Nantes

A self-contained, illustrated travel-planning site for a four-person road/rail trip
through Brittany (19–31 July 2026), finishing in Nantes.

## Contents

- **`brittany-overview.html`** — the main page: the route map, a day-by-day plan,
  a cost breakdown, a train-vs-car comparison, packing notes, a city showcase, and an
  "Explore Each Destination" index. (`index.html` simply redirects here.)
- **`dest-*.html`** — one subpage per stop (10 in all): hidden gems, things to do,
  events to time, three-photo galleries, and a zoomable map of each town. They share a
  single engine — **`dest.css`** + **`dest.js`** — so each page holds only a
  `window.DEST` data object.
- **`map/`** — the inline route-map generator (`make_map.py`) and its GeoJSON sources.

## Notes

Photographs are hotlinked from Wikimedia Commons. Typeset in Fraunces + DM Sans;
maps use Leaflet with CartoDB Positron tiles. Everything is static — just open
`brittany-overview.html` (or the published page) in a browser.
