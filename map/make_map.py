# -*- coding: utf-8 -*-
import json, math, sys, os
sys.setrecursionlimit(100000)

# Reads bretagne.geojson + loire-atlantique.geojson from this script's own folder
# and writes route.svg there. Re-run with:  python make_map.py
TMP = os.path.dirname(os.path.abspath(__file__))

# ---- projection bounds (cover Brittany + Nantes) ----
lonW, lonE = -5.18, -1.05
latS, latN = 46.98, 48.98
cosLat = math.cos(math.radians((latS + latN) / 2.0))
S = 250.0                 # px per degree latitude
ML, MT = 55.0, 48.0       # left / top margin
MR, MB = 130.0, 92.0      # right / bottom margin
PLOTW = (lonE - lonW) * S * cosLat
PLOTH = (latN - latS) * S
VBW = ML + PLOTW + MR
VBH = MT + PLOTH + MB

def px(lon): return ML + (lon - lonW) * S * cosLat
def py(lat): return MT + (latN - lat) * S

def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def polygons(geo):
    """Yield exterior rings (lists of [lon,lat]) from a Feature/FeatureCollection."""
    feats = geo.get("features", [geo]) if geo.get("type") == "FeatureCollection" else [geo]
    for ft in feats:
        g = ft["geometry"]
        if g["type"] == "Polygon":
            yield g["coordinates"][0]
        elif g["type"] == "MultiPolygon":
            for poly in g["coordinates"]:
                yield poly[0]

def project_ring(ring):
    return [(px(lo), py(la)) for lo, la in ring]

def dp(pts, eps):
    if len(pts) < 3: return pts[:]
    a, b = pts[0], pts[-1]
    dx, dy = b[0]-a[0], b[1]-a[1]
    den = math.hypot(dx, dy) or 1e-9
    dmax, idx = -1.0, 0
    for i in range(1, len(pts)-1):
        x, y = pts[i]
        d = abs((x-a[0])*dy - (y-a[1])*dx) / den
        if d > dmax: dmax, idx = d, i
    if dmax > eps:
        left = dp(pts[:idx+1], eps); right = dp(pts[idx:], eps)
        return left[:-1] + right
    return [a, b]

def dp_closed(pts, eps):
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 4:
        return pts
    a = pts[0]
    far = max(range(len(pts)), key=lambda i: (pts[i][0]-a[0])**2 + (pts[i][1]-a[1])**2)
    first = pts[:far+1]
    second = pts[far:] + [pts[0]]
    s1 = dp(first, eps)
    s2 = dp(second, eps)
    return s1[:-1] + s2[:-1]

