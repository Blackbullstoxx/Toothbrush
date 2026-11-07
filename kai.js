'use strict';
const $=id=>document.getElementById(id);
const groups=[{name:'Kauflächen',prefix:'kau'},{name:'Außenflächen',prefix:'aussen'},{name:'Innenflächen',prefix:'innen'}];
const quadrants=['Oben rechts','Oben links','Unten rechts','Unten links'];
const files=['oben-rechts','oben-links','unten-rechts','unten-links'];
const KEY='kai.duration.v1';
function validDuration(n){return Number.isInteger(n)&&n>=60&&n<=659}
function loadDuration(){try{const saved=Number(localStorage.getItem(KEY));if(validDuration(saved))return saved;}catch{}return 180}
let totalSeconds=loadDuration(),stages=[],seconds=15,step=0,elapsed=0,running=false,completed=false,last=0,raf=0,audio,ready=false;
// Keep the visible app awake; browsers may release this when hidden or low on battery.
let screenLock=null,wakePending=false,pageActive=true;
async function keepScreenAwake(){
 if(typeof navigator==='undefined'||!navigator.wakeLock||document.hidden||!pageActive||screenLock||wakePending)return;
 wakePending=true;try{const lock=await navigator.wakeLock.request('screen');if(document.hidden||!pageActive){await lock.release();return}screenLock=lock;lock.addEventListener('release',()=>{if(screenLock===lock)screenLock=null})}catch{}finally{wakePending=false}
}
function releaseScreen(){const lock=screenLock;screenLock=null;if(lock)lock.release().catch(()=>{})}
let startPositioned=false;
function revealStart(){if(startPositioned||typeof window.innerHeight!=='number')return;startPositioned=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{const button=$('start');const box=button.getBoundingClientRect();const height=window.visualViewport?.height||window.innerHeight;const top=window.visualViewport?.offsetTop||0;const overflow=box.bottom-(top+height-20);if(overflow>0)window.scrollBy({top:overflow,behavior:'instant'})}));}
if(typeof window.addEventListener==='function'){
 window.addEventListener('pagehide',()=>{pageActive=false;releaseScreen()});
 window.addEventListener('pageshow',()=>{pageActive=true;keepScreenAwake()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseScreen();else keepScreenAwake()});
 document.addEventListener('pointerdown',keepScreenAwake,{passive:true});
 keepScreenAwake();
}
function persist(){try{localStorage.setItem(KEY,String(totalSeconds));$('storage-message').textContent=''}catch{$('storage-message').textContent='Die Putzzeit kann gerade nicht dauerhaft gespeichert werden.'}}
function rebuild(){seconds=totalSeconds/12;stages=groups.flatMap((g,phase)=>quadrants.map((title,q)=>({phase,q,title,direction:phase===0?'':q%2?'Von der Mitte nach links hinten':'Von rechts hinten zur Mitte',src:'./'+g.prefix+'-'+files[q]+'.png',alt:g.name+' Â· '+title})))}
function format(s){s=Math.max(0,Math.ceil(s-1e-7));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
// Keep all decoded frames resident; draw only when the quadrant changes.
const decodedFrames=new Map();
let drawnSrc=null,audioNodes=[],audioGeneration=0;
function cancelSignals(){audioGeneration++;for(const node of audioNodes){try{node.stop()}catch{}}audioNodes=[]}
function tone(at,duration,frequency){const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=frequency;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.075,at+.008);g.gain.setValueAtTime(.075,at+duration-.025);g.gain.linearRampToValueAtTime(0,at+duration);o.start(at);o.stop(at+duration+.01);audioNodes.push(o)}
function scheduleSignals(){
 cancelSignals();if(!running)return;
 try{audio ||= new (window.AudioContext||window.webkitAudioContext)();const generation=audioGeneration;
 const schedule=()=>{if(!running||generation!==audioGeneration)return;const remaining=seconds-elapsed;const now=audio.currentTime;
 for(let index=step;index<12;index++){const boundary=remaining+(index-step)*seconds;for(const n of [3,2,1]){const delay=boundary-n;if(delay>=-.015)tone(now+Math.max(0,delay),.12,1000)}tone(now+Math.max(0,boundary),.55,1200)}};
 if(audio.state==='suspended')audio.resume().then(schedule).catch(()=>{});else schedule();
 }catch{}
}
function drawStage(s){const bitmap=decodedFrames.get(s.src);if(bitmap&&drawnSrc!==s.src){const canvas=$('jaw');const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);drawnSrc=s.src} $('jaw').setAttribute('aria-label',s.alt)}
function render(){const s=stages[step];$('session').classList.toggle('hidden',completed);$('finished').classList.toggle('hidden',!completed);document.querySelectorAll('[data-phase]').forEach((b,i)=>{b.classList.toggle('active',!completed&&i===s.phase);b.setAttribute('aria-current',!completed&&i===s.phase?'step':'false')});if(completed)return;
 $('counter').textContent=String(step+1).padStart(2,'0')+' / 12';$('heading').textContent=s.title;$('surface').textContent=groups[s.phase].name;drawStage(s);
 const left=Math.max(0,seconds-elapsed);$('seconds').textContent=Math.ceil(left-1e-7);$('arc').style.strokeDashoffset=823.097*(1-left/seconds);$('total').textContent=format((11-step)*seconds+left);$('start').textContent=!ready?'Bilder laden …':running?'â…¡  Pause':elapsed>0?'â–¶  Weiter':'â–¶  Starten';$('start').disabled=!ready;
}
function pause(){running=false;cancelSignals();cancelAnimationFrame(raf);render()}
function frame(t){if(!running)return;elapsed+=(t-last)/1000;last=t;while(elapsed>=seconds-1e-8){elapsed=Math.max(0,elapsed-seconds);step++;if(step===12){step=11;elapsed=seconds;running=false;completed=true;render();return}}render();raf=requestAnimationFrame(frame)}
function reset(){pause();step=0;elapsed=0;completed=false;render()}
function jump(n){pause();step=n;elapsed=0;completed=false;render()}
async function preload(){ready=false;render();$('load-message').textContent='';try{
 const sources=[...new Set(stages.map(s=>s.src))];
 await Promise.all(sources.map(async src=>{if(decodedFrames.has(src))return;const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=src});if(img.decode)await img.decode();const bitmap=typeof createImageBitmap==='function'?await createImageBitmap(img):img;decodedFrames.set(src,bitmap)}));
 ready=true;render();revealStart();
 }catch{$('start').disabled=false;$('start').textContent='Bilder erneut laden';$('load-message').textContent='Ein Bild fehlt. Bitte erneut laden.'}}
