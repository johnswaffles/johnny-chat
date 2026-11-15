"""Encode gallery art losslessly and prepare deterministic pixels for the puzzle compiler.

Requires Pillow. Original generated PNGs are kept outside the web bundle.
Usage: python prepare-gallery.py --raw-dir /tmp/color-gallery-pixels
"""
import argparse
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--raw-dir', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
art = root / 'public/color-studio/art'
raw = Path(args.raw_dir)
raw.mkdir(parents=True, exist_ok=True)
files = sorted({p.stem: p for p in art.glob('*-v3.webp') if not p.stem.endswith('-thumb')}.values())
files = list({p.stem: p for p in files + list(art.glob('*-v3.png'))}.values())
files += [art / 'alpine-retreat-v2.png']
for source in files:
    target = source.with_suffix('.webp')
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime and (raw / (source.stem + '.rgba')).exists():
        continue
    image = Image.open(source).convert('RGB')
    image.save(source.with_suffix('.webp'), lossless=True, method=6)
    thumb = image.copy()
    thumb.thumbnail((400, 400), Image.Resampling.LANCZOS)
    thumb.save(art / (source.stem + '-thumb.webp'), quality=92, method=6)
    # The built-in collection ships these exact checked canvases on every device.
    size = (600, 600)
    pixels = image.resize(size, Image.Resampling.BOX).convert('RGBA')
    (raw / (source.stem + '.rgba')).write_bytes(pixels.tobytes())
    print(source.stem, image.size, 'webp', source.with_suffix('.webp').stat().st_size)
