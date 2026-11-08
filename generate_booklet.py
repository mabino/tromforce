#!/usr/bin/env python3
"""Build vector PDF scores, folded booklet, MusicXML and MIDI using Python 3 only."""
from pathlib import Path
import json, math, struct, zipfile
from xml.etree import ElementTree as ET

OUT = Path(__file__).resolve().parent / 'output'
OUT.mkdir(exist_ok=True)
# Durations are quarter-note beats. Rhythms/tempos are editorial practice settings.
SONGS = [
 ("Zelda's Lullaby", 'Gentle and singing', 76, '4/4', [('B3',1.5),('D4',.5),('A3',2),('B3',1.5),('D4',.5),('A3',2)], 'mp', 'Keep the air moving through the rise to D4.'),
 ("Epona's Song", 'Warm and open', 84, '4/4', [('D4',1),('B3',1),('A3',2)]*2, 'mf', 'Let the descending line relax without losing support.'),
 ("Saria's Song", 'Light and playful', 104, '2/4', [('F3',.5),('A3',.5),('B3',1)]*2, 'mf', 'Use a light tongue; keep the eighth notes even.'),
 ("Sun's Song", 'Bright and buoyant', 108, '4/4', [('A3',1.5),('F3',.5),('D4',2)]*2, 'mf', 'Prepare the leap from F3 to D4 with steady air.'),
 ("Song of Time", 'Broad and steady', 68, '4/4', [('A3',1),('D3',1),('F3',2)]*2, 'mp', 'Center the low D3 before returning to F3.'),
 ("Song of Storms", 'Flowing, in three', 112, '3/4', [('D3',.5),('F3',.5),('D4',2)]*2, 'mf', 'Keep the octave leap clean; avoid a slide scoop.'),
 ("Minuet of Forest", 'Poised and lyrical', 88, '4/4', [('D3',1),('D4',1),('B3',1),('A3',1),('B3',2),('A3',2)], 'mp', 'Hear the octave before playing; soften the ending.'),
 ("Bolero of Fire", 'Firm and rhythmic', 96, '4/4', [('F3',1),('D3',1),('F3',1),('D3',1),('A3',1),('F3',1),('A3',1),('F3',1)], 'mf', 'Give all eight quarter notes the same rhythmic weight.'),
 ("Serenade of Water", 'Calm and connected', 72, '4/4', [('D3',1),('F3',1),('A3',2),('A3',2),('B3',2)], 'p', 'Retongue the repeated A3 gently and sustain the B3.'),
 ("Requiem of Spirit", 'Spacious and solemn', 64, '4/4', [('D3',1),('F3',1),('D3',2),('A3',1),('F3',1),('D3',2)], 'mp', 'Keep a full tone on the final descent to D3.'),
 ("Nocturne of Shadow", 'Quiet and mysterious', 66, '4/4', [('B3',1),('A3',1),('A3',2),('D3',.5),('B3',.5),('A3',1),('F3',2)], 'p', 'Separate the two A3s; support the return from D3.'),
 ("Prelude of Light", 'Clear and radiant', 92, '4/4', [('D4',2),('A3',1),('D4',1),('A3',1),('B3',1),('D4',2)], 'mf', 'Keep the final D4 resonant; release together with the air.'),
]
PITCH = {
 'E2':40,'F2':41,'G2':43,'A2':45,'B2':47,
 'C3':48,'D3':50,'E3':52,'F3':53,'G3':55,'A3':57,'B3':59,
 'C4':60,'D4':62,'E4':64,'F4':65,'G4':67
}
STEPS = {
 'E2':-2,'F2':-1,'G2':0,'A2':1,'B2':2,
 'C3':3,'D3':4,'E3':5,'F3':6,'G3':7,'A3':8,'B3':9,
 'C4':10,'D4':11,'E4':12,'F4':13,'G4':14
}

