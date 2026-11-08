import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {timeline, remainingEvents, activeNote} from '../web/core.mjs';
const songs=JSON.parse(readFileSync(new URL('../dist/assets/songs.json',import.meta.url)));

test('every call has two complete measures and a full bar for breathing',()=>{
  assert.equal(songs.length,12);
  for(const song of songs) {
    const beats=Number(song.meter.split('/')[0]);
    const plan=timeline(song,song.tempo);
    assert.equal(song.notes.reduce((sum,n)=>sum+n.beats,0),2*beats);
    assert.ok(Math.abs(plan.duration-2*beats*60/song.tempo)<1e-9);
    assert.ok(Math.abs(plan.breath-beats*60/song.tempo)<1e-9);
  }
});
test('slowing tempo doubles durations without changing pitches',()=>{
  const normal=timeline(songs[0],100),slow=timeline(songs[0],50);
  assert.equal(slow.duration,normal.duration*2);
  assert.deepEqual(slow.events.map(n=>n.midi),normal.events.map(n=>n.midi));
});
test('resume retains only the unplayed tail and subsequent notes',()=>{
  const plan=timeline(songs[0],60);
  const tail=remainingEvents(plan.events,1);
  assert.equal(tail[0].index,0); assert.equal(tail[0].remaining,.5); assert.equal(tail[0].delay,0);
  assert.equal(tail[1].index,1); assert.equal(tail[1].delay,.5);
  assert.equal(remainingEvents(plan.events,plan.duration).length,0);
});
test('highlights advance exactly at note boundaries and clear during breathing',()=>{
  const plan=timeline(songs[0],60);
  assert.equal(activeNote(plan.events,0),0);
  assert.equal(activeNote(plan.events,1.5),1);
  assert.equal(activeNote(plan.events,plan.duration),-1);
});
