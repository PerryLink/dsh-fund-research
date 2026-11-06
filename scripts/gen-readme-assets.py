#!/usr/bin/env python3
"""Generate README visuals for dsh-fund-research (docs/assets/).

Outputs (idempotent overwrite):
  dsh-fund-research-hero-{zh,en}-{light,dark}.webp   1440x576 raster (Pillow)
  dsh-fund-research-flow-v5-{light,dark}.svg         1100x660 hand-written SVG

Design notes
------------
* Hero: the left column is prose (kicker / headline / two value lines / one
  subtitle / one meta line / rule / one footer). The right column is this
  repository's own semantic figure: the sealed trace appendix of one real
  report. Four public endpoints (pingzhongdata / F10 jjcc / F10 jjjl / push2)
  fan into `snapshot.json`, and five key numbers of the report are shown with
  the exact snapshot JSON path each one resolves to, each carrying a green
  `verified` verdict. A tally strip closes the ledger (verified 5 / mismatch 0
  / not-found 0 / unverifiable 0) and a round seal stamp reports the sealed
  version. Every figure is a checked-in fixture fact for fund 161725
  (fixtures/pingzhongdata-161725.js, fixtures/f10-jjcc-161725.html) or the tool
  output documented in README.md: latest unit NAV 0.5617 on 2026-08-17
  (raw.navTrend[2733].nav), 1-year return -27.27 (raw.returns.year1), latest
  scale 197.40 亿元 on 2026-06-30 (raw.scaleHistory.values[4]), top-3 aggregate
  47.50% (17.28 + 15.19 + 15.03 published navPct), equity exposure 94.79% on
  2026-06-30 (raw.assetAllocation.stockPct[3]), sealed version 20260819-153012
  and report sha256 prefix f74b1446d544 (README.md example). Nothing invented.
* Flow: a "staircase chain-of-custody" grammar, not a row of five boxes. The
  four stages climb left-to-right (COLLECT -> SNAPSHOT -> COMPUTE -> VERIFY &
  SEAL), each card holding that stage's real artifacts, and a dashed return
  loop under the whole staircase carries the traceability appendix back from
  the sealed report to `snapshot.json` (report number <-> snapshot path <->
  verdict). Text is endpoint names, tool names, JSON paths and short labels
  only, so all five README languages share the same pair.
* The older single-skin assets (dsh-fund-research-flow.svg, -flow-{light,dark}.svg,
  -hero.png, -demo.png, -demo.gif) are kept untouched for external deep links;
  the five READMEs reference only the hero webp pair and the flow-v5 SVG pair.

Run once:  python scripts/gen-readme-assets.py
Requires:  Python 3.10+ with Pillow; Windows fonts msyh.ttc / msyhbd.ttc /
           consola.ttf / segoeui.ttf / segoeuib.ttf.
"""
from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

FONT_CJK = r"C:\Windows\Fonts\msyh.ttc"
FONT_CJK_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_MONO = r"C:\Windows\Fonts\consola.ttf"
FONT_EN = r"C:\Windows\Fonts\segoeui.ttf"
FONT_EN_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"

for _path in (FONT_CJK, FONT_CJK_BOLD, FONT_MONO, FONT_EN, FONT_EN_BOLD):
    if not os.path.exists(_path):
        raise SystemExit(f"FATAL: font missing: {_path}")

WARNINGS: list[str] = []

SKIN = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8", card="#ffffff",
        card_edge="#e4e1ee", zone="#f7f4fc", zone_edge="#e5e0f1",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", on_accent="#ffffff",
        good="#16a34a", good_bg="#e9f6ee",
        pill="#ece7f9", grid="#e7e4f0", shadow=(32, 26, 64),
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016", card="#1b2231",
        card_edge="#2e374b", zone="#171e2d", zone_edge="#2b3448",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", on_accent="#101726",
        good="#3fb950", good_bg="#16301f",
        pill="#242d42", grid="#1e2636", shadow=(0, 0, 0),
    ),
}

