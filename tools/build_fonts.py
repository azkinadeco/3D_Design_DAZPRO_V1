"""
Konversi font TTF/OTF menjadi data glyph JSON ringan untuk konfigurator 3D.

Output: fonts/<id>.json  ->  { id, name, upm, asc, desc, glyphs: { "A": [advance, "path"] }, kern: { "AV": -80 } }
Path memakai koordinat font asli (sumbu Y ke atas) dengan perintah M/L/Q/C/Z.

Pakai:  python3 tools/build_fonts.py
Tambah font baru: tambahkan entri di FONTS lalu jalankan ulang.
"""
import json, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

CANVAS = "/mnt/skills/examples/canvas-design/canvas-fonts"
GF = "/usr/share/fonts/truetype/google-fonts"
TEX = "/usr/share/texmf/fonts/opentype/public/tex-gyre"

# id, nama tampilan, kategori, file
FONTS = [
    ("poppins",    "Poppins Bold",        "Modern",    f"{GF}/Poppins-Bold.ttf"),
    ("outfit",     "Outfit Bold",         "Modern",    f"{CANVAS}/Outfit-Bold.ttf"),
    ("worksans",   "Work Sans Bold",      "Modern",    f"{CANVAS}/WorkSans-Bold.ttf"),
    ("bricolage",  "Bricolage Grotesque", "Modern",    f"{CANVAS}/BricolageGrotesque-Bold.ttf"),
    ("bigshoulders","Big Shoulders",      "Kondensasi",f"{CANVAS}/BigShoulders-Bold.ttf"),
    ("boldonse",   "Boldonse",            "Display",   f"{CANVAS}/Boldonse-Regular.ttf"),
    ("ericaone",   "Erica One",           "Display",   f"{CANVAS}/EricaOne-Regular.ttf"),
    ("tektur",     "Tektur",              "Teknologi", f"{CANVAS}/Tektur-Medium.ttf"),
    ("lora",       "Lora Bold",           "Serif",     f"{CANVAS}/Lora-Bold.ttf"),
    ("youngserif", "Young Serif",         "Serif",     f"{CANVAS}/YoungSerif-Regular.ttf"),
    ("gloock",     "Gloock",              "Serif",     f"{CANVAS}/Gloock-Regular.ttf"),
    ("italiana",   "Italiana",            "Elegan",    f"{CANVAS}/Italiana-Regular.ttf"),
    ("poiret",     "Poiret One",          "Elegan",    f"{CANVAS}/PoiretOne-Regular.ttf"),
    ("chorus",     "Chorus Script",       "Script",    f"{TEX}/texgyrechorus-mediumitalic.otf"),
    ("handwrite",  "Nothing You Could Do","Script",    f"{CANVAS}/NothingYouCouldDo-Regular.ttf"),
]

CHARS = [chr(c) for c in range(32, 127)] + list("©®°•–—‘’“”éèáàíóúñçÉÁ")


class PathPen(BasePen):
    def __init__(self, glyphSet):
        super().__init__(glyphSet)
        self.d = []
    def r(self, v):
        return str(int(round(v)))
    def _moveTo(self, p):
        self.d.append("M" + self.r(p[0]) + " " + self.r(p[1]))
    def _lineTo(self, p):
        self.d.append("L" + self.r(p[0]) + " " + self.r(p[1]))
    def _qCurveToOne(self, p1, p2):
        self.d.append("Q" + " ".join(self.r(v) for v in (*p1, *p2)))
    def _curveToOne(self, p1, p2, p3):
        self.d.append("C" + " ".join(self.r(v) for v in (*p1, *p2, *p3)))
    def _closePath(self):
        self.d.append("Z")
    def _endPath(self):
        self.d.append("Z")


def kern_pairs(font, cmap_rev, wanted):
    """Ambil pasangan kerning sederhana dari tabel 'kern' (format 0) atau GPOS PairPos format 1."""
    pairs = {}
    try:
        if "kern" in font:
            for t in font["kern"].kernTables:
                for (l, r), v in t.kernTable.items():
                    if l in cmap_rev and r in cmap_rev and v:
                        pairs[cmap_rev[l] + cmap_rev[r]] = v
        if "GPOS" in font and not pairs:
            gpos = font["GPOS"].table
            for lookup in gpos.LookupList.Lookup:
                if lookup.LookupType not in (2, 9):
                    continue
                for st in lookup.SubTable:
                    if lookup.LookupType == 9:
                        st = st.ExtSubTable
                    if getattr(st, "Format", 0) == 1:
                        cov = st.Coverage.glyphs
                        for i, ps in enumerate(st.PairSet):
                            l = cov[i]
                            if l not in cmap_rev:
                                continue
                            for pvr in ps.PairValueRecord:
                                r = pvr.SecondGlyph
                                v = getattr(pvr.Value1, "XAdvance", 0) if pvr.Value1 else 0
                                if r in cmap_rev and v:
                                    pairs[cmap_rev[l] + cmap_rev[r]] = v
                    elif getattr(st, "Format", 0) == 2:
                        cov = set(st.Coverage.glyphs)
                        c1 = st.ClassDef1.classDefs
                        c2 = st.ClassDef2.classDefs
                        for l in cov:
                            if l not in cmap_rev:
                                continue
                            rec1 = st.Class1Record[c1.get(l, 0)]
                            for r, ch in cmap_rev.items():
                                rec = rec1.Class2Record[c2.get(r, 0)]
                                v = getattr(rec.Value1, "XAdvance", 0) if rec.Value1 else 0
                                if v:
                                    pairs[cmap_rev[l] + ch] = v
    except Exception as e:
        print("  kern skip:", e)
    # simpan hanya pasangan karakter alfanumerik umum supaya file tetap kecil
    keep = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,'")
    return {k: v for k, v in pairs.items() if k[0] in keep and k[1] in keep and abs(v) >= 8}


def build(fid, name, cat, path, outdir):
    font = TTFont(path)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    hhea = font["hhea"]
    os2 = font["OS/2"] if "OS/2" in font else None
    cap = getattr(os2, "sCapHeight", 0) if os2 else 0
    glyphs = {}
    rev = {}
    for ch in CHARS:
        g = cmap.get(ord(ch))
        if not g:
            continue
        rev[g] = ch
        pen = PathPen(gs)
        gs[g].draw(pen)
        glyphs[ch] = [int(gs[g].width), "".join(pen.d)]
    if not cap and "H" in glyphs:
        # perkiraan tinggi kapital dari glyph H
        import re
        ys = [int(v) for v in re.findall(r"-?\d+", glyphs["H"][1])[1::2]]
        cap = max(ys) if ys else int(upm * 0.7)
    data = {
        "id": fid, "name": name, "cat": cat, "upm": upm,
        "asc": hhea.ascent, "desc": hhea.descent, "cap": cap or int(upm * 0.7),
        "glyphs": glyphs, "kern": kern_pairs(font, rev, CHARS),
    }
    out = os.path.join(outdir, fid + ".json")
    with open(out, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{fid:14s} {len(glyphs):3d} glyph  {len(data['kern']):4d} kern  {os.path.getsize(out)//1024} KB")
    return {"id": fid, "name": name, "cat": cat}


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    outdir = os.path.join(root, "fonts")
    os.makedirs(outdir, exist_ok=True)
    index = [build(*f, outdir) for f in FONTS if os.path.exists(f[3]) or print("missing", f[3])]
    with open(os.path.join(outdir, "index.json"), "w") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
