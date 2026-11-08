import {timeline, remainingEvents, activeNote} from './core.mjs';

const $ = id => document.getElementById(id);
const KEYS = {
  D: {
    label: 'D', range: 'D3–D4',
    slide: 'D3 fourth, F3 first, A3 second, B3 fourth, D4 first',
    sig: [],
    notes: {D3:{step:4,acc:'',midi:50,name:'D3'}, F3:{step:6,acc:'',midi:53,name:'F3'}, A3:{step:8,acc:'',midi:57,name:'A3'}, B3:{step:9,acc:'',midi:59,name:'B3'}, D4:{step:11,acc:'',midi:62,name:'D4'}}
  },
  Bb: {
    label: 'B♭', range: 'B♭2–B♭3',
    slide: 'B♭2 first, D♭3 fifth, F3 first, G3 fourth, B♭3 first',
    sig: [{glyph:'♭',x:78,y:153},{glyph:'♭',x:88,y:135}],
    notes: {D3:{step:2,acc:'',midi:46,name:'B♭2'}, F3:{step:4,acc:'♭',midi:49,name:'D♭3'}, A3:{step:6,acc:'',midi:53,name:'F3'}, B3:{step:7,acc:'',midi:55,name:'G3'}, D4:{step:9,acc:'',midi:58,name:'B♭3'}}
  },
  C: {
    label: 'C', range: 'C3–C4',
    slide: 'C3 sixth, E♭3 third, G3 fourth, A3 second, C4 third',
    sig: [{glyph:'♭',x:78,y:153},{glyph:'♭',x:88,y:135}],
    notes: {D3:{step:3,acc:'',midi:48,name:'C3'}, F3:{step:5,acc:'',midi:51,name:'E♭3'}, A3:{step:7,acc:'',midi:55,name:'G3'}, B3:{step:8,acc:'',midi:57,name:'A3'}, D4:{step:10,acc:'',midi:60,name:'C4'}}
  },
  Eb: {
    label: 'E♭', range: 'E♭3–E♭4',
    slide: 'E♭3 third, G♭3 fifth, B♭3 first, C4 third, E♭4 third',
    sig: [{glyph:'♭',x:77,y:153},{glyph:'♭',x:86,y:135},{glyph:'♭',x:95,y:117}],
    notes: {D3:{step:5,acc:'',midi:51,name:'E♭3'}, F3:{step:7,acc:'♭',midi:54,name:'G♭3'}, A3:{step:9,acc:'',midi:58,name:'B♭3'}, B3:{step:10,acc:'',midi:60,name:'C4'}, D4:{step:12,acc:'',midi:63,name:'E♭4'}}
  },
  F: {
    label: 'F', range: 'F2–F3',
    slide: 'F2 first, A♭2 third, C3 sixth, D3 fourth, F3 first',
    sig: [{glyph:'♭',x:78,y:153}],
    notes: {D3:{step:-1,acc:'',midi:41,name:'F2'}, F3:{step:1,acc:'♭',midi:44,name:'A♭2'}, A3:{step:3,acc:'',midi:48,name:'C3'}, B3:{step:4,acc:'',midi:50,name:'D3'}, D4:{step:6,acc:'',midi:53,name:'F3'}}
  },
  G: {
    label: 'G', range: 'G2–G3',
    slide: 'G2 fourth, B♭2 first, D3 fourth, E3 second, G3 fourth',
    sig: [{glyph:'♭',x:78,y:153}],
    notes: {D3:{step:0,acc:'',midi:43,name:'G2'}, F3:{step:2,acc:'',midi:46,name:'B♭2'}, A3:{step:4,acc:'',midi:50,name:'D3'}, B3:{step:5,acc:'',midi:52,name:'E3'}, D4:{step:7,acc:'',midi:55,name:'G3'}}
  },
  A: {
    label: 'A', range: 'A2–A3',
    slide: 'A2 second, C3 sixth, E3 second, F♯3 fifth, A3 second',
    sig: [{glyph:'♯',x:78,y:129}],
    notes: {D3:{step:1,acc:'',midi:45,name:'A2'}, F3:{step:3,acc:'',midi:48,name:'C3'}, A3:{step:5,acc:'',midi:52,name:'E3'}, B3:{step:6,acc:'',midi:54,name:'F♯3'}, D4:{step:8,acc:'',midi:57,name:'A3'}}
  }
};
const pitchSteps = {D3:4, F3:6, A3:8, B3:9, D4:11};
let songs = [], selected = 0, ctx, master, voices = [], animation;
let playing = false, offset = 0, startTime = 0, currentNote = -1;
let run = 0, plan, zoom = 100;
const saved = (() => {try {return JSON.parse(localStorage.getItem('tromforce') || localStorage.getItem('ocarina-room') || '{}');} catch {return {};}})();
let currentKey = (saved.key && KEYS[saved.key]) ? saved.key : 'D';
const safe = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function persist() {
  try {localStorage.setItem('tromforce', JSON.stringify({selected, zoom, key:currentKey, volume:$('volume').value, loop:$('loop').checked}));} catch {}
}

