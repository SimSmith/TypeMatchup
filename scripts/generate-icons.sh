#!/bin/sh
# Development-only tool: install Inkscape to regenerate PNGs from the SVG source.
set -eu
cd "$(dirname "$0")/.."
for size in 32 180 192 512; do
  case "$size" in
    32) output=icons/favicon-32.png ;;
    180) output=icons/apple-touch-icon.png ;;
    *) output="icons/icon-$size.png" ;;
  esac
  inkscape icons/icon.svg --export-type=png --export-width="$size" \
    --export-height="$size" --export-filename="$output"
done