$('start').onclick=()=>{keepScreenAwake();if(!ready){preload();return}if(running){pause();return}running=true;last=performance.now();scheduleSignals();render();raf=requestAnimationFrame(frame)};$('reset').onclick=reset;$('again').onclick=reset;
document.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>jump(Number(b.dataset.phase)*4));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause()});
const wheelValues={minutes:3,seconds:0};
const ROW=40;
function wheelNumber(kind){const el=$(kind+'-wheel');const min=kind==='minutes'?1:0,max=kind==='minutes'?10:59;return Math.min(max,Math.max(min,Math.round(el.scrollTop/ROW)+min))}
function updateWheel(kind){const el=$(kind+'-wheel');const value=wheelNumber(kind);wheelValues[kind]=value;for(const option of el.children){const selected=Number(option.dataset.value)===value;option.setAttribute('aria-selected',String(selected));option.classList.toggle('selected',selected)}el.setAttribute('aria-activedescendant',kind+'-option-'+value);pickerHint()}
function pickerHint(){const total=wheelValues.minutes*60+wheelValues.seconds;$('chosen-time').textContent=format(total)+' Minuten';const per=total/12;const exact=Number.isInteger(per);$('section-duration').textContent='12 Abschnitte mit jeweils '+(exact?'':'ca. ')+new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(per)+' Sekunden.'}
function setWheel(kind,value){const el=$(kind+'-wheel');el.scrollTop=(value-(kind==='minutes'?1:0))*ROW;updateWheel(kind)}
function buildWheel(kind){const el=$(kind+'-wheel'),min=kind==='minutes'?1:0,max=kind==='minutes'?10:59;for(let n=min;n<=max;n++){const option=document.createElement('div');option.id=kind+'-option-'+n;option.className='wheel-option';option.dataset.value=n;option.setAttribute('role','option');option.textContent=String(n).padStart(2,'0');option.onclick=()=>{el.scrollTo({top:(n-min)*ROW,behavior:'smooth'})};el.append(option)}el.addEventListener('scroll',()=>updateWheel(kind),{passive:true});el.onkeydown=e=>{const shifts={ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5};let next;if(e.key in shifts)next=wheelNumber(kind)+shifts[e.key];else if(e.key==='Home')next=min;else if(e.key==='End')next=max;else return;e.preventDefault();setWheel(kind,Math.min(max,Math.max(min,next)))}}
buildWheel('minutes');buildWheel('seconds');
$('settings-open').onclick=()=>{pause();$('settings').showModal();setWheel('minutes',Math.floor(totalSeconds/60));setWheel('seconds',totalSeconds%60)};
$('settings-close').onclick=()=>{$('settings').close()};
$('settings-form').onsubmit=e=>{e.preventDefault();totalSeconds=wheelNumber('minutes')*60+wheelNumber('seconds');persist();rebuild();reset();$('settings').close()};
rebuild();render();preload();persist();