function updateKeyUI() {
  const k = KEYS[currentKey] || KEYS.D;
  if($('key-select')) $('key-select').value = currentKey;
  if($('clef-range')) $('clef-range').textContent = k.range;
  if($('slide-guide')) $('slide-guide').textContent = `Slide guide: ${k.slide}. Adjust by ear.`;
}

function updateSongInfo(song) {
  const k = KEYS[currentKey] || KEYS.D;
  $('title').textContent = song.title;
  $('mood').textContent = `${song.mood} · ${song.meter} time · call ${selected+1} of ${songs.length}`;
  $('category').textContent = `${selected<6?'THE OCARINA CALLS':'THE WARP CALLS'} · KEY OF ${k.label}`;
  $('tip').textContent = song.tip.replace(/\b(D3|F3|A3|B3|D4)\b/g, m => k.notes[m]?.name || m);
  $('dynamic').textContent = song.dynamic;
}

function changeKey(key) {
  if(!KEYS[key] || key === currentKey) return;
  currentKey = key;
  const resume = playing;
  reset();
  updateKeyUI();
  if(songs[selected]) {
    updateSongInfo(songs[selected]);
    renderScore(songs[selected]);
  }
  persist();
  if(resume) play();
}

function renderScore(song) {
  const k = KEYS[currentKey] || KEYS.D;
  const barBeats = Number(song.meter.split('/')[0]);
  const bars = [[], []];
  let beat = 0, bar = 0;
  song.notes.forEach((note,index) => {
    bars[bar].push({...note,index});
    beat += note.beats;
    if (Math.abs(beat-barBeats) < 0.001) {bar++; beat=0;}
  });
  const viewBox=document.body.classList.contains('focus-mode')?'0 48 900 190':'0 0 900 260';
  const parts = [`<svg viewBox="${viewBox}" role="img" aria-labelledby="score-title score-desc">
    <title id="score-title">${safe(song.title)} in bass clef (${k.label})</title>
    <desc id="score-desc">${song.meter} time. Key of ${k.label}. ${song.notes.map(n=>`${k.notes[n.pitch]?.name||n.pitch}, ${n.beats} beats`).join('; ')}.</desc>
    <g stroke="#263c30" fill="#263c30" stroke-width="1.2">`];
  for(let i=0;i<5;i++) parts.push(`<path d="M25 ${160-i*12} H875"/>`);
  parts.push(`<path d="M43 124 C36 112 61 106 62 123 C66 139 50 150 40 154" fill="none" stroke-width="3"/>
    <circle cx="44" cy="124" r="3.5"/><circle cx="72" cy="118" r="2"/><circle cx="72" cy="130" r="2"/>`);
  (k.sig || []).forEach(s => {
    parts.push(`<text x="${s.x}" y="${s.y}" font-size="${s.glyph==='♭'?21:18}" font-family="Georgia,serif" font-weight="bold" stroke="none" fill="#263c30">${s.glyph}</text>`);
  });
  const timeX = (k.sig && k.sig.length) ? (75 + k.sig.length * 10 + 10) : 94;
  parts.push(`<g font-family="Georgia,serif" font-size="23" stroke="none" text-anchor="middle"><text x="${timeX}" y="129">${barBeats}</text><text x="${timeX}" y="153">4</text></g>`);
  bars.forEach((notes,bi) => {
    const bx = 116+bi*374;
    parts.push(`<text x="${bx}" y="64" font-size="11" font-family="system-ui" stroke="none" fill="#7a867a">${bi+1}</text>`);
    const weights = notes.slice(0,-1).reduce((sum,n)=>sum+Math.sqrt(n.beats),0);
    let used=0;
    notes.forEach(n => {
      const x=bx+18+330*used/weights; used+=Math.sqrt(n.beats);
      const noteInfo = k.notes[n.pitch] || {step: pitchSteps[n.pitch] || 4, acc: '', midi: n.midi};
      const step=noteInfo.step, y=160-step*6;
      parts.push(`<g class="note" data-index="${n.index}"><ellipse class="halo" cx="${x}" cy="${y}" rx="19" ry="15"/>`);
      if(step>=10) {
        for(let ledger=10;ledger<=step;ledger+=2) parts.push(`<path d="M${x-12} ${160-ledger*6} h24"/>`);
      }
      if(step<0) {
        for(let ledger=-2;ledger>=step;ledger-=2) parts.push(`<path d="M${x-12} ${160-ledger*6} h24"/>`);
      }
      if(noteInfo.acc==='♭') {
        parts.push(`<text x="${x-13}" y="${y+6}" font-size="20" font-family="Georgia,serif" font-weight="bold" stroke="none" fill="#263c30">♭</text>`);
      } else if(noteInfo.acc==='♯') {
        parts.push(`<text x="${x-13}" y="${y+5}" font-size="16" font-family="Georgia,serif" stroke="none" fill="#263c30">♯</text>`);
      }
      parts.push(`<ellipse cx="${x}" cy="${y}" rx="7" ry="4.5" transform="rotate(-12 ${x} ${y})" ${n.beats===2?'fill="var(--paper)" stroke-width="1.7"':''}/>
        <path d="M${x-6} ${y+1} v43" stroke-width="1.5"/>`);
      if(n.beats===.5) parts.push(`<path d="M${x-6} ${y+44} C${x-24} ${y+37} ${x-21} ${y+28} ${x-12} ${y+20}" stroke-width="2" fill="none"/>`);
      if(n.beats===1.5) parts.push(`<circle cx="${x+14}" cy="${y-(step%2===0?6:0)}" r="1.8"/>`);
      parts.push('</g>');
    });
    const boundary=116+(bi+1)*374;
    parts.push(`<path d="M${boundary} 112 V160"/>`);
  });
  parts.push('<path d="M870 112 V160" stroke-width="3"/></g></svg>');
  $('score').innerHTML=parts.join('');
  currentNote=-1;
}

