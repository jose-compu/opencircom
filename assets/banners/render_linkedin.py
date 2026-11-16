#!/usr/bin/env python3
"""Render a LinkedIn/GitHub release banner (1200x627) for OpenCircom."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
LOGO_PATH = ROOT / "logo.png"
WIDTH, HEIGHT = 1200, 627

BG_TOP = (12, 18, 32)
BG_BOTTOM = (8, 12, 24)
ACCENT = (6, 182, 212)
TEXT = (230, 236, 245)
MUTED = (148, 163, 184)
PANEL = (22, 32, 52)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def gradient_bg() -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    for y in range(HEIGHT):
        t = y / max(HEIGHT - 1, 1)
        r = int(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))
    return img


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        trial = " ".join(current + [word])
        if draw.textlength(trial, font=font) <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(description="Render OpenCircom release banner PNG")
    parser.add_argument("--version", required=True, help="Release version, e.g. 0.10.0")
    parser.add_argument("--title", required=True, help="Release title")
    parser.add_argument("--date", required=True, help="Release date YYYY-MM-DD")
    parser.add_argument(
        "--packages",
        nargs="+",
        default=[],
        help="Package lines as name@version (e.g. opencircom@0.10.0)",
    )
    parser.add_argument("--install", required=True, help="npm install line")
    parser.add_argument("--explanation", required=True, help="Short release explanation")
    parser.add_argument("--output", required=True, type=Path, help="Output PNG path")
    args = parser.parse_args()

    img = gradient_bg()
    draw = ImageDraw.Draw(img)

    if LOGO_PATH.exists():
        logo = Image.open(LOGO_PATH).convert("RGBA")
        logo.thumbnail((120, 120), Image.Resampling.LANCZOS)
        img.paste(logo, (48, 48), logo)

    title_font = load_font(52, bold=True)
    tagline_font = load_font(22)
    h_font = load_font(28, bold=True)
    body_font = load_font(22)
    small_font = load_font(18)
    mono_font = load_font(20, bold=True)

    x_text = 200
    draw.text((x_text, 52), "OpenCircom", fill=TEXT, font=title_font)
    draw.text((x_text, 108), "A library of Circom 2.x circuit templates", fill=MUTED, font=tagline_font)

    draw.rounded_rectangle([48, 175, WIDTH - 48, HEIGHT - 48], radius=16, fill=PANEL)

    y = 195
    draw.text((72, y), args.title, fill=ACCENT, font=h_font)
    y += 44
    draw.text((72, y), f"v{args.version}  ·  {args.date}", fill=MUTED, font=small_font)
    y += 40

    draw.text((72, y), "Packages", fill=TEXT, font=body_font)
    y += 32
    for pkg in args.packages or [f"opencircom@{args.version}"]:
        name, ver = pkg.split("@", 1) if "@" in pkg else (pkg, args.version)
        draw.text((88, y), f"{name}", fill=MUTED, font=small_font)
        draw.text((320, y), ver, fill=TEXT, font=small_font)
        y += 28

    y += 12
    draw.text((72, y), "Install", fill=TEXT, font=body_font)
    y += 30
    draw.rounded_rectangle([72, y, WIDTH - 72, y + 40], radius=8, fill=(15, 23, 42))
    draw.text((88, y + 8), args.install, fill=ACCENT, font=mono_font)
    y += 58

    expl_lines = wrap_text(draw, args.explanation, body_font, WIDTH - 144)
    for line in expl_lines:
        draw.text((72, y), line, fill=TEXT, font=body_font)
        y += 30

    args.output.parent.mkdir(parents=True, exist_ok=True)
    img.save(args.output, "PNG")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()