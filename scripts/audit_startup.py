#!/usr/bin/env python3
"""Codex (OpenAI): measure a Vite --manifest build's required scripts and PWA precache.

Includes the sport's awaited dataset, not just static modulepreload files. gzip bytes
are a deterministic estimate, not a measured network compression ratio or load time.
"""
import argparse
import gzip
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('build_root', type=Path)
args = parser.parse_args()
root = args.build_root
manifest = json.loads((root / '.vite/manifest.json').read_text())
entry = next(k for k, v in manifest.items() if v.get('isEntry'))


def closure(roots):
    seen = set()

    def walk(key):
        if key in seen:
            return
        seen.add(key)
        for child in manifest[key].get('imports', []):
            walk(child)

    for key in roots:
        walk(key)
    return seen


def size(keys):
    files = [manifest[key]['file'] for key in sorted(keys)]
    bodies = [(root / file).read_bytes() for file in files]
    return {'bytes': sum(map(len, bodies)),
            'gzip': sum(len(gzip.compress(body, mtime=0)) for body in bodies),
            'files': files}


startup = {}
for sport in ['nba', 'nfl', 'soccer']:
    key = 'src/data/' + sport + '.json'
    startup[sport] = size(closure([entry] + ([key] if key in manifest else [])))
precache = json.loads(re.search(r'const PRECACHE = (.*);', (root / 'sw.js').read_text()).group(1))
paths = [root / ('index.html' if file == './' else file.removeprefix('./')) for file in precache]
print(json.dumps({'static': size(closure([entry])), 'startup': startup,
                  'precache': {'bytes': sum(p.stat().st_size for p in paths), 'files': len(paths)}}, indent=2))
