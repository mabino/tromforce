import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../web/core.mjs';

// Exercise the actual UI module with a small DOM/audio harness when a browser is unavailable.
const songs=JSON.parse(readFileSync(new URL('../dist/assets/songs.json',import.meta.url)));
const source=readFileSync(new URL('../web/app.js',import.meta.url),'utf8').replace(/^import .*;\n/,'');
function element(id='') {
  const handlers={}, attrs={}, classes=new Set();
  return {id,value:0,textContent:'',style:{},dataset:{},disabled:true,checked:false,hidden:true,scrollLeft:0,
    classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains(name){return classes.has(name);}},
    setAttribute(k,v){attrs[k]=v;},getAttribute(k){return attrs[k];},
    addEventListener(k,fn){handlers[k]=fn;},dispatchEvent(e){return handlers[e.type]?.(e);},
    querySelectorAll(selector){return selector==='button'?this.buttons??[]:this.notes??[];},
    querySelector(){return this.notes?.find(n=>n.classList.contains('active'));},
    getBoundingClientRect(){return {left:0,right:900,width:900};},
    set innerHTML(text){this.markup=text;this.notes=[...text.matchAll(/data-index="(\d+)"/g)].map(m=>{const n=element();n.dataset.index=m[1];return n;});this.buttons=[...text.matchAll(/data-song="(\d+)"/g)].map(m=>{const n=element();n.dataset.song=m[1];return n;});},
    get innerHTML(){return this.markup;}
  };
}
async function harness() {
  const nodes=new Map(), oscillators=[];let frame;
  const get=id=>{if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);};
  get('tempo').value=80;get('volume').value=60;get('zoom').value=100;
  class AudioContext {
    constructor(){this.currentTime=0;this.destination={};AudioContext.instance=this;}
    async resume(){}
    createGain(){return {connect(){},disconnect(){},gain:{setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}}};}
    createPeriodicWave(){return {};}
    createOscillator(){const osc={frequency:{},connect(){},setPeriodicWave(){},start(t){this.starts=t;},stop(t){this.stops=t;}};oscillators.push(osc);return osc;}
  }
  const document={getElementById:get,body:element(),documentElement:{},addEventListener(){}};
  const window={AudioContext,addEventListener(){}};
  vm.runInNewContext(source,{...core,document,window,localStorage:{getItem(){return null;},setItem(){}},fetch:async()=>({ok:true,json:async()=>songs}),requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame(){frame=null;},Event:class{constructor(type){this.type=type;}},console});
  await new Promise(resolve=>setImmediate(resolve));
  return {get,document,oscillators,context:()=>AudioContext.instance,frame:()=>frame?.()};
}

test('UI shows only the first five calls and wraps navigation within them',async()=>{
  const app=await harness();
  assert.equal(app.get('songs').buttons.length,5);
  assert.equal(app.get('title').textContent,"Zelda's Lullaby");
  assert.equal(app.get('score').notes.length,6);
  assert.equal(app.get('play').disabled,false);
  for(let i=0;i<5;i++) {
    assert.equal(app.get('title').textContent,songs[i].title);
    assert.equal(app.get('score').notes.length,songs[i].notes.length);
    assert.equal(app.get('wav').href,`assets/${songs[i].audio}`);
    app.get('next').dispatchEvent({type:'click'});
  }
  assert.equal(app.get('title').textContent,songs[0].title);
  app.get('previous').dispatchEvent({type:'click'});
  assert.equal(app.get('title').textContent,songs[4].title);
});

test('play, pause, resume, highlighting and reset use the same score timing',async()=>{
  const app=await harness();
  await app.get('play').dispatchEvent({type:'click'});
  assert.equal(app.oscillators.length,6);
  assert.equal(app.get('play').textContent,'Ⅱ Pause');
  assert.ok(Math.abs(app.oscillators[0].frequency.value-246.94165)<.001);
  app.context().currentTime=.55;app.frame();
  assert.equal(app.get('score').notes[0].classList.contains('active'),true);
  await app.get('play').dispatchEvent({type:'click'});
  assert.equal(app.get('status').textContent,'Paused');
  await app.get('play').dispatchEvent({type:'click'});
  assert.equal(app.get('play').textContent,'Ⅱ Pause');
  app.get('stop').dispatchEvent({type:'click'});
  assert.equal(app.get('progress').value,0);
  assert.equal(app.get('score').notes.some(n=>n.classList.contains('active')),false);
});

test('fullscreen falls back to a focused readable layout',async()=>{
  const app=await harness();
  await app.get('fullscreen').dispatchEvent({type:'click'});
  assert.equal(app.document.body.classList.contains('focus-mode'),true);
  await app.get('fullscreen').dispatchEvent({type:'click'});
  assert.equal(app.document.body.classList.contains('focus-mode'),false);
});

test('changing key to Bb adjusts note frequencies, range, signature, and tips',async()=>{
  const app=await harness();
  app.get('key-select').value='Bb';
  app.get('key-select').dispatchEvent({type:'change'});
  assert.equal(app.get('clef-range').textContent,'B♭2–B♭3');
  assert.equal(app.get('category').textContent,'THE OCARINA CALLS · KEY OF B♭');
  assert.ok(app.get('tip').textContent.includes('B♭3'));
  assert.ok(app.get('score').innerHTML.includes('♭'));
  await app.get('play').dispatchEvent({type:'click'});
  assert.ok(Math.abs(app.oscillators[0].frequency.value-195.9977)<0.01);
});
