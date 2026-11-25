#!/usr/bin/env python3
"""Render a 1200x627 LinkedIn release banner for OpenCircom."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONTS_DIR = Path(__file__).resolve().parent / "fonts"
DEFAULT_LOGO = ROOT / "logo.png"
BANNERS_DIR = Path(__file__).resolve().parent

# Site palette (docs/css/style.css)
BG = (11, 14, 17)
BG_ELEVATED = (18, 18, 24)
SURFACE = (24, 28, 36)
BLUE = (0, 174, 239)
BLUE_BRIGHT = (51, 204, 255)
BLUE_DIM = (0, 153, 221)
TEXT = (240, 244, 248)
SILVER = (192, 200, 212)
MUTED = (168, 176, 192)
SILVER_DIM = (128, 136, 144)


def _require_font(path: Path, label: str) -> None:
    if not path.is_file():
        print(f"ERROR: Missing required font {label}: {path}", file=sys.stderr)
        sys.exit(1)


def load_orbitron(size: int, weight: int = 700) -> ImageFont.FreeTypeFont:
    path = FONTS_DIR / "orbitron" / "Orbitron[wght].ttf"
    _require_font(path, "Orbitron")
    font = ImageFont.truetype(str(path), size=size)
    font.set_variation_by_axes([float(weight)])
    return font


def load_rajdhani(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    names = {
        "regular": "Rajdhani-Regular.ttf",
        "medium": "Rajdhani-Medium.ttf",
        "semibold": "Rajdhani-SemiBold.ttf",
        "bold": "Rajdhani-Bold.ttf",
    }
    filename = names.get(weight, "Rajdhani-Regular.ttf")
    path = FONTS_DIR / "rajdhani" / filename
    _require_font(path, f"Rajdhani ({weight})")
    return ImageFont.truetype(str(path), size=size)


def load_share_tech_mono(size: int) -> ImageFont.FreeTypeFont:
    path = FONTS_DIR / "sharetechmono" / "ShareTechMono-Regular.ttf"
    _require_font(path, "Share Tech Mono")
    return ImageFont.truetype(str(path), size=size)


def _line_width(draw: ImageDraw.ImageDraw, line: str, font: ImageFont.ImageFont) -> int:
    return draw.textbbox((0, 0), line, font=font)[2]


def _assert_line_fits(
    draw: ImageDraw.ImageDraw,
    line: str,
    font: ImageFont.ImageFont,
    max_width: int,
    label: str,
) -> None:
    width = _line_width(draw, line, font)
    if width > max_width:
        print(
            f"ERROR: {label} is wider than its box ({width}px > {max_width}px): {line!r}",
            file=sys.stderr,
        )
        sys.exit(1)


def _last_line_ok(line: str) -> bool:
    return len(line.split()) >= 2


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    """Prefer two balanced lines; never leave a lone word on the last line."""
    words = text.split()
    if not words:
        return []
    if _line_width(draw, text, font) <= max_width:
        return [text]

    n = len(words)
    best_lines: list[str] | None = None
    best_key: tuple[int, int, int] | None = None

    def consider(chunks: list[str]) -> None:
        nonlocal best_lines, best_key
        if any(not _last_line_ok(c) for c in chunks[1:]):
            return
        if any(_line_width(draw, c, font) > max_width for c in chunks):
            return
        widths = [_line_width(draw, c, font) for c in chunks]
        key = (len(chunks), max(widths), max(widths) - min(widths))
        if best_key is None or key < best_key:
            best_key = key
            best_lines = chunks

    for i in range(1, n):
        consider([" ".join(words[:i]), " ".join(words[i:])])

    for i in range(1, n - 1):
        for j in range(i + 1, n):
            consider(
                [
                    " ".join(words[:i]),
                    " ".join(words[i:j]),
                    " ".join(words[j:]),
                ]
            )

    if best_lines:
        return best_lines

    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if _line_width(draw, trial, font) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    while len(lines) >= 2 and not _last_line_ok(lines[-1]):
        prev_words = lines[-2].split()
        if len(prev_words) <= 1:
            break
        moved = prev_words.pop()
        lines[-2] = " ".join(prev_words)
        lines[-1] = f"{moved} {lines[-1]}".strip()
        if _line_width(draw, lines[-1], font) > max_width or _line_width(draw, lines[-2], font) > max_width:
            break
    return lines


def _lerp_color(c0: tuple[int, int, int], c1: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))


def draw_vertical_gradient(img: Image.Image, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> None:
    w, h = img.size
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        draw.line([(0, y), (w, y)], fill=_lerp_color(top, bottom, t))


def draw_grid(w: int, h: int) -> Image.Image:
    grid_color = (0, 80, 110, 28)
    step = 48
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for x in range(0, w + 1, step):
        od.line([(x, 0), (x, h)], fill=grid_color, width=1)
    for y in range(0, h + 1, step):
        od.line([(0, y), (w, y)], fill=grid_color, width=1)
    return overlay


def draw_accent_glow(w: int, h: int) -> Image.Image:
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-120, -80, 520, 360), fill=(0, 120, 180, 42))
    od.ellipse((w - 420, -60, w + 80, 280), fill=(0, 174, 239, 22))
    return overlay.filter(ImageFilter.GaussianBlur(radius=28))


def draw_circuit_traces(w: int, h: int) -> Image.Image:
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    trace = (0, 174, 239, 32)
    node = (51, 204, 255, 48)
    paths = [
        [(w - 100, 100), (w - 100, 240), (w - 280, 240), (w - 280, 360)],
        [(720, 70), (920, 70), (920, 150), (1040, 150)],
        [(900, h - 200), (1040, h - 200), (1040, h - 120)],
    ]
    for pts in paths:
        od.line(pts, fill=trace, width=1)
        for pt in pts[::2]:
            od.ellipse((pt[0] - 3, pt[1] - 3, pt[0] + 3, pt[1] + 3), fill=node)
    return overlay


def draw_corner_brackets(draw: ImageDraw.ImageDraw, margin: int, w: int, h: int, color: tuple[int, int, int]) -> None:
    length = 36
    width = 2
    corners = [
        (margin, margin, 1, 1),
        (w - margin, margin, -1, 1),
        (margin, h - margin, 1, -1),
        (w - margin, h - margin, -1, -1),
    ]
    for cx, cy, sx, sy in corners:
        draw.line([(cx, cy), (cx + sx * length, cy)], fill=color, width=width)
        draw.line([(cx, cy), (cx, cy + sy * length)], fill=color, width=width)


def glow_text(
    base: Image.Image,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    glow_rgb: tuple[int, int, int] = BLUE_BRIGHT,
    blur_radius: int = 14,
    glow_alpha: int = 140,
) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.text(xy, text, font=font, fill=(*glow_rgb, glow_alpha))
    blurred = layer.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    base_rgba = base.convert("RGBA")
    base_rgba = Image.alpha_composite(base_rgba, blurred)
    ImageDraw.Draw(base_rgba).text(xy, text, font=font, fill=(*fill, 255))
    base.paste(base_rgba.convert("RGB"))


def render_banner(cfg: dict, logo_path: Path, out_path: Path) -> None:
    w, h = 1200, 627
    img = Image.new("RGB", (w, h), BG)
    draw_vertical_gradient(img, BG_ELEVATED, BG)

    grid = draw_grid(w, h)
    img = Image.alpha_composite(img.convert("RGBA"), grid).convert("RGB")

    accent = draw_accent_glow(w, h)
    img = Image.alpha_composite(img.convert("RGBA"), accent).convert("RGB")

    traces = draw_circuit_traces(w, h)
    img = Image.alpha_composite(img.convert("RGBA"), traces).convert("RGB")
    draw = ImageDraw.Draw(img)

    frame_margin = 36
    draw.rounded_rectangle(
        (frame_margin, frame_margin, w - frame_margin, h - frame_margin),
        radius=16,
        outline=(*BLUE,),
        width=1,
    )
    draw_corner_brackets(draw, frame_margin + 8, w, h, BLUE_DIM)

    inner_w = w - 2 * frame_margin
    content_x = frame_margin + 28
    body_max_w = int(inner_w * 0.80)

    name_font = load_orbitron(44, weight=800)
    ver_font = load_orbitron(30, weight=700)
    title_font = load_orbitron(36, weight=700)
    tag_font = load_rajdhani(24, "medium")
    body_font = load_rajdhani(35, "semibold")
    date_font = load_rajdhani(21, "semibold")
    pkg_font = load_rajdhani(22, "medium")
    mono_font = load_share_tech_mono(21)

    logo = Image.open(logo_path).convert("RGBA")
    logo_size = 92
    logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    img.paste(logo, (64, 64), logo)

    name_x = 64 + logo_size + 22
    glow_text(img, (name_x, 72), "OpenCircom", name_font, BLUE_BRIGHT, blur_radius=16, glow_alpha=100)

    draw = ImageDraw.Draw(img)
    draw.text((name_x, 128), "A library of Circom 2.x circuit templates", font=tag_font, fill=SILVER)

    ver = cfg["version"]
    ver_w = draw.textlength(ver, font=ver_font)
    ver_xy = (int(w - 64 - ver_w), 78)
    badge_pad_x, badge_pad_y = 12, 8
    bb = draw.textbbox(ver_xy, ver, font=ver_font)
    bx0, by0, bx1, by1 = bb[0] - badge_pad_x, bb[1] - badge_pad_y, bb[2] + badge_pad_x, bb[3] + badge_pad_y
    draw.rounded_rectangle((bx0, by0, bx1, by1), radius=8, outline=BLUE_DIM, width=1)
    glow_text(img, ver_xy, ver, ver_font, SILVER, glow_rgb=BLUE, blur_radius=10, glow_alpha=80)
    draw = ImageDraw.Draw(img)

    title = cfg["title"]
    date = cfg.get("date", "2026-11-16")
    _assert_line_fits(draw, title, title_font, body_max_w, "title")
    y_title = 178
    glow_text(img, (content_x, y_title), title, title_font, TEXT, glow_rgb=BLUE_BRIGHT, blur_radius=8, glow_alpha=60)
    draw = ImageDraw.Draw(img)
    y_date = y_title + 52
    draw.text((content_x, y_date), date, font=date_font, fill=MUTED)

    accent_y = y_date + 38
    accent_w = 220
    draw.line([(content_x, accent_y), (content_x + accent_w, accent_y)], fill=BLUE_DIM, width=2)
    draw.line(
        [(content_x + 12, accent_y + 3), (content_x + accent_w - 12, accent_y + 3)],
        fill=(30, 55, 75),
        width=1,
    )

    summary = cfg["summary"]
    summary_lines = wrap_text(draw, summary, body_font, body_max_w)
    for i, line in enumerate(summary_lines, start=1):
        _assert_line_fits(draw, line, body_font, body_max_w, f"summary line {i}")
    line_h = 42
    body_block_h = line_h * len(summary_lines)
    footer_top = h - 132
    header_bottom = accent_y + 20
    mid_gap = footer_top - header_bottom - body_block_h
    y_body = header_bottom + max(28, mid_gap // 2)

    body_fill = (228, 234, 242)
    for line in summary_lines:
        draw.text((content_x, y_body), line, font=body_font, fill=body_fill)
        y_body += line_h

    pkg_line = cfg["package_line"]
    install = cfg["install"]
    footer_max_w = w - frame_margin - 28 - content_x
    _assert_line_fits(draw, pkg_line, pkg_font, footer_max_w, "package line")
    _assert_line_fits(draw, install, mono_font, footer_max_w, "install line")

    draw.line([(content_x, h - 132), (w - frame_margin - 28, h - 132)], fill=(40, 70, 95), width=1)
    draw.text((content_x, h - 108), pkg_line, font=pkg_font, fill=SILVER)
    draw.text((content_x, h - 76), install, font=mono_font, fill=BLUE_BRIGHT)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG", optimize=True)
    print(f"Wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Render OpenCircom LinkedIn release banner (1200x627).")
    parser.add_argument("--json", type=Path, help="Optional JSON config (must include version, title, summary).")
    parser.add_argument("--logo", type=Path, default=DEFAULT_LOGO)
    parser.add_argument("-o", "--output", type=Path, default=None)
    parser.add_argument("--version", required=False, help="Release label, e.g. v0.10.3")
    parser.add_argument("--title", required=False)
    parser.add_argument("--date", default="2026-11-16")
    parser.add_argument("--summary", required=False)
    parser.add_argument("--install", default=None, help="npm install line; defaults from --version")
    args = parser.parse_args()

    if args.json and args.json.is_file():
        cfg = json.loads(args.json.read_text(encoding="utf-8"))
        for key in ("version", "title", "summary"):
            if key not in cfg:
                print(f"ERROR: --json config missing required key: {key}", file=sys.stderr)
                sys.exit(1)
        version = cfg["version"]
        out_path = args.output if args.output is not None else BANNERS_DIR / f"{version}.png"
        if "install" not in cfg:
            cfg["install"] = f"npm install opencircom@{version.lstrip('v')}"
        if "package_line" not in cfg:
            cfg["package_line"] = f"opencircom · {version.lstrip('v')}"
    else:
        missing = [name for name, val in (("version", args.version), ("title", args.title), ("summary", args.summary)) if not val]
        if missing:
            parser.error(f"the following arguments are required: {', '.join('--' + m for m in missing)}")
        version = args.version
        ver_num = version.lstrip("v")
        install = args.install if args.install is not None else f"npm install opencircom@{ver_num}"
        out_path = args.output if args.output is not None else BANNERS_DIR / f"{version}.png"
        cfg = {
            "version": version,
            "title": args.title,
            "date": args.date,
            "summary": args.summary,
            "install": install,
            "package_line": f"opencircom · {ver_num}",
        }
    render_banner(cfg, args.logo, out_path)


if __name__ == "__main__":
    main()