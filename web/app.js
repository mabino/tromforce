import {timeline, remainingEvents, activeNote} from './core.mjs';

const $ = id => document.getElementById(id);
const pitchSteps = {D3:4, F3:6, A3:8, B3:9, D4:11};
let songs = [], selected = 0, ctx, master, voices = [], animation;
let playing = false, offset = 0, startTime = 0, currentNote = -1;
let run = 0, plan, zoom = 100;
const saved = (() => {try {return JSON.parse(localStorage.getItem('tromforce') || localStorage.getItem('ocarina-room') || '{}');} catch {return {};}})();
const safe = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function persist() {
  try {localStorage.setItem('tromforce', JSON.stringify({selected, zoom, volume:$('volume').value, loop:$('loop').checked}));} catch {}
}

function renderScore(song) {
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
    <title id="score-title">${safe(song.title)} in bass clef</title>
    <desc id="score-desc">${song.meter} time. ${song.notes.map(n=>`${n.pitch}, ${n.beats} beats`).join('; ')}.</desc>
    <g stroke="#263c30" fill="#263c30" stroke-width="1.2">`];
  for(let i=0;i<5;i++) parts.push(`<path d="M25 ${160-i*12} H875"/>`);
  parts.push(`<path d="M43 124 C36 112 61 106 62 123 C66 139 50 150 40 154" fill="none" stroke-width="3"/>
    <circle cx="44" cy="124" r="3.5"/><circle cx="72" cy="118" r="2"/><circle cx="72" cy="130" r="2"/>
    <g font-family="Georgia,serif" font-size="23" stroke="none" text-anchor="middle"><text x="94" y="129">${barBeats}</text><text x="94" y="153">4</text></g>`);
  bars.forEach((notes,bi) => {
    const bx = 116+bi*374;
    parts.push(`<text x="${bx}" y="64" font-size="11" font-family="system-ui" stroke="none" fill="#7a867a">${bi+1}</text>`);
    const weights = notes.slice(0,-1).reduce((sum,n)=>sum+Math.sqrt(n.beats),0);
    let used=0;
    notes.forEach(n => {
      const x=bx+18+330*used/weights; used+=Math.sqrt(n.beats);
      const step=pitchSteps[n.pitch], y=160-step*6;
      parts.push(`<g class="note" data-index="${n.index}"><ellipse class="halo" cx="${x}" cy="${y}" rx="19" ry="15"/>`);
      for(let ledger=10;ledger<=step;ledger+=2) parts.push(`<path d="M${x-12} ${160-ledger*6} h24"/>`);
      parts.push(`<ellipse cx="${x}" cy="${y}" rx="7" ry="4.5" transform="rotate(-12 ${x} ${y})" ${n.beats===2?'fill="var(--paper)" stroke-width="1.7"':''}/>
        <path d="M${x-6} ${y+1} v43" stroke-width="1.5"/>`);
      if(n.beats===.5) parts.push(`<path d="M${x-6} ${y+44} C${x-24} ${y+37} ${x-21} ${y+28} ${x-12} ${y+20}" stroke-width="2" fill="none"/>`);
      if(n.beats===1.5) parts.push(`<circle cx="${x+14}" cy="${y-(step%2===0?6:0)}" r="1.8"/>`);
      parts.push(`</g><text x="${x}" y="222" text-anchor="middle" font-family="system-ui" font-size="14" stroke="none" fill="#63756b">${n.pitch}</text>`);
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
  $('title').textContent=song.title;
  $('mood').textContent=`${song.mood} · ${song.meter} time · call ${selected+1} of ${songs.length}`;
  $('category').textContent=selected<6?'THE OCARINA CALLS · SOLO TROMBONE':'THE WARP CALLS · SOLO TROMBONE';
  $('tip').textContent=song.tip; $('dynamic').textContent=song.dynamic;
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
    osc.frequency.value=440*2**((note.midi-69)/12);
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
    choose(Number.isInteger(saved.selected) && saved.selected>=0 && saved.selected<songs.length?saved.selected:0);
    for(const id of ['play','stop','previous','next','tempo','original-tempo']) $(id).disabled=false;
  } catch(error) {
    $('title').textContent='The songbook could not load'; $('status').textContent='Unavailable';
    $('error').textContent=`${error.message} Start the app with Docker Compose, then open http://localhost:8080.`;
    $('error').hidden=false;
  }
}
init();