# --- real fixture / README facts for fund 161725 ---------------------------
FUND = {
    "code": "161725",
    "name": "招商中证白酒指数(LOF)A",
    "version": "20260819-153012",
}

HERO = {
    "zh": dict(
        kicker="dsh-fund-research · 公募基金研究",
        title="基金研究可回溯",
        value=["六位代码，换一份可复核的报告",
               "每个数字，都能对回封存快照"],
        sub="采集 → 确定性指标 → 核查 → 封存",
        meta="只读采集 · 无交易 · 不调模型 · 不构成投资建议",
        foot="Apache-2.0 · PerryLink DSH plugin family",
        foot2="DSH ≥0.2.1 <0.3.0 · node ^22.19 || ≥24.9",
        board_kicker="数字回溯表 · TRACE APPENDIX",
        board_rule="每个数字 → snapshot.json 路径 → 核查结论",
        col_number="报告数字",
        col_path="snapshot.json 路径",
        col_verdict="结论",
        rows=[
            ("最新单位净值", "0.5617", "raw.navTrend[2733].nav"),
            ("近1年收益", "-27.27%", "raw.returns.year1"),
            ("最新规模", "197.40 亿", "raw.scaleHistory.values[4]"),
            ("前三大合计", "47.50%", "computed.holdings.top3Pct"),
            ("股票仓位", "94.79%", "raw.assetAllocation.stockPct[3]"),
        ],
        tally=["verified 5", "mismatch 0", "not-found 0", "unverifiable 0"],
        line1="先封存 snapshot.json，再逐条核查 → report.md + manifest.json",
        line2="report sha256 f74b1446d544… · 逐源 sha256 × 4 · gaps[] 显式声明",
        seal="已封存",
    ),
    "en": dict(
        kicker="dsh-fund-research · mutual-fund research",
        title="Fund research",
        value=["One code in, one auditable report",
               "Every number traced to its snapshot"],
        sub="collect → compute → trace-check → seal",
        meta="read-only · no trading · no model math · not advice",
        foot="Apache-2.0 · PerryLink DSH plugin family",
        foot2="DSH ≥0.2.1 <0.3.0 · node ^22.19 || ≥24.9",
        board_kicker="TRACE APPENDIX · 5 / 5 VERIFIED",
        board_rule="each number → snapshot.json path → verdict",
        col_number="report number",
        col_path="snapshot.json path",
        col_verdict="verdict",
        rows=[
            ("latest NAV", "0.5617", "raw.navTrend[2733].nav"),
            ("1-year return", "-27.27%", "raw.returns.year1"),
            ("latest size", "197.40 亿", "raw.scaleHistory.values[4]"),
            ("top-3 weight", "47.50%", "computed.holdings.top3Pct"),
            ("equity exposure", "94.79%", "raw.assetAllocation.stockPct[3]"),
        ],
        tally=["verified 5", "mismatch 0", "not-found 0", "unverifiable 0"],
        line1="snapshot.json sealed first, then every number checked",
        line2="report sha256 f74b1446d544… · per-source sha256 × 4 · gaps[] declared",
        seal="SEALED",
    ),
}


def font(size, kind="cjk"):
    return ImageFont.truetype(
        {"cjk": FONT_CJK, "cjk_bold": FONT_CJK_BOLD, "mono": FONT_MONO,
         "en": FONT_EN, "en_bold": FONT_EN_BOLD}[kind], max(8, int(size)))