function highlight(index) {
  if(index===currentNote) return;
  currentNote=index;
  $('score').querySelectorAll('.note').forEach(n => n.classList.toggle('active',Number(n.dataset.index)===index));
  const active=$('score').querySelector('.active');
  if(active) {
    const scroll=$('score-scroll'), rect=active.getBoundingClientRect(), box=scroll.getBoundingClientRect();
    if(rect.right>box.right-20 || rect.left<box.left+20) scroll.scrollLeft += rect.left-box.left-box.width/2;
  }
}

function silence() {
  voices.forEach(node=>{try {node.stop();} catch {}});
  voices=[];
  cancelAnimationFrame(animation);
}

function reset() {
  run++; playing=false; offset=0; silence(); highlight(-1);
  $('play').textContent='▶ Play call'; $('status').textContent='Ready'; $('progress').value=0;
}

function choose(index) {
  reset(); selected=((index%songs.length)+songs.length)%songs.length;
  const song=songs[selected];
  updateSongInfo(song);
  $('tempo').value=song.tempo; $('tempo-value').textContent=`${song.tempo} BPM`;
  $('wav').href=`assets/${song.audio}`; $('xml').href=`assets/${song.score}`;
  $('songs').querySelectorAll('button').forEach((button,i)=>button.setAttribute('aria-current',String(i===selected)));
  renderScore(song); $('score-scroll').scrollLeft=0; persist();
}

