# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=11"]
# ///
"""Draw Repwise's app icons: a loaded barbell in bumper-plate colours.

Run from apps/mobile:  uv run scripts/make_icons.py
Writes assets/icon.png, the three Android adaptive icon layers, the splash icon and the
favicon. Drawn at 4x and scaled down for smooth edges.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "assets"
INK = (21, 26, 30, 255)
STEEL = (154, 163, 168, 255)
BLUE = (28, 88, 210, 255)
RED = (211, 53, 43, 255)
YELLOW = (227, 174, 14, 255)
EDGE = (21, 26, 30, 90)
SS = 4  # supersampling


def barbell(size: int, scale: float, color: tuple[int, int, int, int] | None = None) -> Image.Image:
    """A barbell centred on a transparent square; `scale` is its width as a share of size."""
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = big / 2
    w = big * scale  # bar length
    unit = w / 20

    def rect(x0: float, x1: float, half_h: float, fill: tuple[int, int, int, int]) -> None:
        d.rounded_rectangle(
            (x0, cy - half_h, x1, cy + half_h),
            radius=min(unit * 0.6, half_h),
            fill=color or fill,
            outline=None if color else EDGE,
            width=int(unit * 0.15) or 1,
        )

    # Bar, then plates from the centre outward on each side: blue (big), red, yellow, collar.
    rect(cx - w / 2, cx + w / 2, unit * 0.45, STEEL)
    plates = [(2.0, 4.6, BLUE), (1.6, 3.7, RED), (1.2, 2.8, YELLOW), (0.8, 1.2, STEEL)]
    for side in (-1, 1):
        x = cx + side * unit * 4.2
        for thickness, half_height, fill in plates:
            x0, x1 = sorted((x, x + side * unit * thickness))
            rect(x0, x1, unit * half_height, fill)
            x += side * (unit * thickness + unit * 0.25)
    return img.resize((size, size), Image.LANCZOS)


def on_background(size: int, scale: float, bg: tuple[int, int, int, int]) -> Image.Image:
    base = Image.new("RGBA", (size, size), bg)
    base.alpha_composite(barbell(size, scale))
    return base


def main() -> None:
    on_background(1024, 0.78, INK).convert("RGB").save(ASSETS / "icon.png")
    # Android adaptive icon: the foreground must sit inside the central 66% safe zone.
    barbell(1024, 0.58).save(ASSETS / "android-icon-foreground.png")
    Image.new("RGB", (1024, 1024), INK[:3]).save(ASSETS / "android-icon-background.png")
    barbell(1024, 0.58, color=(255, 255, 255, 255)).save(ASSETS / "android-icon-monochrome.png")
    barbell(1024, 0.8).save(ASSETS / "splash-icon.png")
    on_background(48, 0.84, INK).save(ASSETS / "favicon.png")
    print("icons written to", ASSETS)


if __name__ == "__main__":
    main()