def hx(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def gradient(w, h, c1, c2):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = 0.25 * (y / h) + 0.75 * (y / h) ** 1.6
        d.line([(0, y), (w, y)],
               fill=tuple(int(p + (q - p) * t) for p, q in zip(hx(c1), hx(c2))))
    return img


def glow(img, cx, cy, r, color, alpha=40):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(10, 0, -1):
        rr = r * i / 10
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  fill=color + (int(alpha * (1 - i / 11)),))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def card(img, box, skin, radius=22, shadow=28):
    x0, y0, x1, y1 = box
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for i in range(shadow, 0, -3):
        sd.rounded_rectangle([x0 - i // 5, y0 + i // 2, x1 + i // 5, y1 + i],
                             radius=radius + i // 5,
                             fill=skin["shadow"] + (int(7 * (1 - i / shadow)),))
    base = Image.alpha_composite(
        img.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(13)))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=hx(skin["card"]),
                        outline=hx(skin["card_edge"]), width=2)
    return base.convert("RGB")


def fit(d, text, kind, max_w, size, min_size=14):
    size = int(size)
    while size > min_size:
        if d.textlength(text, font=font(size, kind)) <= max_w:
            return size
        size -= 2
    return max(min_size, size)


def write(img, xy, text, skin, size, kind="cjk", color="text",
          max_w=None, min_size=14, tag="", anchor=None):
    d = ImageDraw.Draw(img)
    if max_w is not None:
        size = fit(d, text, kind, max_w, size, min_size)
        if d.textlength(text, font=font(size, kind)) > max_w:
            WARNINGS.append(f"{tag}: {text!r} exceeds {max_w}px at {size}px")
            print(f"WARN {tag}: {text!r} exceeds {max_w}px at {size}px")
    d.text(xy, text, font=font(size, kind), fill=hx(skin[color]), anchor=anchor)
    return size


def pill(img, xy, text, skin, size=19, kind="cjk_bold",
         fg="accent", bg="pill", pad_x=18, pad_y=10):
    d = ImageDraw.Draw(img)
    f = font(size, kind)
    tw = d.textlength(text, font=f)
    x, y = xy
    h = size + pad_y * 2
    d.rounded_rectangle([x, y, x + tw + pad_x * 2, y + h], radius=h // 2,
                        fill=hx(skin[bg]))
    d.text((x + pad_x, y + pad_y - 1), text, font=f, fill=hx(skin[fg]))
    return img, x + tw + pad_x * 2


def check_display(canvas_px, minimum_displayed, tag):
    displayed = canvas_px * 880 / 1440
    if displayed < minimum_displayed:
        WARNINGS.append(
            f"{tag}: {canvas_px}px renders at {displayed:.1f}px on GitHub "
            f"(< {minimum_displayed}px)")
        print(f"WARN {tag}: {canvas_px}px renders at {displayed:.1f}px")