async function play() {
  if(playing) {
    offset=ctx.currentTime-startTime; playing=false; run++; silence();
    $('play').textContent='▶ Resume'; $('status').textContent='Paused'; return;
  }
  const token=++run;
  try {
    if(!ctx) {
      const AudioContext=window.AudioContext || window.webkitAudioContext;
      if(!AudioContext) throw new Error('This browser does not support synthesized playback. Download the WAV example below.');
      ctx=new AudioContext(); master=ctx.createGain(); master.connect(ctx.destination);
    }
    await ctx.resume();
    if(token!==run) return;
    master.gain.value=Number($('volume').value)/100*.22;
    plan=timeline(songs[selected],Number($('tempo').value));
    if(offset>=plan.duration) offset=0;
    playing=true; $('error').hidden=true; $('play').textContent='Ⅱ Pause';
    startTime=ctx.currentTime+.05-offset;
    schedule(offset);
    animation=requestAnimationFrame(tick);
  } catch(error) {
    reset(); $('error').textContent=error.message; $('error').hidden=false;
  }
}

function schedule(from) {
  const realStart=startTime+from;
  const k=KEYS[currentKey] || KEYS.D;
  remainingEvents(plan.events,from).forEach(note => {
    const at=realStart+note.delay, duration=note.remaining;
    const gain=ctx.createGain(); gain.connect(master);
    gain.gain.setValueAtTime(0,at);
    gain.gain.linearRampToValueAtTime(1,at+Math.min(.025,duration/4));
    gain.gain.setValueAtTime(1,at+duration-Math.min(.055,duration/3));
    gain.gain.linearRampToValueAtTime(0,at+duration);
    const osc=ctx.createOscillator();
    const real=new Float32Array(9), imag=new Float32Array(9);
    for(let h=1;h<=8;h++) imag[h]=1/Math.pow(h,1.5);
    osc.setPeriodicWave(ctx.createPeriodicWave(real,imag));
    const noteInfo=k.notes[note.pitch] || {midi:note.midi};
    osc.frequency.value=440*2**((noteInfo.midi-69)/12);
    osc.connect(gain); osc.start(at); osc.stop(at+duration);
    osc.onended=()=>gain.disconnect(); voices.push(osc);
  });
}

function tick() {
  if(!playing) return;
  const elapsed=Math.max(0,ctx.currentTime-startTime);
  $('progress').value=Math.min(1,elapsed/plan.duration);
  highlight(activeNote(plan.events,elapsed));
  $('status').textContent=elapsed>=plan.duration?'Breathe…':'Playing';
  if(elapsed>=plan.duration && !$('loop').checked) {
    reset(); $('progress').value=1; $('status').textContent='Finished'; return;
  }
  if(elapsed>=plan.duration+plan.breath) {
    silence(); offset=0; startTime=ctx.currentTime+.03; schedule(0);
  }
  animation=requestAnimationFrame(tick);
}

function updateZoom() {
  zoom=Number($('zoom').value); $('zoom-value').textContent=`${zoom}%`;
  $('score').style.width=`${zoom}%`; persist();
}