EXPANDED_MELODIES = {
 "Zelda's Lullaby": [('B3',1.5),('D4',.5),('A3',2), ('B3',1.5),('D4',.5),('A3',2), ('B3',1.5),('D4',.5),('E4',1),('D4',1), ('A3',1),('G3',1),('F3',1),('D3',1), ('B3',1.5),('D4',.5),('A3',2), ('B3',1.5),('D4',.5),('A3',2), ('B3',1.5),('D4',.5),('E4',1),('D4',1), ('A3',4)],
 "Epona's Song": [('D4',1),('B3',1),('A3',2), ('D4',1),('B3',1),('A3',2), ('D4',1),('B3',1),('A3',1),('B3',1), ('A3',4), ('D4',1),('B3',1),('A3',2), ('D4',1),('B3',1),('A3',2), ('D4',1),('B3',1),('A3',1),('B3',1), ('D4',4)],
 "Saria's Song": [('F3',.5),('A3',.5),('B3',1), ('F3',.5),('A3',.5),('B3',1), ('F3',.5),('A3',.5),('B3',.5),('E4',.5), ('D4',1),('B3',.5),('C4',.5), ('B3',.5),('G3',.5),('E3',1), ('D3',.5),('E3',.5),('G3',.5),('E3',.5), ('D3',2), ('D3',2)],
 "Sun's Song": [('A3',1.5),('F3',.5),('D4',2), ('A3',1.5),('F3',.5),('D4',2), ('A3',.5),('B3',.5),('C4',.5),('D4',.5),('E4',2), ('D4',1),('C4',1),('B3',1),('A3',1), ('A3',1.5),('F3',.5),('D4',2), ('D4',4)],
 "Song of Time": [('A3',1),('D3',1),('F3',2), ('A3',1),('D3',1),('F3',2), ('A3',1),('C4',1),('B3',1),('G3',1), ('F3',1),('G3',1),('A3',1),('D3',1), ('C3',1),('E3',1),('D3',2), ('A3',1),('D3',1),('F3',2), ('A3',1),('D3',1),('F3',2), ('D3',4)],
 "Song of Storms": [('D3',.5),('F3',.5),('D4',2), ('D3',.5),('F3',.5),('D4',2), ('E4',1.5),('F4',.5),('E4',.5),('F4',.5), ('E4',.5),('C4',.5),('A3',2), ('A3',1),('D3',1),('F3',.5),('G3',.5), ('A3',3), ('A3',1),('D3',1),('F3',.5),('G3',.5), ('D3',3)],
 "Minuet of Forest": [('D3',1),('D4',1),('B3',1),('A3',1), ('B3',2),('A3',2), ('D3',1),('D4',1),('B3',1),('A3',1), ('B3',4)],
 "Bolero of Fire": [('F3',1),('D3',1),('F3',1),('D3',1), ('A3',1),('F3',1),('A3',1),('F3',1), ('D3',.5),('F3',.5),('A3',1),('D4',1),('C4',1), ('D4',4)],
 "Serenade of Water": [('D3',1),('F3',1),('A3',2), ('A3',2),('B3',2), ('D3',1),('F3',1),('A3',1),('D4',1), ('C4',2),('B3',2)],
 "Requiem of Spirit": [('D3',1),('F3',1),('D3',2), ('A3',1),('F3',1),('D3',2), ('F3',1),('A3',1),('D4',2), ('C4',1),('A3',1),('F3',2)],
 "Nocturne of Shadow": [('B3',1),('A3',1),('A3',2), ('D3',.5),('B3',.5),('A3',1),('F3',2), ('B3',1),('A3',1),('D4',2), ('B3',.5),('A3',.5),('F3',1),('D3',2)],
 "Prelude of Light": [('D4',2),('A3',1),('D4',1), ('A3',1),('B3',1),('D4',2), ('D4',1),('E4',1),('F4',1),('D4',1), ('A3',4)]
}

def esc(s): return s.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')

class Page:
 def __init__(self): self.ops=[]
 def raw(self,s): self.ops.append(s)
 def line(self,x,y,X,Y,w=.6): self.raw(f'{w} w {x} {y} m {X} {Y} l S')
 def text(self,x,y,s,size=10,font='F1',gray=0):
  self.raw(f'{gray} g BT /{font} {size} Tf 1 0 0 1 {x} {y} Tm ({esc(s)}) Tj ET 0 g')
 def ellipse(self,x,y,rx,ry,fill=True):
  k=.55228475
  self.raw(f'{x+rx} {y} m {x+rx} {y+k*ry} {x+k*rx} {y+ry} {x} {y+ry} c '
   f'{x-k*rx} {y+ry} {x-rx} {y+k*ry} {x-rx} {y} c '
   f'{x-rx} {y-k*ry} {x-k*rx} {y-ry} {x} {y-ry} c '
   f'{x+k*rx} {y-ry} {x+rx} {y-k*ry} {x+rx} {y} c '+('f' if fill else 'S'))
 def stream(self): return '\n'.join(self.ops).encode('ascii')