def hero(lang, skin_name):
    s = SKIN[skin_name]
    m = HERO[lang]
    zh = lang == "zh"
    w, h = 1440, 576
    img = gradient(w, h, s["bg_from"], s["bg_to"])
    img = glow(img, 1210, 26, 430, hx(s["accent"]),
               18 if skin_name == "light" else 34)
    img = glow(img, 110, 566, 300, hx(s["accent"]),
               8 if skin_name == "light" else 12)

    # ------------------------------------------------------------- left copy
    img, _ = pill(img, (60, 56), m["kicker"], s, size=19,
                  kind="cjk_bold" if zh else "en_bold", pad_x=20, pad_y=11)

    d = ImageDraw.Draw(img)
    title_kind = "cjk_bold" if zh else "en_bold"
    tsize = fit(d, m["title"], title_kind, 600, 88, 78)
    check_display(tsize, 48, f"hero.{lang}.title")
    d.text((60, 118), m["title"], font=font(tsize, title_kind),
           fill=hx(s["text"]))

    vkind = "cjk_bold" if zh else "en_bold"
    vsize = 36 if zh else 34
    for line in m["value"]:
        vsize = min(vsize, fit(d, line, vkind, 600, vsize, 22))
    for i, line in enumerate(m["value"]):
        write(img, (60, 258 + i * (vsize + 16)), line, s, vsize, vkind,
              "text", 600, 22, f"hero.{lang}.value{i}")
    check_display(vsize, 17, f"hero.{lang}.value")

    sub_size = write(img, (60, 388), m["sub"], s, 26,
                     "cjk" if zh else "en", "sub", 600, 24,
                     f"hero.{lang}.sub")
    check_display(sub_size, 15, f"hero.{lang}.sub")

    meta_size = write(img, (60, 444), m["meta"], s, 20,
                      "cjk" if zh else "en", "faint", 600, 17,
                      f"hero.{lang}.meta")
    check_display(meta_size, 12, f"hero.{lang}.meta")

    d = ImageDraw.Draw(img)
    d.line([60, 482, 620, 482], fill=hx(s["grid"]), width=2)
    write(img, (60, 498), m["foot"], s, 16, "en", "faint", 600, 13,
          f"hero.{lang}.foot")
    write(img, (60, 522), m["foot2"], s, 14, "en", "faint", 600, 12,
          f"hero.{lang}.foot2")

    # ------------------------------------------- right: sealed trace appendix
    img = card(img, (700, 44, 1392, 552), s, radius=22)
    d = ImageDraw.Draw(img)

    write(img, (728, 64), m["board_kicker"], s, 16,
          "cjk_bold" if zh else "en_bold", "accent", 360, 13,
          f"hero.{lang}.board_kicker")
    d.text((1364, 66), f'{FUND["code"]} · {FUND["version"]}', font=font(14, "mono"),
           fill=hx(s["faint"]), anchor="ra")

    write(img, (728, 92), FUND["name"], s, 24, "cjk_bold", "text", 430, 18,
          f"hero.{lang}.board_name")

    # fan-in strip: four public endpoints -> one sealed snapshot
    x = 728
    for label in ("pingzhongdata", "F10 jjcc", "F10 jjjl", "push2"):
        f = font(12.5, "mono")
        cw = d.textlength(label, font=f) + 24
        d.rounded_rectangle([x, 128, x + cw, 152], radius=12, fill=hx(s["pill"]))
        d.text((x + 12, 132), label, font=f, fill=hx(s["accent"]))
        x += cw + 6
    d.line([x + 2, 140, x + 22, 140], fill=hx(s["accent"]), width=2)
    d.line([x + 14, 135, x + 22, 140], fill=hx(s["accent"]), width=2)
    d.line([x + 14, 145, x + 22, 140], fill=hx(s["accent"]), width=2)
    x += 26
    label = "snapshot.json"
    f = font(12.5, "mono")
    cw = d.textlength(label, font=f) + 26
    d.rounded_rectangle([x, 128, x + cw, 152], radius=12, fill=hx(s["accent"]))
    d.text((x + 13, 132), label, font=f, fill=hx(s["on_accent"]))
    if x + cw > 1364:
        WARNINGS.append(f"hero.{lang}.fanin overflows: {x + cw} > 1364")

    write(img, (728, 176), m["board_rule"], s, 16.5,
          "cjk_bold" if zh else "en_bold", "accent", 560, 14,
          f"hero.{lang}.board_rule")

    write(img, (728, 204), m["col_number"], s, 13, "cjk" if zh else "en",
          "faint", 200, 11, f"hero.{lang}.col_number")
    d.text((988, 204), m["col_path"], font=font(13, "cjk" if zh else "en"),
           fill=hx(s["faint"]))
    write(img, (1364, 204), m["col_verdict"], s, 13, "cjk" if zh else "en",
          "faint", 160, 11, f"hero.{lang}.col_verdict", anchor="ra")
    d = ImageDraw.Draw(img)
    d.line([728, 224, 1364, 224], fill=hx(s["grid"]), width=2)

    for i, (label, value, path) in enumerate(m["rows"]):
        y = 234 + i * 42
        if i % 2 == 0:
            d.rounded_rectangle([728, y - 5, 1364, y + 31], radius=10,
                                fill=hx(s["zone"]))
        write(img, (742, y + 3), label, s, 16, "cjk" if zh else "en", "sub",
              220, 13, f"hero.{lang}.row{i}.label")
        value_kind = ("cjk_bold"
                      if any("\u4e00" <= ch <= "\u9fff" for ch in value)
                      else "mono")
        write(img, (960, y), value, s, 21, value_kind, "text", 195, 15,
              f"hero.{lang}.row{i}.value", anchor="ra")
        d.text((988, y + 6), path, font=font(14.5, "mono"), fill=hx(s["sub"]))
        cx, cy = 1282, y + 13
        d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=hx(s["good_bg"]))
        d.line([cx - 4, cy, cx - 1, cy + 3], fill=hx(s["good"]), width=2)
        d.line([cx - 1, cy + 3, cx + 5, cy - 4], fill=hx(s["good"]), width=2)
        d.text((1364, y + 6), "verified", font=font(13.5, "mono"),
               fill=hx(s["good"]), anchor="ra")

    d.line([728, 446, 1364, 446], fill=hx(s["grid"]), width=2)

    x = 728
    for i, label in enumerate(m["tally"]):
        fg, bg = ("good", "good_bg") if i == 0 else ("sub", "pill")
        img, x = pill(img, (x, 458), label, s, size=13.5, kind="mono",
                      fg=fg, bg=bg, pad_x=14, pad_y=8)
        x += 8
    if x - 8 > 1264:
        WARNINGS.append(f"hero.{lang}.tally overflows into seal: {x - 8}")

    write(img, (728, 506), m["line1"], s, 15, "cjk" if zh else "en", "sub",
          520, 13, f"hero.{lang}.line1")
    write(img, (728, 530), m["line2"], s, 13, "cjk" if zh else "en", "faint",
          530, 11.5, f"hero.{lang}.line2")

    # round seal stamp
    cx, cy = 1300, 496
    d.ellipse([cx - 36, cy - 36, cx + 36, cy + 36],
              outline=hx(s["accent"]), width=2)
    d.ellipse([cx - 29, cy - 29, cx + 29, cy + 29],
              outline=hx(s["grid"]), width=1)
    d.line([cx - 9, cy - 4, cx - 3, cy + 3], fill=hx(s["good"]), width=3)
    d.line([cx - 3, cy + 3, cx + 9, cy - 11], fill=hx(s["good"]), width=3)
    d.text((cx, cy + 12), m["seal"], font=font(10.5, "mono" if not zh else "cjk_bold"),
           fill=hx(s["accent"]), anchor="ma")

    path = os.path.join(OUT, f"dsh-fund-research-hero-{lang}-{skin_name}.webp")
    img.save(path, "WEBP", quality=92, method=6)
    print(f"wrote dsh-fund-research-hero-{lang}-{skin_name}.webp")


