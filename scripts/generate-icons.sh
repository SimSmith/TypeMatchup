#!/bin/sh
# Development-only tool: regenerates the PNG and ICO icons from the SVG sources.
# Needs Inkscape and ImageMagick.
set -eu
cd "$(dirname "$0")/.."

export_png() { # <svg> <size> <output>
  inkscape "$1" --export-type=png --export-width="$2" --export-height="$2" \
    --export-filename="$3"
}

# Rounded tile: favicon and "any" app icons.
export_png icons/icon.svg 192 icons/icon-192.png
export_png icons/icon.svg 512 icons/icon-512.png

# Full-bleed square with safe-zone padding: maskable and Apple touch icons.
export_png icons/icon-maskable.svg 192 icons/icon-maskable-192.png
export_png icons/icon-maskable.svg 512 icons/icon-maskable-512.png
export_png icons/icon-maskable.svg 180 icons/apple-touch-icon.png

# Multi-size favicon.ico at the site root for browsers and tools that ask for it.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
for size in 16 32 48; do
  export_png icons/icon.svg "$size" "$tmp/$size.png"
done
if command -v magick >/dev/null 2>&1; then im=magick; else im=convert; fi
"$im" "$tmp/16.png" "$tmp/32.png" "$tmp/48.png" favicon.ico
