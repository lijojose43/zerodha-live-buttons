#!/usr/bin/env python3
"""Generate production-ready PWA icons for this app."""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


OUT_DIR = Path(__file__).resolve().parent
MASTER_SIZE = 1024


def _lerp(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def _linear_gradient(size, top, bottom):
    img = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=_lerp(top, bottom, t) + (255,))
    return img


def _diagonal_overlay(size, color=(56, 189, 248), strength=0.22):
    x = Image.linear_gradient("L").resize((size, size))
    y = Image.linear_gradient("L").rotate(90, expand=False).resize((size, size))
    mask = ImageChops.add(x, y, scale=2.0)
    overlay = Image.new("RGBA", (size, size), color + (0,))
    overlay.putalpha(mask.point(lambda p: int(p * strength)))
    return overlay


def _draw_chart_mark(img, safe_margin):
    size = img.width
    draw = ImageDraw.Draw(img)
    left = int(size * safe_margin)
    top = int(size * safe_margin)
    right = size - left
    bottom = size - top
    width = right - left
    height = bottom - top

    bar_width = int(width * 0.16)
    bar_spacing = int(width * 0.08)
    bar_base = bottom - int(height * 0.10)
    bar_heights = [0.30, 0.48, 0.68]
    start_x = left + int(width * 0.08)

    bar_color = (148, 163, 184, 90)
    for i, h in enumerate(bar_heights):
        x1 = start_x + i * (bar_width + bar_spacing)
        x2 = x1 + bar_width
        y1 = bar_base - int(height * h)
        radius = max(2, int(bar_width * 0.22))
        draw.rounded_rectangle([(x1, y1), (x2, bar_base)], radius=radius, fill=bar_color)

    points = [
        (left + int(width * 0.06), top + int(height * 0.68)),
        (left + int(width * 0.26), top + int(height * 0.56)),
        (left + int(width * 0.46), top + int(height * 0.62)),
        (left + int(width * 0.66), top + int(height * 0.38)),
        (left + int(width * 0.86), top + int(height * 0.24)),
    ]

    stroke = max(8, int(size * 0.052))
    shadow_offset = max(2, int(stroke * 0.18))
    shadow_points = [(x + shadow_offset, y + shadow_offset) for x, y in points]
    draw.line(shadow_points, fill=(15, 23, 42, 140), width=stroke + 3, joint="curve")
    draw.line(points, fill=(236, 253, 245, 255), width=stroke, joint="curve")

    node_radius = max(4, int(stroke * 0.30))
    for x, y in points[:-1]:
        draw.ellipse(
            [(x - node_radius, y - node_radius), (x + node_radius, y + node_radius)],
            fill=(16, 185, 129, 255),
            outline=(236, 253, 245, 220),
            width=max(1, int(stroke * 0.10)),
        )

    tip_x, tip_y = points[-1]
    arrow = max(12, int(stroke * 0.62))
    arrow_poly = [
        (tip_x, tip_y - arrow),
        (tip_x + arrow, tip_y + arrow * 0.3),
        (tip_x - arrow * 0.85, tip_y + arrow * 0.9),
    ]
    draw.polygon(arrow_poly, fill=(16, 185, 129, 255))


def _draw_favicon_mark(img):
    size = img.width
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.08)
    r = int(size * 0.26)
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=r, fill=255)

    bg = _linear_gradient(size, (13, 34, 93), (30, 64, 175))
    bg = Image.alpha_composite(bg, _diagonal_overlay(size, color=(34, 211, 238), strength=0.14))
    img.paste(bg, (0, 0), mask)

    z = [
        (pad + size * 0.10, pad + size * 0.18),
        (size - pad - size * 0.10, pad + size * 0.18),
        (size - pad - size * 0.42, size * 0.50),
        (size - pad - size * 0.10, size - pad - size * 0.18),
        (pad + size * 0.10, size - pad - size * 0.18),
        (pad + size * 0.42, size * 0.50),
    ]
    draw.polygon(z, fill=(241, 245, 249, 255))
    dot = int(size * 0.15)
    draw.ellipse(
        [(size - pad - dot, pad), (size - pad, pad + dot)],
        fill=(16, 185, 129, 255),
    )


def _base_icon(maskable=False):
    size = MASTER_SIZE
    base = _linear_gradient(size, (10, 18, 44), (29, 78, 216))
    base = Image.alpha_composite(base, _diagonal_overlay(size))

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        [(size * 0.16, size * 0.16), (size * 0.84, size * 0.84)],
        fill=(56, 189, 248, 68),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size * 0.08))
    base = Image.alpha_composite(base, glow)

    if not maskable:
        result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        rounding = int(size * 0.225)
        mask = Image.new("L", (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=rounding, fill=255)
        result.paste(base, (0, 0), mask)
        base = result

    safe_margin = 0.26 if maskable else 0.20
    _draw_chart_mark(base, safe_margin=safe_margin)
    return base


def _save_icon_set(base_image, sizes, suffix=""):
    resample = Image.Resampling.LANCZOS
    for s in sizes:
        out = base_image.resize((s, s), resample=resample)
        out.save(OUT_DIR / f"icon-{s}x{s}{suffix}.png", format="PNG", optimize=True)


def generate():
    standard = _base_icon(maskable=False)
    maskable = _base_icon(maskable=True)

    standard_sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512]
    _save_icon_set(standard, standard_sizes)
    _save_icon_set(maskable, [192, 512], suffix="-maskable")

    apple_icon = standard.resize((180, 180), resample=Image.Resampling.LANCZOS)
    apple_icon.save(OUT_DIR / "apple-touch-icon.png", format="PNG", optimize=True)

    mstile = standard.resize((150, 150), resample=Image.Resampling.LANCZOS)
    mstile.save(OUT_DIR / "mstile-150x150.png", format="PNG", optimize=True)

    favicon_base = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    _draw_favicon_mark(favicon_base)
    favicon_32 = favicon_base.resize((32, 32), resample=Image.Resampling.LANCZOS)
    favicon_16 = favicon_base.resize((16, 16), resample=Image.Resampling.LANCZOS)
    favicon_32.save(OUT_DIR / "favicon-32x32.png", format="PNG", optimize=True)
    favicon_16.save(OUT_DIR / "favicon-16x16.png", format="PNG", optimize=True)
    favicon_base.save(
        OUT_DIR / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


if __name__ == "__main__":
    generate()
    print("PWA icons generated in", OUT_DIR)