# --------------------------------------------------------------- flow (SVG)
FLOW = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8", card="#ffffff",
        edge="#e4e1ee", zone="#f5f2fb", zone_edge="#e3def1",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", good="#16a34a",
        pill="#ece7f9", grid="#e7e4f0", dot="#d9d3ea",
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016", card="#1b2231",
        edge="#2e374b", zone="#171e2d", zone_edge="#2b3448",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", good="#3fb950",
        pill="#242d42", grid="#1e2636", dot="#26314a",
    ),
}

MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
SANS = ("ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', "
        "sans-serif")

STEPS = [
    dict(
        title="1 · COLLECT",
        sub="fund_research · 4 sources",
        rows=[("pingzhongdata", "NAV·scale"), ("F10 jjcc", "holdings"),
              ("F10 jjjl", "manager"), ("push2 → delay", "quotes")],
        foot="1000ms · retry 2 · TTL 12h",
    ),
    dict(
        title="2 · SNAPSHOT",
        sub="snapshot.json · sha256",
        rows=[("raw.*", "10 blocks"), ("computed.*", "5 metrics"),
              ("sources.*", "sha256 ×4"), ("asOf · gaps[]", "cutoff")],
        foot="sealed before verify",
    ),
    dict(
        title="3 · COMPUTE",
        sub="pure functions, no model",
        rows=[("performance", "return·vol·dd"), ("holdings", "topN · HHI"),
              ("style", "size × PE"), ("manager", "tenure")],
        foot="riskFreeRate 0.02 · √250",
    ),
    dict(
        title="4 · VERIFY → SEAL",
        sub="verify then seal",
        rows=[("snapshot.json", "sealed"), ("sources-discovery", "gaps"),
              ("report.md", "appendix"), ("manifest.json", "sha256")],
        foot="5 verified · 0 mismatch",
    ),
]


