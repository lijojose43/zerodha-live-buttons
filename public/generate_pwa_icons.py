#!/usr/bin/env python3
"""Generate production-ready PWA icons for this app.

Master art is `zerodha-live-butttons.png` — the blue Zerodha "Live" squircle
brand mark, drawn on transparency.

Two renderings come off that one master:

  * squircle   — the mark over transparency. Used for standard PWA icons and
                 browser favicons, where the transparent corners let the
                 mark's own shape show through.
  * full-bleed — the mark over a background sampled from the mark's own left
                 edge, so the square corners continue its colour instead of
                 showing a seam. Used where the platform expects an opaque
                 square: Android maskable icons, the iOS touch icon and the
                 Windows tile.
"""

from pathlib import Path

from PIL import Image

OUT_DIR = Path(__file__).resolve().parent
MASTER_FILE = OUT_DIR / "zerodha-live-butttons.png"

# Fraction of the canvas taken by the mark itself.
SQUIRCLE_FILL = 0.92  # standard "any" icons — nearly edge to edge
SAFE_FILL = 0.72      # maskable — Android's safe zone is the centre 80%
BLEED_FILL = 0.92     # apple-touch icon and Windows tile
FAVICON_FILL = 0.97   # favicons are tiny; give the mark all the room it can get

STANDARD_SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]
MASKABLE_SIZES = [192, 512]
APPLE_SIZE = 180
MSTILE_SIZE = 150
FAVICON_SIZES = [16, 32, 48]  # 16/32 are written on their own, 48 feeds the .ico
LOGO_SIZE = 128             # in-app brand mark (navbars, footers)

_master = None


def _master_art():
    """The master PNG cropped to its opaque mark (fringe included)."""
    global _master
    if _master is None:
        img = Image.open(MASTER_FILE).convert("RGBA")
        alpha = img.getchannel("A")
        bbox = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
        _master = img.crop(bbox) if bbox else img
    return _master


def _mark(fill, size):
    """Brand mark scaled so its width takes `fill` of an SxS canvas."""
    art = _master_art()
    width = max(1, round(size * fill))
    height = max(1, round(width * art.height / art.width))
    return art.resize((width, height), Image.Resampling.LANCZOS)


def _edge_gradient(size):
    """Vertical gradient lifted from the mark's own top and bottom edges.

    Reading the colours off the mark — rather than inventing a flat blue —
    keeps a full-bleed background continuous with the mark pasted on top.
    Never sample the corners: the "Live" pill reaches the bottom edge, so the
    mark is not a clean blue square and a corner-derived gradient would leak
    red into the background.
    """
    art = _master_art()
    gradient = Image.new("RGB", (1, 2))
    gradient.putpixel((0, 0), art.getpixel((art.width // 2, 0))[:3])
    gradient.putpixel((0, 1), art.getpixel((art.width // 2, art.height - 1))[:3])
    return gradient.resize((size, size), Image.Resampling.BILINEAR).convert("RGBA")


def _squircle(size, fill):
    """Mark on transparency, centred."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mark = _mark(fill, size)
    canvas.paste(mark, ((size - mark.width) // 2, (size - mark.height) // 2), mark)
    return canvas


def _full_bleed(size, fill):
    """Mark over an opaque square that continues its edge tones."""
    canvas = _edge_gradient(size)
    mark = _mark(fill, size)
    canvas.paste(mark, ((size - mark.width) // 2, (size - mark.height) // 2), mark)
    return canvas


def _save(img, name):
    img.save(OUT_DIR / name, format="PNG", optimize=True)
    print("wrote", name)


def generate():
    for s in STANDARD_SIZES:
        _save(_squircle(s, SQUIRCLE_FILL), f"icon-{s}x{s}.png")

    for s in MASKABLE_SIZES:
        _save(_full_bleed(s, SAFE_FILL), f"icon-{s}x{s}-maskable.png")

    _save(_full_bleed(APPLE_SIZE, BLEED_FILL), "apple-touch-icon.png")
    _save(_full_bleed(MSTILE_SIZE, BLEED_FILL), "mstile-150x150.png")

    for s in FAVICON_SIZES[:2]:
        _save(_squircle(s, FAVICON_FILL), f"favicon-{s}x{s}.png")

    # Small transparent copy of the mark for the app navbar and page footers,
    # so the in-UI brand badge and the installed icon stay identical.
    _save(_squircle(LOGO_SIZE, SQUIRCLE_FILL), "logo-mark.png")

    # The .ico bundles 16/32/48 from the same mark.
    _squircle(48, FAVICON_FILL).save(
        OUT_DIR / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print("wrote favicon.ico")


if __name__ == "__main__":
    generate()
