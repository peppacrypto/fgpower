#!/usr/bin/env python3
"""Contact sheets of the rendered exercises, for review.

  python3 contact-sheet.py <out-dir> <dest-prefix> [--cols 4] [--per 24] [--only slug,slug]

Each cell shows the start and end frames side by side under the slug.
"""
import argparse
import json
import os

from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument('out')
ap.add_argument('dest')
ap.add_argument('--cols', type=int, default=3)
ap.add_argument('--per', type=int, default=18)
ap.add_argument('--only', default='')
ap.add_argument('--groups', default='')
a = ap.parse_args()

if a.only:
    slugs = a.only.split(',')
elif a.groups:
    slugs = [e['slug'] for e in json.load(open(a.groups))]
else:
    slugs = sorted(d for d in os.listdir(a.out) if os.path.exists(f'{a.out}/{d}/start.png'))

CELL_W = 2 * 320
CELL_H = 240 + 20
pages = [slugs[i : i + a.per] for i in range(0, len(slugs), a.per)]
for n, page in enumerate(pages):
    rows = (len(page) + a.cols - 1) // a.cols
    sheet = Image.new('RGB', (a.cols * CELL_W, rows * CELL_H), '#ffffff')
    d = ImageDraw.Draw(sheet)
    for i, s in enumerate(page):
        x = (i % a.cols) * CELL_W
        y = (i // a.cols) * CELL_H
        d.text((x + 6, y + 4), s, fill='#000000')
        for j, f in enumerate(['start', 'end']):
            p = f'{a.out}/{s}/{f}.png'
            if not os.path.exists(p):
                continue
            im = Image.open(p).convert('RGB').resize((318, 238))
            sheet.paste(im, (x + j * 320, y + 20))
    path = f'{a.dest}-{n + 1}.png'
    sheet.save(path)
    print(path, sheet.size, len(page))
