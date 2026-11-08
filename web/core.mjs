export function timeline(song, bpm) {
  const secondsPerBeat = 60 / bpm;
  let position = 0;
  const events = song.notes.map((note, index) => {
    const event = {...note, index, start: position, duration: note.beats * secondsPerBeat};
    position += event.duration;
    return event;
  });
  return {events, duration: position, breath: Number(song.meter.split('/')[0]) * secondsPerBeat};
}

export function remainingEvents(events, offset) {
  return events.filter(n => n.start + n.duration > offset).map(n => ({
    ...n, delay: Math.max(0, n.start - offset),
    remaining: n.duration - Math.max(0, offset - n.start)
  }));
}

export function activeNote(events, time) {
  return events.findIndex(n => time >= n.start && time < n.start + n.duration);
}
