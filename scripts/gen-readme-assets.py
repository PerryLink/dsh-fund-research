#!/usr/bin/env python3
"""Generate README image assets for dsh-fund-research (docs/assets/).

Outputs (idempotent overwrite):
  dsh-fund-research-flow-light.svg / dsh-fund-research-flow-dark.svg
      Hero acquisition → seal pipeline. Two hand-written SVG files (vector —
      never rasterized to webp). Text inside is command-surface tokens only
      (fund_research, pingzhongdata, F10, snapshot.json, manifest.json,
      dataQuality / builtin-fallback, storage-domain names), so all five
      README languages share the same pair.

No evidence webp is produced: this repository carries no benchmark or
measured-results file (no benchmark/RESULTS.md or docs equivalent), so the
README has no measured-data section. If a real benchmark ever lands, quote
its numbers verbatim here (see the dsh-mask sibling script for the webp
bar-chart pattern) and re-run.

The older single-skin assets (dsh-fund-research-flow.svg, -hero.png,
-demo.png, -demo.gif) are kept untouched for external deep links; the five
READMEs reference only the new light/dark pair.

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow only for the optional webp path; the SVG pair is plain text
           and always generated.
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

# --- palette: PerryLink family (accent) + GitHub page backgrounds ----------
FAMILY = "#4B67B4"   # family accent (badges labelColor family uses #2B3245)
GREEN = {"light": "#16a34a", "dark": "#3fb950"}
SKIN = {
    "light": dict(bg="#ffffff", box="#f6f8fa", border="#d0d7de",
                  text="#1f2328", sub="#57606a", track="#eaeef2"),
    "dark": dict(bg="#0d1117", box="#161b22", border="#30363d",
                 text="#f0f6fc", sub="#8b949e", track="#21262d"),
}

# --- CJK font probe: only exercised by the optional webp path --------------
# (kept from the family skeleton; Chinese must never render as tofu boxes).
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",      # Microsoft YaHei
    r"C:\Windows\Fonts\simhei.ttf",    # SimHei
    r"C:\Windows\Fonts\Deng.ttf",      # DengXian
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
]


def require_cjk_font() -> str:
    path = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
    if path is None:
        sys.exit("FATAL: no CJK font found (looked for msyh.ttc, simhei.ttf, "
                 "Deng.ttf, Noto Sans CJK, PingFang). Refusing to render "
                 "Chinese as tofu boxes; install one and re-run.")
    return path


# ---------------------------------------------------------------------------
# 1. Hero acquisition → seal pipeline (light + dark)
# ---------------------------------------------------------------------------
# Command-surface tokens only: the tool entry point and its arguments, the
# upstream endpoints, the sealed artifacts, and the verification engines.
FLOW_NODES = [
    ("fund_research", "code · codes"),
    ("pingzhongdata", "F10 · push2 · TTL"),
    ("snapshot.json", "sha256 · asOfDate"),
    ("verify", "dataQuality | fallback"),
    ("report.md", "manifest.json · seal"),
]


def flow_svg(skin: str) -> str:
    s = SKIN[skin]
    w, h = 1200, 400
    nw, nh, gap = 180, 96, 45
    y0 = 150
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}" role="img" aria-label="dsh-fund-research pipeline">',
        f'<title>dsh-fund-research pipeline</title>',
        f'<rect width="{w}" height="{h}" rx="18" fill="{s["bg"]}"/>',
        f'<text x="60" y="62" fill="{s["text"]}" font-family="ui-sans-serif,'
        f'system-ui,sans-serif" font-size="30" font-weight="700">dsh-fund-research</text>',
        f'<text x="60" y="94" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="16">fund_research · pingzhongdata → '
        f'snapshot.json → report.md</text>',
        f'<line x1="60" y1="116" x2="1140" y2="116" stroke="{s["border"]}"/>',
    ]
    for i, (label, sub) in enumerate(FLOW_NODES):
        x = 60 + i * (nw + gap)
        accent = GREEN[skin] if i == len(FLOW_NODES) - 1 else (
            FAMILY if i == 1 else s["border"])
        parts.append(
            f'<rect x="{x}" y="{y0}" width="{nw}" height="{nh}" rx="14" '
            f'fill="{s["box"]}" stroke="{accent}" stroke-width="2"/>')
        parts.append(
            f'<text x="{x + nw // 2}" y="{y0 + 40}" fill="{s["text"]}" '
            f'text-anchor="middle" font-family="ui-monospace,monospace" '
            f'font-size="16" font-weight="700">{label}</text>')
        parts.append(
            f'<text x="{x + nw // 2}" y="{y0 + 68}" fill="{s["sub"]}" '
            f'text-anchor="middle" font-family="ui-monospace,monospace" '
            f'font-size="12">{sub}</text>')
        if i < len(FLOW_NODES) - 1:
            ax = x + nw + 6
            ay = y0 + nh // 2
            parts.append(
                f'<path d="M{ax} {ay}h{gap - 12}" stroke="{s["sub"]}" '
                f'stroke-width="3"/>')
            parts.append(
                f'<path d="M{ax + gap - 14} {ay - 7}l10 7-10 7" fill="none" '
                f'stroke="{s["sub"]}" stroke-width="3" '
                f'stroke-linecap="round" stroke-linejoin="round"/>')
    # verification / seal bar under nodes 3..5: every key number is checked
    # against the sealed snapshot before the report is written.
    bx, bw, by, bh = 510, 630, 285, 52
    for cx in (510 + 90, 960 + 90):  # node3 / node5 center-bottom connectors
        parts.append(
            f'<path d="M{cx} {y0 + nh}v{by - y0 - nh}" '
            f'stroke="{FAMILY}" stroke-width="2" stroke-dasharray="5 5"/>')
    parts.append(
        f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="12" '
        f'fill="{s["box"]}" stroke="{FAMILY}" stroke-width="2"/>')
    parts.append(
        f'<text x="{bx + bw // 2}" y="{by + 22}" fill="{s["text"]}" '
        f'text-anchor="middle" font-family="ui-monospace,monospace" '
        f'font-size="13">verify engine: dataQuality | builtin-fallback</text>')
    parts.append(
        f'<text x="{bx + bw // 2}" y="{by + 42}" fill="{s["sub"]}" '
        f'text-anchor="middle" font-family="ui-monospace,monospace" '
        f'font-size="12">value ↔ snapshot.json path · recorded in '
        f'manifest.json</text>')
    parts.append(
        f'<text x="60" y="378" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="12">fund-reports/{{code}}/{{YYYYMMDD-HHmmss}}/'
        f' · sources-discovery.json · report.md · manifest.json'
        f' · .run-state.json · .tracking.jsonl</text>')
    parts.append('</svg>')
    return "\n".join(parts) + "\n"


# ---------------------------------------------------------------------------
# 2. Evidence bar chart — intentionally absent.
#    There is no benchmark/ or docs RESULTS file in this repository, so no
#    measured-data section and no evidence image is generated (inventing
#    numbers is forbidden). dsh-mask/scripts/gen-readme-assets.py shows the
#    webp bar-chart pattern (Pillow, quality=90, zh/en × light/dark) for the
#    day a real benchmark exists; call require_cjk_font() before rendering
#    any Chinese text.
# ---------------------------------------------------------------------------


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        with open(os.path.join(OUT, f"dsh-fund-research-flow-{skin}.svg"),
                  "w", encoding="utf-8", newline="\n") as fh:
            fh.write(flow_svg(skin))
    print("wrote 2 SVG assets to docs/assets/ (no benchmark data — "
          "evidence webp skipped)")


if __name__ == "__main__":
    main()
