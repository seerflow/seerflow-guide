#!/usr/bin/env python3
"""Convert the brand OKLCH tokens to sRGB hex for the --sf-hex-* mirror.

Pure-math OKLab->linear-sRGB (no third-party deps). Run once; paste the
printed CSS block into tokens.css. The mirror exists because Plotly/canvas
cannot parse oklch().
"""
from __future__ import annotations
import math

# token name -> (L, C, hue_degrees), grouped by scheme
DARK = {
    "bg": (0.145, 0.012, 250), "surface": (0.175, 0.012, 250),
    "surface-2": (0.205, 0.014, 250), "line": (0.275, 0.012, 250),
    "line-2": (0.345, 0.012, 250), "text": (0.965, 0.005, 250),
    "text-2": (0.795, 0.008, 250), "text-3": (0.620, 0.010, 250),
    "accent": (0.745, 0.130, 283), "accent-2": (0.620, 0.140, 283),
    "warn": (0.815, 0.155, 80), "crit": (0.725, 0.195, 25),
    "info": (0.795, 0.115, 235),
}
# Light values for warn/info/text-3 are darkened vs the brand source so small
# uppercase mono labels (admonition titles, table headers) clear WCAG AA (4.5:1)
# on the light surfaces. Dark scheme already passes, so it is unchanged.
LIGHT = {
    "bg": (0.985, 0.003, 95), "surface": (0.965, 0.004, 95),
    "surface-2": (0.935, 0.005, 95), "line": (0.895, 0.006, 95),
    "line-2": (0.815, 0.008, 95), "text": (0.205, 0.014, 250),
    "text-2": (0.405, 0.012, 250), "text-3": (0.510, 0.010, 250),
    "accent": (0.480, 0.180, 283), "accent-2": (0.395, 0.180, 283),
    "warn": (0.540, 0.165, 65), "crit": (0.555, 0.215, 26),
    "info": (0.520, 0.150, 235),
}

# CSS-only tokens (no JS/canvas consumer → intentionally excluded from the hex
# mirror): --surface-3, --mute, --accent-ink. Add here if a chart ever needs them.


def _lin_to_srgb(c: float) -> float:
    c = max(0.0, min(1.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def oklch_to_hex(L: float, C: float, h_deg: float) -> str:
    h = math.radians(h_deg)
    a, b = C * math.cos(h), C * math.sin(h)
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
    g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
    bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_
    rgb = (round(_lin_to_srgb(r) * 255), round(_lin_to_srgb(g) * 255),
           round(_lin_to_srgb(bl) * 255))
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def emit(name: str, table: dict[str, tuple[float, float, float]]) -> None:
    print(f"  /* {name} hex mirror */")
    for token, (L, C, h) in table.items():
        print(f"  --sf-hex-{token}: {oklch_to_hex(L, C, h)};")


if __name__ == "__main__":
    print("DARK:")
    emit("dark", DARK)
    print("\nLIGHT:")
    emit("light", LIGHT)
