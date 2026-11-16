#!/usr/bin/env python3
"""Render a 1200x627 LinkedIn release banner for OpenCircom."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LOGO = ROOT / "logo.png"
DEFAULT_OUT = Path(__file__).resolve().parent / "v0.10.0.png"

FONT_SANS = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
)
FONT_SANS_BOLD = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
)
FONT_MONO = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
)


def load_font(candidates: tuple[str, ...], size: int) -> ImageFont.FreeTypeFont:
    for path in candidates:
        p = Path(path)
        if p.is_file():
            return ImageFont.truetype(str(p), size=size)
    return ImageFont.load_default()


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        w = draw.textbbox((0, 0), trial, font=font)[2]
        if w <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def render_banner(cfg: dict, logo_path: Path, out_path: Path) -> None:
    w, h = 1200, 627
    bg_top = (12, 18, 32)
    bg_bot = (8, 12, 22)
    accent = (56, 189, 248)
    silver = (203, 213, 225)
    dim = (148, 163, 184)

    img = Image.new("RGB", (w, h), bg_bot)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(bg_top[0] * (1 - t) + bg_bot[0] * t)
        g = int(bg_top[1] * (1 - t) + bg_bot[1] * t)
        b = int(bg_top[2] * (1 - t) + bg_bot[2] * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    draw.rounded_rectangle((40, 40, w - 40, h - 40), radius=24, outline=(30, 58, 95), width=2)

    title_font = load_font(FONT_SANS_BOLD, 52)
    tag_font = load_font(FONT_SANS, 26)
    h2_font = load_font(FONT_SANS_BOLD, 34)
    body_font = load_font(FONT_SANS, 24)
    small_font = load_font(FONT_SANS, 20)
    mono_font = load_font(FONT_MONO, 22)

    logo = Image.open(logo_path).convert("RGBA")
    logo_size = 96
    logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    img.paste(logo, (72, 72), logo)

    name_x = 72 + logo_size + 24
    draw.text((name_x, 78), "OpenCircom", font=title_font, fill=accent)
    draw.text((name_x, 138), "A library of Circom 2.x circuit templates", font=tag_font, fill=silver)

    ver = cfg.get("version", "v0.10.0")
    draw.text((w - 72 - draw.textlength(ver, font=h2_font), 82), ver, font=h2_font, fill=silver)

    title = cfg.get("title", "Safe gate & mux wrappers")
    date = cfg.get("date", "2026-11-16")
    y = 200
    draw.text((72, y), title, font=h2_font, fill=(241, 245, 249))
    draw.text((72, y + 48), date, font=small_font, fill=dim)

    summary = cfg.get(
        "summary",
        "Safe wrappers for XOR, NOT, NAND, NOR, and the multi-channel muxes "
        "now reject any bit or selector that is not 0 or 1.",
    )
    y = 290
    for line in wrap_text(draw, summary, body_font, w - 144):
        draw.text((72, y), line, font=body_font, fill=silver)
        y += 32

    pkg_line = cfg.get("package_line", f"opencircom · {ver.lstrip('v')}")
    install = cfg.get("install", "npm install opencircom@0.10.0")
    draw.text((72, h - 120), pkg_line, font=small_font, fill=dim)
    draw.text((72, h - 88), install, font=mono_font, fill=accent)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG", optimize=True)
    print(f"Wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Render OpenCircom LinkedIn release banner (1200x627).")
    parser.add_argument("--json", type=Path, help="Optional JSON config for title, version, date, summary, install.")
    parser.add_argument("--logo", type=Path, default=DEFAULT_LOGO)
    parser.add_argument("-o", "--output", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--version", default="v0.10.0")
    parser.add_argument("--title", default="Safe gate & mux wrappers")
    parser.add_argument("--date", default="2026-11-16")
    parser.add_argument(
        "--summary",
        default=(
            "Safe wrappers for XOR, NOT, NAND, NOR, and the multi-channel muxes "
            "now reject any bit or selector that is not 0 or 1."
        ),
    )
    parser.add_argument("--install", default="npm install opencircom@0.10.0")
    args = parser.parse_args()

    if args.json and args.json.is_file():
        cfg = json.loads(args.json.read_text(encoding="utf-8"))
    else:
        cfg = {
            "version": args.version,
            "title": args.title,
            "date": args.date,
            "summary": args.summary,
            "install": args.install,
            "package_line": f"opencircom · {args.version.lstrip('v')}",
        }
    render_banner(cfg, args.logo, args.output)


if __name__ == "__main__":
    main()