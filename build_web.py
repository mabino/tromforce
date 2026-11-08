#!/usr/bin/env python3
"""Package a self-contained static app from the score source and web UI."""
import json
import shutil
from pathlib import Path
from generate_booklet import SONGS, PITCH, EXPANDED_MELODIES, OUT

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'dist'


def main():
    DIST.mkdir(exist_ok=True)
    for source in (ROOT / 'web').iterdir():
        if source.is_file():
            shutil.copy2(source, DIST / source.name)
    assets = DIST / 'assets'
    assets.mkdir(exist_ok=True)
    songs = []
    for i, s in enumerate(SONGS, 1):
        stem = f'{i:02d}_' + s[0].lower().replace("'", '').replace(' ', '_')
        exp = EXPANDED_MELODIES.get(s[0], s[4])
        songs.append(dict(id=i, title=s[0], mood=s[1], tempo=s[2], meter=s[3],
                          notes=[dict(pitch=p, midi=PITCH[p], beats=d) for p, d in s[4]],
                          expandedNotes=[dict(pitch=p, midi=PITCH[p], beats=d) for p, d in exp],
                          dynamic=s[5], tip=s[6], audio=stem+'.wav', score=stem+'.musicxml'))
        for suffix in ['.wav', '.musicxml', '.mid']:
            shutil.copy2(OUT / (stem+suffix), assets)
    for name in ['ocarina_trombone.pdf', 'ocarina_trombone_folded.pdf', 'ocarina_audio_examples.zip']:
        shutil.copy2(OUT / name, assets)
    (assets / 'songs.json').write_text(json.dumps(songs, indent=2)+'\n')
    print(f'Packaged {len(songs)} songs into {DIST}')


if __name__ == '__main__':
    main()
