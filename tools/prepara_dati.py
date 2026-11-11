#!/usr/bin/env python3
"""
Prepara i dati reali della Lessinia per il dispositivo.

Legge i GeoJSON dell'Atlante della Lessinia (OpenStreetMap, ISTAT, TINITALY) e
scrive data/lessinia.js: una griglia a matrice (classe di copertura per cella,
come nella "tavola a matrice" dell'atlante) più i vettori ritagliati sulla
finestra scelta (strade, sentieri, acque, isoipse, malghe, paesi, conflitti
documentati).

Uso:
    python3 tools/prepara_dati.py [cartella dati atlante]

Default: ../Atlante-Lessinia/app/data rispetto alla cartella del progetto.
Nessuna dipendenza esterna. Il file prodotto è un normale script JS, così la
pagina si apre anche con doppio clic (niente fetch da file://).
"""
import json
import math
import os
import sys

# ------------------------------------------------------------------ finestra
# Alta Lessinia centrale: Erbezzo, Bosco Chiesanuova, San Giorgio, le malghe
# di Podestaria, Scortigara, Lago Boaro, Campolevà, Pealda, Boldera.
W, S, E, N = 10.94, 45.615, 11.12, 45.722
CELLA_M = 120

LAT0 = math.radians((S + N) / 2)
MX = math.cos(LAT0) * 111320.0
MY = 110574.0
LARG_M = (E - W) * MX
ALT_M = (N - S) * MY
NX = math.ceil(LARG_M / CELLA_M)
NY = math.ceil(ALT_M / CELLA_M)


def g(lon, lat):
    """lon/lat -> coordinate di griglia (unità = celle, origine angolo NO)"""
    return ((lon - W) * MX / CELLA_M, (N - lat) * MY / CELLA_M)


# classi della matrice (stesse dell'atlante)
VUOTO, BOSCO, PRATERIA, ARBUSTO, ROCCIA, ABITATO, ACQUA = range(7)
CLASSE_APERTA = {
    'prateria / prato-pascolo': PRATERIA,
    'arbusteto / brughiera': ARBUSTO,
    'roccia / ghiaione': ROCCIA,
    'abitato': ABITATO,
    'cava': ABITATO,
}
PRIORITA = [PRATERIA, ARBUSTO, ROCCIA, BOSCO, ABITATO, ACQUA]  # l'ultima vince


def carica(cartella, nome):
    with open(os.path.join(cartella, nome), encoding='utf-8') as f:
        return json.load(f)


def poligoni(geom):
    if not geom:
        return []
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    if geom['type'] == 'MultiPolygon':
        return geom['coordinates']
    return []


def linee(geom):
    if not geom:
        return []
    t = geom['type']
    if t == 'LineString':
        return [geom['coordinates']]
    if t == 'MultiLineString':
        return geom['coordinates']
    if t == 'Polygon':
        return geom['coordinates']
    if t == 'MultiPolygon':
        return [r for p in geom['coordinates'] for r in p]
    return []


# ------------------------------------------------------------------ rasterizzazione
# scanline con sovracampionamento 2x2: una cella prende la classe se almeno
# 2 campioni su 4 cadono nel poligono (copertura ~ metà cella, come l'atlante)
SX, SY = NX * 2, NY * 2


def riempi(campioni, poly):
    rings = [[g(c[0], c[1]) for c in r] for r in poly]
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    if max(xs) < 0 or min(xs) > NX or max(ys) < 0 or min(ys) > NY:
        return
    edges = []
    for r in rings:
        for k in range(len(r) - 1):
            (x0, y0), (x1, y1) = r[k], r[k + 1]
            if y0 != y1:
                edges.append((x0, y0, x1, y1))
    s0 = max(0, int(math.floor(min(ys) * 2 - 0.5)))
    s1 = min(SY - 1, int(math.ceil(max(ys) * 2 - 0.5)))
    for s in range(s0, s1 + 1):
        yc = (s + 0.5) / 2
        cross = []
        for x0, y0, x1, y1 in edges:
            if (y0 <= yc < y1) or (y1 <= yc < y0):
                cross.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
        cross.sort()
        row = s * SX
        for k in range(0, len(cross) - 1, 2):
            a = max(0, int(math.ceil(cross[k] * 2 - 0.5)))
            b = min(SX - 1, int(math.floor(cross[k + 1] * 2 - 0.5)))
            for t in range(a, b + 1):
                campioni[row + t] = 1


def griglia(cartella):
    boschi = carica(cartella, 'osm_boschi.geojson')['features']
    aperta = carica(cartella, 'osm_copertura_aperta.geojson')['features']
    acque = carica(cartella, 'osm_idrografia_aree.geojson')['features']
    per_classe = {k: [] for k in PRIORITA}
    for f in boschi:
        per_classe[BOSCO] += poligoni(f['geometry'])
    for f in aperta:
        k = CLASSE_APERTA.get(f['properties'].get('classe'))
        if k is not None:
            per_classe[k] += poligoni(f['geometry'])
    for f in acque:
        per_classe[ACQUA] += poligoni(f['geometry'])

    cls = bytearray(NX * NY)
    for k in PRIORITA:
        camp = bytearray(SX * SY)
        for p in per_classe[k]:
            riempi(camp, p)
        for j in range(NY):
            for i in range(NX):
                n = (camp[(2 * j) * SX + 2 * i] + camp[(2 * j) * SX + 2 * i + 1]
                     + camp[(2 * j + 1) * SX + 2 * i] + camp[(2 * j + 1) * SX + 2 * i + 1])
                if n >= 2:
                    cls[j * NX + i] = k
    return ''.join(str(c) for c in cls)