function focusUI(active) {
  document.body.classList.toggle('focus-mode',active);
  const score=$('score').querySelector('svg');
  if(score) score.setAttribute('viewBox',active?'0 48 900 190':'0 0 900 260');
  $('fullscreen').setAttribute('aria-pressed',String(active));
  $('fullscreen').textContent=active?'⛶ Exit full screen':'⛶ Full screen';
}

async function fullscreen() {
  if(document.fullscreenElement) {try {await document.exitFullscreen();} catch {} return;}
  if(document.body.classList.contains('focus-mode')) {focusUI(false); return;}
  focusUI(true);
  if(document.documentElement.requestFullscreen) {
    try {await document.documentElement.requestFullscreen();} catch { /* Retain readable focus mode. */ }
  }
}

$('play').addEventListener('click',play); $('stop').addEventListener('click',reset);
$('previous').addEventListener('click',()=>choose(selected-1)); $('next').addEventListener('click',()=>choose(selected+1));
$('fullscreen').addEventListener('click',fullscreen);
document.addEventListener('fullscreenchange',()=>focusUI(Boolean(document.fullscreenElement)));
$('zoom').addEventListener('input',updateZoom);
$('tempo').addEventListener('input',()=>{
  const resume=playing; reset(); $('tempo-value').textContent=`${$('tempo').value} BPM`; if(resume) play();
});
$('original-tempo').addEventListener('click',()=>{
  $('tempo').value=songs[selected].tempo; $('tempo').dispatchEvent(new Event('input'));
});
$('volume').addEventListener('input',()=>{
  $('volume-value').textContent=`${$('volume').value}%`;
  if(master) master.gain.setTargetAtTime(Number($('volume').value)/100*.22,ctx.currentTime,.02);
  persist();
});
$('loop').addEventListener('change',persist);
if($('key-select')) {
  $('key-select').addEventListener('change',()=>changeKey($('key-select').value));
  $('key-select').addEventListener('input',()=>changeKey($('key-select').value));
}
document.addEventListener('keydown',event=>{
  if(['INPUT','TEXTAREA','SELECT','BUTTON','A','SUMMARY'].includes(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
  if(event.code==='Space' && songs.length) {event.preventDefault(); play();}
  else if(event.key==='ArrowRight' && songs.length) {event.preventDefault(); choose(selected+1);}
  else if(event.key==='ArrowLeft' && songs.length) {event.preventDefault(); choose(selected-1);}
  else if(event.key.toLowerCase()==='f') {event.preventDefault(); fullscreen();}
  else if(event.key==='Escape' && !document.fullscreenElement) focusUI(false);
});
window.addEventListener('pagehide',reset);

async function init() {
  try {
    const response=await fetch('assets/songs.json');
    if(!response.ok) throw new Error(`Could not load the songbook (${response.status}).`);
    songs=await response.json();
    if(!Array.isArray(songs) || songs.length<5) throw new Error('The songbook data is incomplete. Rebuild the app.');
    songs=songs.slice(0,5);
    $('songs').innerHTML=songs.map((song,i)=>`<button type="button" data-song="${i}"><span>${String(i+1).padStart(2,'0')}</span>${safe(song.title)}</button>`).join('');
    $('songs').addEventListener('click',event=>{
      const button=event.target.closest('button[data-song]'); if(button) choose(Number(button.dataset.song));
    });
    $('zoom').value=Number.isFinite(saved.zoom)?saved.zoom:100; updateZoom();
    $('volume').value=saved.volume??60; $('volume').dispatchEvent(new Event('input'));
    $('loop').checked=Boolean(saved.loop);
    updateKeyUI();
    choose(Number.isInteger(saved.selected) && saved.selected>=0 && saved.selected<songs.length?saved.selected:0);
    for(const id of ['play','stop','previous','next','tempo','original-tempo']) $(id).disabled=false;
  } catch(error) {
    $('title').textContent='The songbook could not load'; $('status').textContent='Unavailable';
    $('error').textContent=`${error.message} Start the app with Docker Compose, then open http://localhost:8080.`;
    $('error').hidden=false;
  }
}
init();