def esc(text):
    return (text.replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;"))


def flow_svg(skin_name):
    s = FLOW[skin_name]
    p: list[str] = []
    shadow_op = "0.10" if skin_name == "light" else "0.55"
    shadow_col = "#1b1735" if skin_name == "light" else "#000000"

    def t(x, y, text, size, color="text", family=MONO, weight=400,
          anchor="start", opacity=None):
        extra = f' opacity="{opacity}"' if opacity else ""
        p.append(
            f'<text x="{x}" y="{y}" fill="{s[color]}" font-family="{family}" '
            f'font-size="{size}" font-weight="{weight}" '
            f'text-anchor="{anchor}"{extra}>{esc(text)}</text>')

    def box(x, y, w, h, fill="card", stroke="edge", r=20, sw=1.5):
        p.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" '
            f'fill="{s[fill]}" stroke="{s[stroke]}" stroke-width="{sw}"/>')

    def line(x1, y1, x2, y2, color="grid", width=1.5, dash=None, opacity=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        o = f' opacity="{opacity}"' if opacity else ""
        p.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="{s[color]}" stroke-width="{width}"{d}{o}/>')

    def rise(x1, y1, x2, y2):
        """Elbow staircase connector: right edge -> riser -> next card's left edge."""
        xr = x1 + 20
        p.append(
            f'<path d="M{x1} {y1} H{xr - 5} Q{xr} {y1} {xr} {y1 - 5} '
            f'V{y2 + 5} Q{xr} {y2} {xr + 5} {y2} H{x2 - 8}" '
            f'fill="none" stroke="{s["accent"]}" stroke-width="2.2" '
            f'stroke-linecap="round"/>')
        p.append(
            f'<path d="M{x2 - 14} {y2 - 5} L{x2 - 8} {y2} L{x2 - 14} {y2 + 5}" '
            f'fill="none" stroke="{s["accent"]}" stroke-width="2.2" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')

    def chip(x, y, w, h, label, fg="accent", bg="pill", size=13):
        p.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h / 2}" '
            f'fill="{s[bg]}"/>')
        t(x + w / 2, y + h / 2 + size * 0.36, label, size, fg, MONO,
          anchor="middle")

    p.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="660" '
        f'viewBox="0 0 1100 660" role="img" aria-label="dsh-fund-research '
        f'structure: a four-stage staircase (collect, snapshot, compute, '
        f'verify and seal) plus a dashed return loop that carries every report '
        f'number back to its snapshot.json path and verdict">\n'
        f'<title>dsh-fund-research: staircase pipeline with a traceability '
        f'return loop</title>\n'
        f'<defs>\n'
        f'  <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">\n'
        f'    <stop offset="0" stop-color="{s["bg_from"]}"/>\n'
        f'    <stop offset="1" stop-color="{s["bg_to"]}"/>\n'
        f'  </linearGradient>\n'
        f'  <filter id="soft" x="-30%" y="-30%" width="160%" height="180%">\n'
        f'    <feDropShadow dx="0" dy="8" stdDeviation="11" '
        f'flood-color="{shadow_col}" flood-opacity="{shadow_op}"/>\n'
        f'  </filter>\n'
        f'  <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">\n'
        f'    <circle cx="1.4" cy="1.4" r="1.4" fill="{s["dot"]}"/>\n'
        f'  </pattern>\n'
        f'</defs>\n'
        f'<rect width="1100" height="660" fill="url(#bg)"/>\n'
        f'<rect width="1100" height="660" fill="url(#dots)" opacity=".42"/>')

    # header
    t(44, 58, "dsh-fund-research", 32, "text", MONO, 700)
    t(44, 84, "six-digit code → polite collection → deterministic metrics → "
      "sealed report", 15, "sub", SANS)
    p.append(f'<rect x="744" y="40" width="312" height="34" rx="17" '
             f'fill="{s["pill"]}"/>')
    t(900, 62, "fund-reports/161725/20260819-153012", 13.5, "accent", MONO,
      anchor="middle")
    line(44, 104, 1056, 104, "grid", 1.5)

    # staircase: four cards climbing left -> right
    xs = (40, 304, 568, 832)
    ys = (384, 300, 216, 132)
    CW, CH = 228, 186
    for (x, y), step in zip(zip(xs, ys), STEPS):
        p.append('<g filter="url(#soft)">')
        box(x, y, CW, CH, r=20)
        p.append('</g>')
        t(x + 18, y + 30, step["title"], 16, "accent", MONO, 700)
        t(x + 18, y + 52, step["sub"], 11.5, "faint", MONO)
        line(x + 18, y + 64, x + CW - 18, y + 64, "grid", 1.2)
        for i, (label, note) in enumerate(step["rows"]):
            ry = y + 88 + i * 22
            t(x + 18, ry, label, 13.5, "text", MONO)
            t(x + CW - 18, ry, note, 11.5, "sub", MONO, anchor="end")
            if i < 3:
                line(x + 18, ry + 7, x + CW - 18, ry + 7, "grid", 1,
                     opacity="0.55")
        t(x + 18, y + 176, step["foot"], 11.5, "faint", MONO)

    # staircase connectors, each landing in the next card's header gap
    rise(268, 470, 304, 372)
    rise(532, 386, 568, 288)
    rise(796, 302, 832, 204)

    # dashed return loop: sealed report -> snapshot.json path (traceability)
    p.append(
        f'<path d="M946 318 V572 Q946 596 922 596 H478 Q454 596 454 572 V500" '
        f'fill="none" stroke="{s["accent"]}" stroke-width="2.2" '
        f'stroke-dasharray="7 6" stroke-linecap="round"/>')
    p.append(
        f'<path d="M448 500 L454 490 L460 500" fill="none" '
        f'stroke="{s["accent"]}" stroke-width="2.2" stroke-linecap="round" '
        f'stroke-linejoin="round"/>')
    t(688, 584, "trace back: report number ↔ snapshot.json path ↔ verdict", 13,
      "accent", SANS, anchor="middle")

    # footer rules
    t(44, 622, "files: snapshot.json · sources-discovery.json · report.md · "
      "manifest.json · .run-state.json · .tracking.jsonl", 12.5, "sub", MONO)
    t(44, 642, "engine: dsh-data-quality | builtin-fallback · gaps declared, "
      "never filled · research only, no trading, no advice", 12.5, "sub", SANS)

    p.append('</svg>')

    path = os.path.join(OUT, f"dsh-fund-research-flow-v5-{skin_name}.svg")
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(p) + "\n")
    print(f"wrote dsh-fund-research-flow-v5-{skin_name}.svg")


def main():
    os.makedirs(OUT, exist_ok=True)
    for skin_name in ("light", "dark"):
        for lang in ("zh", "en"):
            hero(lang, skin_name)
        flow_svg(skin_name)
    if WARNINGS:
        print(f"{len(WARNINGS)} layout warning(s)")
    else:
        print("no layout warnings")


if __name__ == "__main__":
    main()