# ------------------------------------------------------------------ vettori
def dentro(p, m=1.0):
    return -m <= p[0] <= NX + m and -m <= p[1] <= NY + m


def rdp(pts, tol):
    if len(pts) < 3:
        return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy) or 1e-9
    dmax, imax = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + x1 * y0 - y1 * x0) / L
        if d > dmax:
            dmax, imax = d, i
    if dmax > tol:
        return rdp(pts[:imax + 1], tol)[:-1] + rdp(pts[imax:], tol)
    return [pts[0], pts[-1]]


def ritaglia(coords, tol):
    """spezza la linea nei tratti dentro la finestra (con un punto di margine)"""
    pts = [g(c[0], c[1]) for c in coords]
    out, cur = [], []
    for k, p in enumerate(pts):
        if dentro(p):
            if not cur and k > 0:
                cur.append(pts[k - 1])
            cur.append(p)
        elif cur:
            cur.append(p)
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    res = []
    for c in out:
        c = rdp(c, tol)
        if len(c) >= 2:
            res.append([round(v, 2) for p in c for v in p])
    return res


def punto(geom):
    if geom and geom['type'] == 'Point':
        x, y = g(*geom['coordinates'][:2])
        if 0 <= x <= NX and 0 <= y <= NY:
            return round(x, 2), round(y, 2)
    return None


def main():
    qui = os.path.dirname(os.path.abspath(__file__))
    progetto = os.path.dirname(qui)
    cartella = sys.argv[1] if len(sys.argv) > 1 else os.path.join(progetto, '..', 'Atlante-Lessinia', 'app', 'data')
    cartella = os.path.abspath(cartella)
    print('dati:', cartella)
    print('griglia: %d x %d celle da %d m (%.1f x %.1f km)' % (NX, NY, CELLA_M, LARG_M / 1000, ALT_M / 1000))

    out = {
        'meta': {
            'bbox': [W, S, E, N], 'cella_m': CELLA_M, 'nx': NX, 'ny': NY,
            'attribuzioni': '© OpenStreetMap contributors (ODbL) · Curve di livello da TINITALY 1.1, INGV (CC BY 4.0) · '
                            'Predazioni per malga: Tabarelli de Fatis 2025, MUSE–PAT 2023 (via Atlante della Lessinia)'
        }
    }
    out['classi'] = griglia(cartella)

    # strade (rango: 1 secondaria, 2 terziaria, 3 locale / non classificata)
    rango = {'motorway': 1, 'trunk': 1, 'primary': 1, 'secondary': 1, 'tertiary': 2, 'unclassified': 3}
    strade = []
    for f in carica(cartella, 'osm_viabilita.geojson')['features']:
        r = rango.get(f['properties'].get('tipo'))
        if not r:
            continue
        for l in linee(f['geometry']):
            for seg in ritaglia(l, 0.12):
                strade.append({'r': r, 'p': seg})
    out['strade'] = strade

    sentieri = []
    for f in carica(cartella, 'osm_sentieri.geojson')['features']:
        for l in linee(f['geometry']):
            sentieri += ritaglia(l, 0.2)
    out['sentieri'] = sentieri

    acque = []
    for f in carica(cartella, 'osm_idrografia_linee.geojson')['features']:
        p = f['properties']
        if p.get('tipo') not in ('river', 'stream'):
            continue
        for l in linee(f['geometry']):
            for seg in ritaglia(l, 0.15):
                acque.append({'n': 1 if p.get('nome') else 0, 'p': seg})
    out['acque'] = acque

    iso = []
    for f in carica(cartella, 'dem_curve_livello_50m.geojson')['features']:
        q = f['properties'].get('quota')
        for l in linee(f['geometry']):
            for seg in ritaglia(l, 0.25):
                iso.append({'q': q, 'm': 1 if f['properties'].get('direttrice') else 0, 'p': seg})
    out['isoipse'] = iso

    malghe = []
    for f in carica(cartella, 'osm_malghe.geojson')['features']:
        p = punto(f['geometry'])
        if p and f['properties'].get('tipo_oggetto') == 'edificio':
            malghe.append({'x': p[0], 'y': p[1], 'nome': f['properties'].get('nome'), 'quota': f['properties'].get('quota_m')})
    out['malghe'] = malghe

    conflitti = []
    for f in carica(cartella, 'tema_conflitti_malghe.geojson')['features']:
        p = punto(f['geometry'])
        if p:
            q = f['properties']
            conflitti.append({'x': p[0], 'y': p[1], 'nome': q.get('nome'), 'comune': q.get('comune'),
                              'eventi': q.get('eventi_tot'), 'periodo': q.get('periodo'), 'precisione': q.get('precisione')})
    out['conflittiDocumentati'] = conflitti

    luoghi = []
    for f in carica(cartella, 'osm_toponimi_punti.geojson')['features']:
        q = f['properties']
        if q.get('place') not in ('town', 'village', 'hamlet'):
            continue
        p = punto(f['geometry'])
        if p and q.get('name'):
            luoghi.append({'x': p[0], 'y': p[1], 'nome': q['name'], 'tipo': q['place']})
    out['luoghi'] = luoghi

    dest = os.path.join(progetto, 'data', 'lessinia.js')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'w', encoding='utf-8') as f:
        f.write('/* Generato da tools/prepara_dati.py — non modificare a mano. */\n')
        f.write('window.DN = window.DN || {};\nDN.datiLessinia = ')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    conta = {k: len(v) for k, v in out.items() if isinstance(v, list)}
    print('scritto', dest, '(%d KB)' % (os.path.getsize(dest) // 1024), conta)
    from collections import Counter
    print('classi:', sorted(Counter(out['classi']).items()))


if __name__ == '__main__':
    main()
