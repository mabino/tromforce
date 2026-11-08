# Tromforce

A non-commercial, Zelda-inspired trombone practice app and printable songbook. Select a call, read the notation, and hear a synthesized example with adjustable tempo and note highlighting. Includes a fullscreen music stand view with spacing that adapts to the display.

Source repository: [mabino/trombforce](https://github.com/mabino/trombforce).

Twelve short ocarina input melodies, arranged in concert-pitch bass clef for solo B-flat tenor trombone. Range D3–D4, B-natural throughout. These are the familiar fixed calls, not the extended soundtrack pieces. Original music by Koji Kondo; game and music rights belong to their respective owners, including Nintendo. Unofficial fan arrangement.

## Docker practice app

Clone the project and start the app:

```sh
git clone https://github.com/mabino/trombforce.git
cd trombforce
docker compose up --build -d
```

Open **http://localhost:8080**. If your machine has the standalone Compose executable, use `docker-compose up --build -d` instead. Change the host port with `PORT=8090 docker compose up --build -d`. Stop with `docker compose down`.

The app currently displays only the first five calls: Zelda's Lullaby, Epona's Song, Saria's Song, Sun's Song, and Song of Time. Song navigation stays within that selection. The downloadable booklet and audio archive still contain the complete collection.

The image generates all twelve scores and listening assets during its build. No bind mounts, package installation, accounts, external fonts or runtime internet connection are needed. The server runs as a non-root user, with a read-only container filesystem. The initial image build needs access to pull the Python base image. Host port 8080 is published on all interfaces by default; bind `127.0.0.1:8080:8080` in Compose if you only want local access.

Features include song selection, enlarged SVG notation, a fullscreen practice view, pitch-preserving tempo adjustment, note highlighting, pause/resume, volume, and looping with a silent bar for breathing. **Space** plays/pauses, **left/right arrows** change calls, and **F** toggles fullscreen when focus is outside a control. **Escape** exits fullscreen. If browser fullscreen is unavailable, the button opens a focused reading layout. Increase Score size to enlarge notation; it scrolls horizontally and follows the highlighted note when necessary. Song selection, score size, volume and loop preference persist in that browser. Tempo changes restart the call.

For native fullscreen, use localhost or serve the app over HTTPS; browser permissions, embedded frames and some mobile browsers may restrict the Fullscreen API. Audio starts only after pressing Play. The app also provides WAV, MusicXML and PDF downloads, and works at a URL subpath when that path ends in `/`.

For a local preview without Docker:

```sh
python3 generate_booklet.py
python3 generate_audio.py
python3 build_web.py
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080 rather than opening `index.html` directly. Run the automated checks with `node --test tests/*.test.mjs` after generating `dist`. The browser UI is plain HTML/CSS/JavaScript with Web Audio; Node is only used for the optional tests.

## Files

- `output/ocarina_trombone.pdf`: 8 pages in reading order, half-letter portrait (5.5 × 8.5 inches).
- `output/ocarina_trombone_folded.pdf`: 4 US Letter landscape sides, imposed for two nested sheets. Print actual size, duplex, flip on the short edge; fold and staple. Do **not** enable the printer's booklet imposition again. Test the outer sheet first if your printer uses different duplex terminology.
- `output/*.musicxml`: editable scores, one per call; import into a notation editor.
- `output/*.mid`: one trombone MIDI rendering per call, using the same pitches and durations as the PDF.
- `output/songs.json`: machine-readable pitch and rhythm data.
- `output/listen.html`: self-contained offline audio player; open in a browser and press Play beside a song.
- `output/*.wav` and `output/ocarina_audio_examples.zip`: synthesized brass-like listening examples matching the booklet. Generate with `python3 generate_audio.py`; no third-party packages required. These are synthesized guides, not real trombone recordings.

## Generate

Run `python3 generate_booklet.py`. Python 3.9+; no third-party packages or network access required. PDFs contain vector staves, notes and clefs with standard PDF fonts. The folded version uses page order 8|1, 2|7, 6|3, 4|5.

## Editorial choices and sources

Pitch orders were checked against [Play Ocarina's twelve-song index](https://playocarina.com/songs/ocarina-of-time/), accessed November 8, 2026. The five relative pitches D, F, A, B, high D become D3, F3, A3, B3, D4. Pitch names under the staff identify octaves; C4 is middle C.

Rhythms, meters, dynamics, tempos and practice instructions are editorial suggestions for this short-call edition, not a note-for-note transcription of soundtrack timing. Each call occupies two complete measures. The MIDI and MusicXML follow these editorial settings. Scarecrow's Song is omitted because the player invents its melody.

The slide reference assumes a standard B-flat tenor trombone without using an attachment: D3 fourth, F3 first, A3 second, B3 fourth, D4 first. Position adjustments depend on instrument and intonation. Players who prefer a lower register can transpose the entire part down an octave in their notation editor.

## Rights and affiliation

The Legend of Zelda and Ocarina of Time, including their names, characters and associated game materials, are © Nintendo. Original game music composed by Koji Kondo. All rights reserved by Nintendo and the respective rights holders.

Tromforce is an unofficial, non-commercial fan work. It is not affiliated with, sponsored by, endorsed by or otherwise connected to Nintendo or any other rights holder. No ownership of the original game, music or trademarks is claimed.