def write_pdf(path,pages,width=396,height=612):
 # Base-14 fonts and vector paths keep the document portable and dependency-free.
 objs=[b'',b'<< /Type /Catalog /Pages 2 0 R >>',b'']
 for font in ['Helvetica','Helvetica-Bold','Times-Italic']:
  objs.append(f'<< /Type /Font /Subtype /Type1 /BaseFont /{font} >>'.encode())
 ids=[]
 for p in pages:
  stream=p.stream(); sid=len(objs); objs.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
  pid=len(objs); ids.append(pid)
  objs.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents {sid} 0 R >>'.encode())
 objs[2]=f'<< /Type /Pages /Count {len(ids)} /Kids [{" ".join(f"{i} 0 R" for i in ids)}] >>'.encode()
 data=bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'); offsets=[0]
 for i,obj in enumerate(objs[1:],1):
  offsets.append(len(data)); data.extend(f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n')
 start=len(data); data.extend(f'xref\n0 {len(objs)}\n0000000000 65535 f \n'.encode())
 for offset in offsets[1:]: data.extend(f'{offset:010d} 00000 n \n'.encode())
 data.extend(f'trailer\n<< /Size {len(objs)} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode()); path.write_bytes(data)

def footer(p,n):
 p.line(30,35,366,35,.4); p.text(30,22,'OCARINA OF TIME / SOLO TROMBONE',7,gray=.3); p.text(357,22,str(n),8)

def clef(p,x,y):
 # Traditional F clef: curl centered on F3 (fourth line), with two dots.
 p.ellipse(x+3,y+21,2.1,2.1)
 p.raw(f'1.8 w {x+2} {y+21} m {x-1} {y+28} {x+12} {y+30} {x+13} {y+22} c {x+15} {y+13} {x+7} {y+6} {x+1} {y+4} c S')
 p.ellipse(x+18,y+24.5,1.25,1.25); p.ellipse(x+18,y+17.5,1.25,1.25)

def score(p,song,y):
 title,mood,tempo,meter,notes,dyn,tip=song
 left,right=30,366
 for j in range(5): p.line(left,y+j*7,right,y+j*7,.45)
 clef(p,34,y)
 beats=int(meter.split('/')[0]); p.text(63,y+16,str(beats),13,'F2'); p.text(63,y+2,'4',13,'F2')
 start,end=88,357; bw=(end-start)/2
 bars=[[],[]]; b=0; t=0
 for pitch,d in notes:
  bars[b].append((pitch,d,t)); t+=d
  if abs(t-beats)<1e-7: b+=1; t=0
 assert b==2 and t==0
 p.text(30,y+69,f'{mood}  |  quarter note = {tempo}',9,'F3')
 p.text(82,y-27,dyn,12,'F3')
 for bi,bar in enumerate(bars):
  bx=start+bi*bw
  p.text(bx,y+46,str(bi+1),7,gray=.4)
  weight_total=sum(math.sqrt(n[1]) for n in bar[:-1]); used=0
  for pitch,d,t in bar:
   x=bx+12+(bw-26)*used/weight_total; used+=math.sqrt(d)
   ny=y+STEPS[pitch]*3.5
   if STEPS[pitch]>=10:
    for st in range(10,STEPS[pitch]+1,2): p.line(x-7,y+st*3.5,x+7,y+st*3.5,.6)
   p.raw('0.75 w'); p.ellipse(x,ny,4.1,2.65,d<2)
   down=STEPS[pitch]>=4
   sx=x-3.7 if down else x+3.7; sy=ny-25 if down else ny+25
   p.line(sx,ny,sx,sy,.85)
   if d==1.5: p.ellipse(x+8,ny+(3.5 if STEPS[pitch]%2==0 else 0),1,1)
   if d==.5:
    if down: p.raw(f'1.2 w {sx} {sy} m {sx-8} {sy+5} {sx-8} {sy+11} {sx-3} {sy+14} c S')
    else: p.raw(f'1.2 w {sx} {sy} m {sx+8} {sy-5} {sx+8} {sy-11} {sx+3} {sy-14} c S')
  barx=start+(bi+1)*bw
  p.line(barx,y,barx,y+28,.6)
 p.line(end+4,y,end+4,y+28,1.8)

def build_pages():
 pages=[]; p=Page()
 p.text(30,562,'THE LEGEND OF ZELDA',12,'F2')
 p.line(30,547,366,547,1)
 p.text(30,480,'OCARINA',42,'F2'); p.text(30,432,'OF TIME',42,'F2')
 p.text(32,395,'Twelve ocarina calls',22,'F3')
 p.text(32,368,'for solo trombone',21,'F3')
 # Minimal geometric cover art: a triangle around the five-note palette.
 p.raw('0.65 G 1 w 198 319 m 133 213 l 263 213 l h S 0 G')
 for x in [156,177,198,219,240]: p.ellipse(x,235+(x==198)*12,3.3,2.3)
 p.text(32,174,'Concert pitch  /  Bass clef  /  D3-D4',11,'F2')
 p.text(32,146,'Short call arrangements with suggested practice rhythms.',9)
 p.text(32,131,'The expanded soundtrack melodies are outside this edition.',9)
 p.text(32,86,'Original music: Koji Kondo',10)
 p.text(32,69,'Unofficial fan arrangement. Music and game rights: Nintendo.',8)
 footer(p,1); pages.append(p)
 p=Page(); p.text(30,563,'Before you play',24,'F2')
 lines=[
 'Read at concert pitch: a B-flat trombone does not transpose',
 'in bass clef. B means B-natural throughout. Middle C is C4.',
 'These are the twelve fixed input melodies, lowered into',
 'D3-D4. Scarecrow\'s Song is player-created and has no set tune.',
 '',
 'Durations, meters, tempos, dynamics and phrasing are editorial',
 'practice suggestions, rather than exact soundtrack timing.',
 'Play each call in one breath. Pause, then repeat as an echo.',
 'Use a gentle legato tongue for a connected sound.',
 'Move the slide promptly between notes to avoid glissandos.',
 ]
 y=536
 for line in lines: p.text(30,y,line,9); y-=14
 p.text(30,369,'Slide reference',12,'F2')
 p.text(30,351,'D3: 4th   F3: 1st   A3: 2nd   B3: 4th   D4: 1st',9)
 p.text(30,337,'Standard B-flat tenor trombone; adjust positions by ear.',8)
 p.text(30,307,'Song index',12,'F2')
 for i,s in enumerate(SONGS):
  yy=288-i*13; p.text(30,yy,f'{i+1:02d}   {s[0]}',9); p.text(350,yy,str(3+i//2),9)
 p.text(30,110,'Pitch-sequence reference',9,'F2')
 p.text(30,96,'playocarina.com/songs/ocarina-of-time/',8)
 p.text(30,78,'Print the reading PDF at actual size, or use the imposed PDF:',8)
 p.text(30,65,'US Letter landscape, duplex, flip short edge; fold and staple.',8)
 p.text(30,52,'Imposed file is already ordered. Do not select booklet mode.',8)
 footer(p,2); pages.append(p)
 for k in range(6):
  p=Page(); p.text(30,568,'THE OCARINA CALLS' if k<3 else 'THE WARP CALLS',9,'F2',.35)
  for row in range(2):
   i=2*k+row; s=SONGS[i]; top=528-row*242
   p.text(30,top,f'{i+1:02d}',10,'F2',.4)
   p.text(54,top-1,s[0],20 if len(s[0])<19 else 18,'F2')
   score(p,s,top-116)
   p.text(30,top-185,s[6],8)
   p.text(30,top-202,'Breathe after the final note; repeat softly if desired.',8,'F3')
   if row==0: p.line(30,top-222,366,top-222,.35)
  footer(p,k+3); pages.append(p)
 return pages

def midi_var(n):
 out=[n&127]; n>>=7
 while n: out.insert(0,(n&127)|128); n>>=7
 return bytes(out)

def exports():
 for index,(title,mood,tempo,meter,notes,dyn,tip) in enumerate(SONGS,1):
  stem=f'{index:02d}_'+title.lower().replace("'",'').replace(' ','_')
  root=ET.Element('score-partwise',version='4.0')
  work=ET.SubElement(root,'work'); ET.SubElement(work,'work-title').text=title+' - short ocarina call'
  ident=ET.SubElement(root,'identification'); ET.SubElement(ident,'creator',type='composer').text='Koji Kondo'
  ET.SubElement(ident,'creator',type='arranger').text='Editorial practice rhythm; concert pitch D3-D4'
  pl=ET.SubElement(root,'part-list'); sp=ET.SubElement(pl,'score-part',id='P1'); ET.SubElement(sp,'part-name').text='Trombone'
  part=ET.SubElement(root,'part',id='P1'); beat=0; mnum=0
  for pitch,d in notes:
   if beat==0:
    mnum+=1; measure=ET.SubElement(part,'measure',number=str(mnum))
    if mnum==1:
     at=ET.SubElement(measure,'attributes'); ET.SubElement(at,'divisions').text='2'
     key=ET.SubElement(at,'key'); ET.SubElement(key,'fifths').text='0'
     time=ET.SubElement(at,'time'); ET.SubElement(time,'beats').text=meter.split('/')[0]; ET.SubElement(time,'beat-type').text='4'
     cle=ET.SubElement(at,'clef'); ET.SubElement(cle,'sign').text='F'; ET.SubElement(cle,'line').text='4'
     direction=ET.SubElement(measure,'direction'); dt=ET.SubElement(direction,'direction-type'); ET.SubElement(dt,'words').text=f'{mood}; quarter = {tempo}; editorial rhythm'
     ET.SubElement(direction,'sound',tempo=str(tempo))
   n=ET.SubElement(measure,'note'); pit=ET.SubElement(n,'pitch'); ET.SubElement(pit,'step').text=pitch[0]; ET.SubElement(pit,'octave').text=pitch[1]
   ET.SubElement(n,'duration').text=str(int(d*2)); ET.SubElement(n,'type').text={.5:'eighth',1:'quarter',1.5:'quarter',2:'half'}[d]
   if d==1.5: ET.SubElement(n,'dot')
   beat=(beat+d)%int(meter.split('/')[0])
  bar=ET.SubElement(measure,'barline',location='right'); ET.SubElement(bar,'bar-style').text='light-heavy'
  ET.indent(root); ET.ElementTree(root).write(OUT/(stem+'.musicxml'),encoding='utf-8',xml_declaration=True)
  track=b'\x00\xff\x51\x03'+int(60000000/tempo).to_bytes(3,'big')+b'\x00\xc0\x39'
  for pitch,d in notes:
   track+=b'\x00\x90'+bytes([PITCH[pitch],75])+midi_var(int(d*480))+b'\x80'+bytes([PITCH[pitch],0])
  track+=b'\x00\xff\x2f\x00'
  (OUT/(stem+'.mid')).write_bytes(b'MThd'+struct.pack('>IHHH',6,0,1,480)+b'MTrk'+struct.pack('>I',len(track))+track)

def main():
 pages=build_pages(); write_pdf(OUT/'ocarina_trombone.pdf',pages)
 imposed=[]
 # Two nested sheets: outer front 8|1, outer back 2|7, inner front 6|3, inner back 4|5.
 for left,right in [(7,0),(1,6),(5,2),(3,4)]:
  p=Page(); p.raw('q'); p.raw(pages[left].stream().decode()); p.raw('Q q 1 0 0 1 396 0 cm'); p.raw(pages[right].stream().decode()); p.raw('Q'); imposed.append(p)
 write_pdf(OUT/'ocarina_trombone_folded.pdf',imposed,792,612)
 exports()
 (OUT/'songs.json').write_text(json.dumps([dict(title=s[0],tempo=s[2],meter=s[3],notes=s[4]) for s in SONGS],indent=2)+'\n')
 print('Generated 8 reading pages, 4 imposed sides, 12 MusicXML scores and 12 MIDI calls.')

if __name__=='__main__': main()