def bbox_area(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return (max(xs)-min(xs)) * (max(ys)-min(ys))

# ---- build land paths ----
land_subpaths = []
total_in = total_out = kept = 0
for src in ("bretagne.geojson", "loire-atlantique.geojson"):
    geo = load(TMP + "\\" + src)
    for ring in polygons(geo):
        pr = project_ring(ring)
        total_in += len(pr)
        simp = dp_closed(pr, 1.1)
        if bbox_area(simp) < 26:    # drop tiny specks
            continue
        kept += 1
        total_out += len(simp)
        d = "M" + " ".join("{:.1f},{:.1f}".format(x, y) for x, y in simp) + "Z"
        land_subpaths.append(d)

land_d = " ".join(land_subpaths)

# ---- towns (lon, lat, label, anchor, dx, dy) ----
towns = [
    ("Rennes",        -1.68, 48.11, "start",  9,   4),
    ("Mont-St-Michel",-1.511,48.636,"start",  9,   4),
    ("Saint-Malo",    -2.01, 48.65, "end",   -9,   4),
    ("Perros-Guirec", -3.44, 48.81, "middle", 0, -13),
    ("Morlaix",       -3.83, 48.58, "end",   -9,  -6),
    ("Quimper",       -4.10, 47.99, "end",   -10,  4),
    ("Lorient",       -3.37, 47.75, "end",   -10,  4),
    ("Quiberon",      -3.12, 47.48, "middle", 0,  22),
    ("Vannes",        -2.76, 47.66, "start",  10,  4),
    ("Nantes",        -1.55, 47.22, "start",  11,  5),
]
P = {name: (px(lo), py(la)) for (name, lo, la, *_ ) in towns}

# route polyline (rail order)
order = ["Rennes","Mont-St-Michel","Saint-Malo","Perros-Guirec","Morlaix","Quimper","Lorient","Quiberon","Vannes","Nantes"]
route_pts = " ".join("{:.1f},{:.1f}".format(*P[n]) for n in order)

INK="#0e3a5f"; CORAL="#c75d4c"; MUST="#d99a2b"; CREAM="#f1e4c8"; SEA="#cfe1ea"; PAPER="#fbf5e6"; SLATE="#5b6573"

# day-trip / excursion markers: (label, lon, lat, parent-slide-city, anchor, dx, dy, photo-caption-match)
daytrips = [
    ("Cap Fréhel",         -2.316, 48.685, "Saint-Malo", "middle",  0, -10, "Cap Fréhel"),
    ("Pointe du Raz",      -4.732, 48.038, "Quimper",    "middle",  0, -10, "Pointe du Raz"),
    ("Pont-Aven",          -3.747, 47.851, "Quimper",    "start",   8,   5, "Pont-Aven"),
    ("Carnac",             -3.078, 47.585, "Quiberon",   "start",   7,  -4, "Carnac"),
    ("Rochefort-en-Terre", -2.340, 47.696, "Vannes",     "start",   8,   4, "Rochefort"),
]

def esc(t): return t.replace("&","&amp;")

# ---- assemble SVG ----
out = []
out.append('<svg class="map-img" viewBox="0 0 {:.0f} {:.0f}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Route map of Brittany from Rennes to Nantes">'.format(VBW, VBH))
out.append('<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{}"/></marker></defs>'.format(MUST))
# sea background
out.append('<rect x="0" y="0" width="{:.0f}" height="{:.0f}" fill="{}"/>'.format(VBW, VBH, SEA))
# faint sea hatch lines for texture
for gy in range(0, int(VBH), 26):
    out.append('<line x1="0" y1="{0}" x2="{1:.0f}" y2="{0}" stroke="#ffffff" stroke-opacity="0.14" stroke-width="1"/>'.format(gy, VBW))
# land
out.append('<path d="{}" fill="{}" stroke="#e3d3ad" stroke-width="0.8" fill-rule="nonzero"/>'.format(land_d, CREAM))
# route line (under dots)
out.append('<polyline points="{}" fill="none" stroke="{}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round" opacity="0.92"/>'.format(route_pts, CORAL))

# day-trip excursions: spur connectors, then clickable hollow markers + italic labels
for dt in daytrips:
    lbl, lo, la, parent, anchor, ddx, ddy, ph = dt
    ex, ey = px(lo), py(la); pxp, pyp = P[parent]
    out.append('<line x1="{:.1f}" y1="{:.1f}" x2="{:.1f}" y2="{:.1f}" stroke="{}" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>'.format(pxp, pyp, ex, ey, SLATE))
for dt in daytrips:
    lbl, lo, la, parent, anchor, ddx, ddy, ph = dt
    ex, ey = px(lo), py(la)
    out.append('<g class="map-pt" data-city="{}" data-photo="{}" tabindex="0" role="button" aria-label="{} (day trip) — open photos">'.format(esc(parent), esc(ph), esc(lbl)))
    out.append('<circle cx="{:.1f}" cy="{:.1f}" r="11" fill="transparent"/>'.format(ex, ey))
    out.append('<circle cx="{:.1f}" cy="{:.1f}" r="3.3" fill="{}" stroke="{}" stroke-width="1.4"/>'.format(ex, ey, PAPER, SLATE))
    out.append('<text x="{:.1f}" y="{:.1f}" text-anchor="{}" font-family="DM Sans, sans-serif" font-size="10.5" font-style="italic" fill="{}" paint-order="stroke" stroke="{}" stroke-width="2.6" stroke-linejoin="round">{}</text>'.format(ex+ddx, ey+ddy, anchor, SLATE, PAPER, esc(lbl)))
    out.append('</g>')

# inbound TGV arrow to Rennes
rx, ry = P["Rennes"]
out.append('<path d="M{:.0f},{:.0f} L{:.0f},{:.0f}" fill="none" stroke="{}" stroke-width="2.2" stroke-dasharray="6 5" marker-end="url(#ah)"/>'.format(VBW-14, 232, rx+11, ry-9, MUST))
out.append('<text x="{:.0f}" y="{:.0f}" text-anchor="end" font-family="DM Sans, sans-serif" font-size="12" fill="{}" font-style="italic">Drive from Jena</text>'.format(VBW-16, 224, MUST))
# outbound home arrow from Nantes
nx, ny = P["Nantes"]
out.append('<path d="M{:.0f},{:.0f} L{:.0f},{:.0f}" fill="none" stroke="{}" stroke-width="2.2" stroke-dasharray="6 5" marker-end="url(#ah)"/>'.format(nx+10, ny+8, nx+96, ny+58, MUST))
out.append('<text x="{:.0f}" y="{:.0f}" text-anchor="start" font-family="DM Sans, sans-serif" font-size="12" fill="{}" font-style="italic">Drive home</text>'.format(nx+58, ny+74, MUST))

# town markers — overnight (filled coral + nights), pass-through (open ring), start/finish
# (label, nights, kind) keyed by map point name; data-city = matching City-Showcase slide
TOWN_META = {
    "Rennes":        ("Rennes",             1, "start"),
    "Mont-St-Michel":("Mont-Saint-Michel",  1, "overnight"),
    "Saint-Malo":    ("Saint-Malo",         2, "overnight"),
    "Perros-Guirec": ("Pink Granite Coast", 2, "overnight"),
    "Morlaix":       ("Morlaix",            0, "pass"),
    "Quimper":       ("Quimper",            2, "overnight"),
    "Lorient":       ("Lorient",            0, "pass"),
    "Quiberon":      ("Quiberon",           2, "overnight"),
    "Vannes":        ("Vannes",             0, "pass"),
    "Nantes":        ("Nantes",             2, "finish"),
}
def label(name, txt, anchor, dx, dy, bold=False, color=INK, size=13):
    x, y = P[name]
    fw = '700' if bold else '500'
    return ('<text x="{:.1f}" y="{:.1f}" text-anchor="{}" font-family="DM Sans, sans-serif" font-size="{}" font-weight="{}" fill="{}" '
            'paint-order="stroke" stroke="{}" stroke-width="3.4" stroke-linejoin="round">{}</text>').format(x+dx, y+dy, anchor, size, fw, color, PAPER, esc(txt))

for (name, lo, la, anchor, dx, dy) in towns:
    x, y = P[name]
    city, nights, kind = TOWN_META[name]
    out.append('<g class="map-pt" data-city="{}" tabindex="0" role="button" aria-label="{} — open photos">'.format(esc(city), esc(name)))
    out.append('<circle cx="{:.1f}" cy="{:.1f}" r="14" fill="transparent"/>'.format(x, y))
    if kind in ("overnight", "start"):
        if kind == "start":
            out.append('<circle cx="{:.1f}" cy="{:.1f}" r="11.5" fill="none" stroke="{}" stroke-width="1.6"/>'.format(x, y, INK))
        out.append('<circle cx="{:.1f}" cy="{:.1f}" r="8" fill="{}" stroke="{}" stroke-width="1.6"/>'.format(x, y, CORAL, INK))
        out.append('<text x="{:.1f}" y="{:.1f}" text-anchor="middle" dominant-baseline="central" font-family="DM Sans,sans-serif" font-size="10.5" font-weight="700" fill="#fff">{}</text>'.format(x, y, nights))
    elif kind == "finish":
        out.append('<circle cx="{:.1f}" cy="{:.1f}" r="11.5" fill="none" stroke="{}" stroke-width="1.6"/>'.format(x, y, CORAL))
        out.append('<circle cx="{:.1f}" cy="{:.1f}" r="8" fill="{}" stroke="{}" stroke-width="1.6"/>'.format(x, y, CORAL, INK))
        out.append('<text x="{:.1f}" y="{:.1f}" text-anchor="middle" dominant-baseline="central" font-family="DM Sans,sans-serif" font-size="10.5" font-weight="700" fill="#fff">{}</text>'.format(x, y, nights))
    else:
        out.append('<circle cx="{:.1f}" cy="{:.1f}" r="6" fill="{}" stroke="{}" stroke-width="2"/>'.format(x, y, PAPER, CORAL))
        out.append('<circle cx="{:.1f}" cy="{:.1f}" r="1.9" fill="{}"/>'.format(x, y, CORAL))
    bold = kind in ("start", "finish", "overnight")
    lcolor = CORAL if kind == "finish" else INK
    ldx = dx + (3 if kind in ("start", "finish") else 0)
    out.append(label(name, name, anchor, ldx, dy, bold=bold, color=lcolor))
    if kind == "start":
        out.append(label(name, "START", anchor, ldx, dy + 15, bold=True, color=INK, size=10))
    elif kind == "finish":
        out.append(label(name, "FINISH", anchor, ldx, dy + 16, bold=True, color=CORAL, size=10))
    out.append('</g>')

# compass
out.append('<g transform="translate(86,84)"><line x1="0" y1="14" x2="0" y2="-14" stroke="{0}" stroke-width="1.6"/><path d="M0,-18 L4,-9 L-4,-9 Z" fill="{0}"/><text x="0" y="-22" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="11" font-weight="700" fill="{0}">N</text></g>'.format(INK))
# scale bar (~50 km)
bar = 50.0 / (111.0 * cosLat) * S * cosLat   # = 50/111*S
bx, by = 66, VBH-30
out.append('<g><line x1="{0:.0f}" y1="{1:.0f}" x2="{2:.0f}" y2="{1:.0f}" stroke="{3}" stroke-width="2"/><line x1="{0:.0f}" y1="{4:.0f}" x2="{0:.0f}" y2="{5:.0f}" stroke="{3}" stroke-width="2"/><line x1="{2:.0f}" y1="{4:.0f}" x2="{2:.0f}" y2="{5:.0f}" stroke="{3}" stroke-width="2"/><text x="{6:.0f}" y="{7:.0f}" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="10.5" fill="{3}">50 km</text></g>'.format(bx, by, bx+bar, INK, by-4, by+4, bx+bar/2, by+16))

out.append('</svg>')
svg = "".join(out)

with open(TMP + "\\route.svg", "w", encoding="utf-8") as f:
    f.write(svg)

print("land polys kept:", kept, "| ring pts in:", total_in, "-> out:", total_out)
print("viewBox: {:.0f} x {:.0f}".format(VBW, VBH))
print("svg bytes:", len(svg.encode("utf-8")))
print("town px:", {n: ("{:.0f}".format(P[n][0]), "{:.0f}".format(P[n][1])) for n in order})
