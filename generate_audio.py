#!/usr/bin/env python3
"""Create WAV examples and a self-contained browser player (standard library only)."""
import base64
import html
import io
import math
import struct
import wave
import zipfile
from generate_booklet import OUT, PITCH, SONGS

RATE = 22050


def render(song):
    tempo, notes = song[2], song[4]
    samples = bytearray(b'\0\0' * int(.25 * RATE))
    for pitch, beats in notes:
        duration = beats * 60 / tempo
        count = round(duration * RATE)
        frequency = 440 * 2 ** ((PITCH[pitch] - 69) / 12)
        for i in range(count):
            t = i / RATE
            # Gentle brass-like harmonic tone; a synthesized guide, not a sample.
            env = min(1, t / .025) * min(1, max(0, duration - t) / .055)
            signal = sum(math.sin(2 * math.pi * frequency * h * t) / h ** 1.5
                         for h in range(1, 9))
            samples.extend(struct.pack('<h', round(10000 * env * signal)))
    samples.extend(b'\0\0' * int(.65 * RATE))
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(samples)
    return buffer.getvalue()


def main():
    cards, paths = [], []
    for i, song in enumerate(SONGS, 1):
        stem = f'{i:02d}_' + song[0].lower().replace("'", '').replace(' ', '_')
        data = render(song)
        path = OUT / (stem + '.wav')
        path.write_bytes(data)
        paths.append(path)
        uri = 'data:audio/wav;base64,' + base64.b64encode(data).decode()
        cards.append(f'''<article><h2>{i:02d} &nbsp;{html.escape(song[0])}</h2>
<p>{song[2]} beats/min &middot; {song[3]} &middot; {song[5]}</p>
<audio controls preload="none" src="{uri}">Your browser needs WAV audio support.</audio>
</article>''')
    doc = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ocarina of Time — trombone examples</title>
<style>
body{margin:40px auto;padding:0 22px;max-width:850px;background:#f5f3ed;color:#20342e;
font:17px/1.5 system-ui,sans-serif}h1{line-height:1.15}header{margin-bottom:30px}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px}
article{background:white;border:1px solid #d5dcd5;border-radius:12px;padding:20px}
h2{font-size:19px;margin:0}p{font-size:14px}audio{width:100%}footer{margin:30px 0;font-size:13px}
</style><header><p>SOLO TROMBONE / LISTENING GUIDE</p>
<h1>Ocarina of Time</h1>
<p>Press the triangle on any player to hear that call. Starting another pauses the previous one.
These synthesized brass-like examples match the booklet's pitches, suggested rhythms and tempos;
they are not recordings of a real trombone or the original soundtrack.</p>
<p>Works offline. Each control also provides playback and volume options supported by your browser.</p>
</header><main>''' + '\n'.join(cards) + '''</main>
<footer>Original music: Koji Kondo. Unofficial short-call arrangements. Concert pitch D3–D4.</footer>
<script>document.querySelectorAll('audio').forEach(a=>a.addEventListener('play',()=>{
document.querySelectorAll('audio').forEach(b=>{if(b!==a)b.pause()});
}));</script></html>'''
    (OUT / 'listen.html').write_text(doc)
    with zipfile.ZipFile(OUT / 'ocarina_audio_examples.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in paths:
            archive.write(path, path.name)
    for path in paths:
        with wave.open(str(path)) as f:
            assert f.getnchannels() == 1 and f.getsampwidth() == 2
            assert f.getnframes() > RATE
    print('Created and checked 12 WAV examples, an audio ZIP, and a self-contained offline player.')


if __name__ == '__main__':
    main()
