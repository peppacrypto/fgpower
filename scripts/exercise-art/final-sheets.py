#!/usr/bin/env python3
"""Contact sheets of the FINAL stills (out-final/<slug>/start.webp and end.webp), large enough to judge a pose.

  python3 final-sheets.py <slugs.txt> <dest dir> [--per 6]

Each cell: the start frame and the end frame side by side under the slug. Writes <dest>/page-001.png and so on.
"""
import os, sys
from PIL import Image, ImageDraw

slugs = [s for s in open(sys.argv[1]).read().split() if s]
dest = sys.argv[2]
per = int(sys.argv[sys.argv.index('--per') + 1]) if '--per' in sys.argv else 6
os.makedirs(dest, exist_ok=True)
FR = (480, 360)
COLS = 2
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out-final')
for n in range(0, len(slugs), per):
    page = slugs[n:n + per]
    rows = (len(page) + COLS - 1) // COLS
    cw, ch = 2 * FR[0] + 6, FR[1] + 18
    sheet = Image.new('RGB', (COLS * cw, rows * ch), '#ffffff')
    d = ImageDraw.Draw(sheet)
    for i, s in enumerate(page):
        x, y = (i % COLS) * cw, (i // COLS) * ch
        d.text((x + 4, y + 3), s, fill='#000000')
        for j, f in enumerate(['start', 'end']):
            p = os.path.join(root, s, f + '.webp')
            if os.path.exists(p):
                sheet.paste(Image.open(p).convert('RGB').resize(FR), (x + j * (FR[0] + 6), y + 18))
    sheet.save(os.path.join(dest, 'page-%03d.png' % (n // per + 1)))
print(len(range(0, len(slugs), per)), 'pages')
