"use strict";
/* GACOR LUDO - ui.js: board, token, dadu 3D, panel, animasi, fx, sfx */
/* ANIMASI SELALU JALAN: Windows "animation effects" OFF -> prefers-reduced-motion
   di-override biar gak ada animasi yang ilang di device manapun */
(function(){
  const orig=window.matchMedia;
  window.matchMedia=function(q){
    if(/prefers-reduced-motion/i.test(String(q))){
      return{matches:false,media:String(q),onchange:null,
        addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},
        dispatchEvent(){return false}};
    }
    return orig.call(window,q);
  };
})();
/* ================= UI: screens, board build ================= */
const SCREENS=['auth','menu','lobby','game','admin'];
function show(id){for(const s of SCREENS){$('#scr-'+s).hidden=s!==id}
  $('#quitBtn').hidden=(id!=='game');
  const img=document.getElementById('bgImg');
  if(img)img.setAttribute('src',(id==='game')?'assets/img/bg-match.jpg':'assets/img/bg-lobby.jpg');
  if(id==='menu'&&typeof segGlider==='function'){setTimeout(()=>{segGlider('botN');segGlider('roomMode')},60)}
}
const board=$('#board');
function buildBoard(){
  board.innerHTML='';
  const areas=[['1 / 1 / 7 / 7','var(--red)'],['1 / 10 / 7 / 16','var(--green)'],['10 / 10 / 16 / 16','var(--yellow)'],['10 / 1 / 16 / 7','var(--blue)']];
  const slotEls=[];
  areas.forEach((a,i)=>{
    const b=document.createElement('div');b.className='base';b.dataset.seat=i;
    b.style.gridArea=a[0];b.style.background=a[1];
    const sl=document.createElement('div');sl.className='bslots';
    for(let j=0;j<4;j++){const s=document.createElement('div');s.className='slot';s.dataset.seat=i;s.dataset.slot=j;sl.appendChild(s)}
    b.appendChild(sl);board.appendChild(b);
  });
  const hc=document.createElement('div');hc.id='homeC';hc.style.gridArea='7 / 7 / 10 / 10';board.appendChild(hc);
  PATH.forEach((p,i)=>{
    const c=document.createElement('div');c.className='cell';
    c.style.gridArea=(p[1]+1)+' / '+(p[0]+1);c.dataset.abs=i;
    const stSeat=[0,13,26,39].indexOf(i);
    if(stSeat>=0){c.classList.add('start');c.style.background=COLS[stSeat].cv;
      c.style.setProperty('--cc','');c.dataset.start=stSeat}
    if(SAFEABS.has(i)&&stSeat<0)c.classList.add('star');
    board.appendChild(c);
  });
  HOMEPATH.forEach((hp,s)=>{
    hp.forEach(p=>{
      const c=document.createElement('div');c.className='cell hcol';
      c.style.gridArea=(p[1]+1)+' / '+(p[0]+1);c.style.background=COLS[s].cv;
      c.dataset.hc=s;board.appendChild(c);
    });
  });
  // arrows
  board.querySelectorAll('.cell.start').forEach(c=>{const s=+c.dataset.start;c.style.setProperty('--ar',JSON.stringify(DIRG[s]))});
}
function setArrows(){
  document.querySelectorAll('.cell.start').forEach(c=>{const s=+c.dataset.start;
    const a=document.createElement('span');a.textContent=DIRG[s];c.appendChild(a);
    a.style.cssText='position:absolute;inset:0;display:grid;place-items:center;color:#ffffffd9;font-size:60%;font-family:Fredoka;font-weight:700'});
  document.querySelectorAll('.cell.hcol').forEach(c=>{const s=+c.dataset.hc;
    const a=document.createElement('span');a.textContent=DIRG[s];c.appendChild(a);
    a.style.cssText='position:absolute;inset:0;display:grid;place-items:center;color:#ffffff5c;font-size:65%'});
}
/* metrics */
let M=null;
function metrics(){
  const r=board.getBoundingClientRect();
  const cs=getComputedStyle(board);
  const pad=parseFloat(cs.padding)||0,gap=parseFloat(cs.gap)||0;
  const cell=(r.width-2*pad-14*gap)/15;
  M={r,pad,gap,cell};
}
const cellCenter=(c,r)=>[M.pad+c*(M.cell+M.gap)+M.cell/2, M.pad+r*(M.cell+M.gap)+M.cell/2];

/* ================= tokens ================= */
const tokEls={};
function buildTokens(){
  for(const el of Object.values(tokEls))el.remove();
  for(const k of Object.keys(tokEls))delete tokEls[k];
  if(!G)return;
  for(const pl of G.seats){if(!pl.active)continue;
    for(let k=0;k<4;k++){
      const el=document.createElement('div');el.className='tok';
      el.style.setProperty('--c',COLS[pl.seat].cv);
      el.style.setProperty('--cd',COLS[pl.seat].cd);
      el.innerHTML='<div class="bd" style="background:radial-gradient(circle at 32% 28%, #ffffffcc, #ffffff00 26%), radial-gradient(circle at 50% 62%, '+COLS[pl.seat].cv+', '+COLS[pl.seat].cd+')"></div><div class="ring"></div><div class="cnt"></div>';
      el.addEventListener('click',()=>onTokClick(pl.seat,k));
      board.appendChild(el);tokEls[pl.seat+'-'+k]=el;
    }
  }
  metrics();placeAll(true);
}
function tokEl(s,k){return tokEls[s+'-'+k]}
function progressXY(seat,k,p,ts){
  if(p===-1){
    const slot=board.querySelector('.slot[data-seat="'+seat+'"][data-slot="'+k+'"]');
    const sr=slot.getBoundingClientRect(),br=M.r;
    return [sr.left+sr.width/2-(br.left),sr.top+sr.height/2-(br.top)];
  }
  if(p<=50){const [c,r]=absCell(relToAbs(seat,p));return cellCenter(c,r)}
  if(p<=55){const [c,r]=HOMEPATH[seat][p-51];return cellCenter(c,r)}
  // home center, wedge line
  const d=WEDGE_DIR(seat);const i=Math.max(0,G.fin[seat].indexOf(k));
  return cellCenter(7.5+d[0]*(0.95-i*0.22),7.5+d[1]*(0.95-i*0.22));
}
const STACK=[[0,0],[-.17,-.17],[.17,.17],[-.19,.09],[.19,-.09]];
const SSCALE=[1,.82,.82,.72,.72];
function placeAll(instant){
  if(!G||!M)return;
  metrics();
  const groups={};
  for(const pl of G.seats){if(!pl.active)continue;
    for(let k=0;k<4;k++){const p=G.tok[pl.seat][k];
      if(p===56)continue;
      const [x,y]=progressXY(pl.seat,k,p,0);
      const key=Math.round(x/8)+'_'+Math.round(y/8);
      (groups[key]=groups[key]||[]).push({s:pl.seat,k,x,y});
    }}
  const ts=M.cell*0.66;
  for(const g of Object.values(groups)){
    const n=Math.min(g.length,5);
    g.forEach((t,i)=>{
      const el=tokEl(t.s,t.k);if(!el)return;
      const off=STACK[Math.min(i,n-1)];const sc=SSCALE[Math.min(i,n-1)]*(n>1&&i>=5?.6:1);
      const w=ts*sc;
      el.style.width=el.style.height=w+'px';
      setPos(el,[t.x+off[0]*M.cell,t.y+off[1]*M.cell],instant===undefined?true:instant);
      el.style.zIndex=20+i;
      const cnt=el.querySelector('.cnt');cnt.style.display=(g.length>1&&i===0)?'grid':'none';
      if(g.length>1)cnt.textContent=g.length;
    });
  }
  for(const pl of G.seats){if(!pl.active)continue;
    for(let k=0;k<4;k++){const p=G.tok[pl.seat][k];if(p!==56)continue;
      const el=tokEl(pl.seat,k);const [x,y]=progressXY(pl.seat,k,56,0);
      el.style.width=el.style.height=M.cell*0.55+'px';
      setPos(el,[x,y],instant===undefined?true:instant);el.style.zIndex=12;
    }}
}
function setPos(el,xy,instant){
  el._x=xy[0];el._y=xy[1];
  const w=parseFloat(el.style.width)||M.cell*.66;
  el.style.transition=instant?'none':'transform .15s ease';
  el.style.transform='translate('+(xy[0]-w/2)+'px,'+(xy[1]-w/2)+'px)';
}
async function animateMove(a){
  animLock=true;
  placeAll(true);
  const el=tokEl(a.seat,a.k);if(!el){animLock=false;return}
  const fromP=a.from;
  const [fx,fy]=fromP===-1?progressXY(a.seat,a.k,-1,0):progressXY(a.seat,a.k,fromP,0);
  const w=parseFloat(el.style.width)||M.cell*.66;
  el.style.transition='none';
  el.style.transform='translate('+(fx-w/2)+'px,'+(fy-w/2)+'px)';
  el._x=fx;el._y=fy;
  el.classList.add('moving');
  await wait(90);
  for(const step of a.path){
    const [cx,cy]=cellCenter(step[0],step[1]);
    el.style.transition='transform '+(Math.min(150,150/SPD))+'ms ease';
    el.style.transform='translate('+(cx-w/2)+'px,'+(cy-w/2)+'px)';
    el._x=cx;el._y=cy;
    const bd=el.querySelector('.bd');
    try{bd.animate([{transform:'translateY(0) scale(1,1)'},{transform:'translateY(-30%) scale(1.08,.9)',offset:.5},{transform:'translateY(0) scale(1,1)'}],{duration:Math.min(150,150/SPD)})}catch(e){}
    sfxPlay('hop');
    if(navigator.vibrate)try{navigator.vibrate(8)}catch(e){}
    await wait(150);
  }
  el.classList.remove('moving');
  if(a.caps&&a.caps.length){
    const dest=a.to<=50?absCell(relToAbs(a.seat,a.to)):(a.to<=55?HOMEPATH[a.seat][a.to-51]:[7.5,7.5]);
    const [dx,dy]=cellCenter(dest[0],dest[1]);
    eatFlash(COLS[a.seat].cv+'33'); // flash warna penyerang
    for(const v of a.caps){
      const ve=tokEl(v.seat,v.k);if(!ve)continue;
      const vw=parseFloat(ve.style.width)||M.cell*.66;
      ve.style.transition='none';
      ve.style.transform='translate('+(dx-vw/2)+'px,'+(dy-vw/2)+'px)';ve._x=dx;ve._y=dy;
      ve.classList.add('moving');
      await wait(140);
      const [bx,by]=progressXY(v.seat,v.k,-1,0);
      const anim=ve.animate([
        {transform:'translate('+(dx-vw/2)+'px,'+(dy-vw/2)+'px) scale(1) rotate(0deg)'},
        {transform:'translate('+((dx+bx)/2-vw/2)+'px,'+((Math.min(dy,by)-M.cell*1.4)-vw/2)+'px) scale(1.3) rotate(200deg)',offset:.55},
        {transform:'translate('+(bx-vw/2)+'px,'+(by-vw/2)+'px) scale(1) rotate(360deg)'}
      ],{duration:Math.min(640,640/SPD),easing:'cubic-bezier(.4,.1,.35,1)'});
      sfxPlay('capture');sfxPlay('eat');
      burstAt(dx,dy,[COLS[v.seat].cv,'#F5C044','#fff'],26);
      shakeBoard();
      try{await anim.finished}catch(e){}
      ve.classList.remove('moving');
    }
    await wait(180);
  }
  if(a.fin){
    const [hx,hy]=cellCenter(7.5,7.5);
    burstAt(hx,hy,[COLS[a.seat].cv,'#F5C044','#fff'],30);
    sfxPlay('home');
  }
  placeAll(true);
  animLock=false;
}
let animLock=false;
function shakeBoard(){
  try{board.animate([{transform:'translate(0,0)'},{transform:'translate(-6px,3px)'},{transform:'translate(5px,-4px)'},{transform:'translate(-3px,2px)'},{transform:'translate(0,0)'}],{duration:Math.min(280,280/SPD)})}catch(e){}
}
function boardIntro(){
  metrics();
  /* intro murah buat SEMUA device: 1 animasi container (compositor) + pop token —
     gak ada lagi 90 animasi cell per-elemen yang bikin kentang ngos */
  try{board.animate([{opacity:0,transform:'scale(.88)'},{opacity:1,transform:'scale(1)'}],
    {duration:340,easing:'cubic-bezier(.2,.9,.3,1)'})}catch(e){}
  for(const key in tokEls){const el=tokEls[key];
    try{el.querySelector('.bd').animate([{transform:'scale(0)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],
      {duration:380,delay:Math.random()*260,easing:'ease-out'})}catch(e){}}
}

/* ================= dice ================= */
const cube=$('#cube');
const FACES={1:['f1',[0,0]],2:['f2',[-90,0]],3:['f3',[0,-90]],4:['f4',[0,90]],5:['f5',[90,0]],6:['f6',[0,180]]};
const PIPS={1:[5],2:[3,7],3:[3,5,7],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
(function buildDice(){
  const order=[1,2,3,4,5,6];
  for(const v of order){
    const f=document.createElement('div');f.className='f '+FACES[v][0];
    for(const n of PIPS[v]){const p=document.createElement('div');p.className='pip';
      p.style.gridArea=(Math.ceil(n/3))+' / '+((n-1)%3+1);f.appendChild(p)}
    cube.appendChild(f);
  }
})();
let spinX=0,spinY=0;
async function spinDice(v){
  const [bx,by]=FACES[v][1];
  spinX+=360*(2+Math.floor(Math.random()*2));spinY+=360*(2+Math.floor(Math.random()*2));
  cube.style.transform='rotateX('+(spinX+bx)+'deg) rotateY('+(spinY+by)+'deg)';
  await wait(830);
}

/* ================= players panel / turn ui ================= */
function buildPlayers(){ /* panel kartu dihapus — dadu sekarang di slot papan */ }
function dockDice(){ // dadu pindah ke SLOT sisi papan milik pemain giliran
  const dock=$('#diceDock');
  if(!dock||!G)return;
  const slot=document.querySelector('.diceSlot[data-seat="'+G.turn+'"]');
  if(!slot)return;
  if(dock.parentElement!==slot)slot.appendChild(dock);
  document.querySelectorAll('.diceSlot').forEach(s=>s.classList.toggle('active',s===slot));
}
function render(){
  renderTurn();renderDiceUI();renderFeed();placeAll(true);
}
function renderTurn(){
  const dot=$('#turnDot'),txt=$('#turnTxt'),bar=$('#turnbar');
  document.querySelectorAll('.base').forEach(b=>b.classList.remove('turn'));
  if(!G)return;
  const pl=G.seats[G.turn];
  dot.style.background=COLS[G.turn].cv;
  const mine=myControl();
  let t;
  if(G.over)t='🏆 '+G.seats[G.rank[0]].name+' jadi JAGOAN!';
  else if(G.phase==='roll'||G.phase==='rolling')t=mine?'GILARAN LO — lempar dadu 🎲':'giliran '+pl.name+'… ⏳';
  else if(G.phase==='move')t=mine?'pilih token yang nyala ✨':pl.name+' lagi milih… 🤔';
  else t='…';
  txt.textContent=t;
  if(!G.over){const b=board.querySelector('.base[data-seat="'+G.turn+'"]');if(b)b.classList.add('turn')}
}
function renderDiceUI(){
  const hint=$('#diceHint'),wrap=$('#diceWrap');
  if(!G){hint.textContent='';wrap.classList.remove('mine');return}
  dockDice(); // dadu pindah ke slot giliran tiap render
  const mine=myControl()&&G.phase==='roll';
  wrap.classList.toggle('mine',mine); // glow kalau giliran lo
  const dice=$('#dice');
  dice.style.cursor=mine?'pointer':'default';
  if(G.over)hint.textContent='';
  else if(mine)hint.textContent='PENCET DADUNYA! 👆';
  else if(G.phase==='move')hint.textContent=myControl()?'pilih token lo':'nunggu '+G.seats[G.turn].name+' pilih';
  else hint.textContent='giliran '+G.seats[G.turn].name;
}
function renderPlayers(){ /* kartu pemain dihapus — info via chat/log */ }
function renderFeed(){ /* panel riwayat dihapus — log game masuk chat biar satu tempat */ }

/* movable highlight */
function highlightMovable(){
  for(const key in tokEls)tokEls[key].classList.remove('can');
  if(!G||G.over||G.phase!=='move'||!myControl())return;
  for(const m of legal(G.turn,G.dice)){
    const el=tokEl(G.turn,m.k);if(el)el.classList.add('can');
  }
}
setInterval(highlightMovable,350);
function onTokClick(s,k){
  if(!G||G.over)return;
  if(!myControl()||G.phase!=='move')return;
  if(s!==G.turn)return;
  const m=legal(G.turn,G.dice).find(x=>x.k===k);
  if(!m){toast('token ini nggak bisa jalan 🚫',900);return}
  actMove(k);
}

/* ================= input ================= */
function myControl(){
  if(!G||G.over)return false;
  const pl=G.seats[G.turn];
  if(pl.kind==='bot'||pl.auto)return false;
  if(!NET.on)return pl.kind==='human';
  return G.turn===NET.mySeat&&pl.kind==='human';
}
function iAmAuth(){return !NET.on||NET.host}
function actRoll(){
  if(!myControl()||G.phase!=='roll')return;
  if(iAmAuth())doRoll();else if(NET.conn&&NET.conn.open)NET.conn.send({t:'roll'});
}
function actMove(k){
  if(!myControl()||G.phase!=='move')return;
  if(iAmAuth()){const m=legal(G.turn,G.dice).find(x=>x.k===k);if(m)doMove(m)}
  else if(NET.conn&&NET.conn.open)NET.conn.send({t:'move',k});
}
$('#dice').addEventListener('click',actRoll); // pencet dadu = lempar (tombol LEMPAR dihapus)

/* ================= game over ================= */
function gameOver(){
  clearTimers();
  const win=G.seats[G.rank[0]];
  toast('🏆 '+win.name+' JADI JAGOAN!',3000);
  sfxPlay('win');
  confettiRain([COLS[G.rank[0]].cv,'#F5C044','#fff']);
  /* simpen ke database (semua pemain human yang login) */
  const players=activeSeats().map(pl=>pl.name);
  const mode=NET.on?'online':'bot';
  DB.addGame({winner:win.name,mode,players});
  const iAmIn=ME&&players.indexOf(ME.name)>=0;
  const iWon=ME&&win.name===ME.name;
  if(iAmIn)DB.bump(ME.name,iWon);
  const rest=activeSeats().filter(pl=>pl.seat!==G.rank[0]).sort((a,b)=>{
    const fa=G.fin[a.seat].length,fb=G.fin[b.seat].length;
    if(fa!==fb)return fb-fa;
    const pa=Math.max(...G.tok[a.seat].filter(p=>p<56&&p>=-1).map(p=>Math.max(p,0))),pb=Math.max(...G.tok[b.seat].filter(p=>p<56&&p>=-1).map(p=>Math.max(p,0)));
    return pb-pa;
  });
  const rows=[[G.rank[0],0],...rest.map((p,i)=>[p.seat,i+1])];
  const medals=['🥇','🥈','🥉','4️⃣'];
  let pod='<div class="podium">';
  rows.forEach(([s,i])=>{
    const h=96-i*16;
    pod+='<div class="pcol"><div class="medal">'+medals[i]+'</div><div class="pav" style="background:radial-gradient(circle at 32% 28%, #ffffffcc, #ffffff00 28%), radial-gradient(circle at 50% 62%, '+COLS[s].cv+', '+COLS[s].cd+')">'+G.seats[s].name.trim()[0].toUpperCase()+'</div><div class="pn2">'+G.seats[s].name+'</div><div class="bar" style="height:'+h+'px"></div></div>';
  });
  pod+='</div>';
  /* animasi kalah buat yang kalah (kalau aku main tapi kalah) */
  let loseAnim='';
  if(iAmIn&&!iWon){
    loseAnim='<div class="loseStamp">💀 KALAH BANG… <span>ULANGI SAMPE GACOR</span></div>';
    sfxPlay('lose');
    sadRain();
  }
  const statLine=iAmIn?('stat lo: <b>'+DB.user(ME.name).games+' main • '+DB.user(ME.name).wins+'W / '+DB.user(ME.name).losses+'L</b>'):'';
  showModal(
    '<h2 style="color:var(--gold)">JAGOAN: '+win.name+' 🏆</h2>'+
    '<div class="msub">semua token sampai rumah — gacor banget</div>'+pod+
    loseAnim+
    (statLine?'<div class="msub" style="margin-top:12px">'+statLine+'</div>':'')+
    '<div class="mbtns">'+
    '<button class="go" id="mAgain">MAIN LAGI 🎲</button>'+
    '<button class="ghost" id="mMenu">MENU</button></div>');
  $('#mAgain').onclick=()=>{
    hideModal();
    if(NET.on){
      if(NET.host){NET.started=false;G=null;broadcastLobby();show('lobby')}
      else{show('lobby');$('#startBtn').disabled=true;
        $('#startBtn').textContent='NGUNGUIN HOST…';
        showModal('<h2>NUNGGU HOST</h2><div class="msub">host bisa mulai lagi kapan aja — santai dulu ☕</div><div class="mbtns"><button class="ghost" id="mMenu2">MENU</button></div>');
        $('#mMenu2').onclick=()=>{hideModal();leaveAll()};
      }
    }else{startLocal(lastCfg);if(ME)renderHist()}
  };
  $('#mMenu').onclick=()=>{hideModal();leaveAll();if(ME)renderHist()};
}
function showModal(html){$('#mbox').innerHTML=html;$('#modal').hidden=false}
function hideModal(){$('#modal').hidden=true}
function leaveAll(){
  clearTimers();G=null;
  if(NET.on)cleanupNet();
  $('#quitBtn').hidden=true;show('menu');
}

/* ================= confetti / fx ================= */
const fx=$('#fx'),ctx=fx.getContext('2d');let parts=[],fxOn=false;
function fxSize(){fx.width=innerWidth;fx.height=innerHeight}
fxSize();addEventListener('resize',()=>{fxSize();if(G&&M)placeAll(true)});
function sadRain(){ // hujan "air mata" buat yang kalah 💀
  let n=0;
  const iv=setInterval(()=>{
    for(let i=0;i<14;i++){parts.push({x:Math.random()*fx.width,y:-14,vx:(Math.random()-.5)*1.6,vy:1.6+Math.random()*2,g:.05,s:4+Math.random()*4,r:Math.random()*6,vr:(Math.random()-.5)*.2,l:80+Math.random()*50,c:Math.random()<.5?'#3E8BFF':'#E5484D',shape:'circle'})}
    fxStart();if(++n>=10)clearInterval(iv);
  },260);
}
function fxLoop(){
  if(!parts.length){fxOn=false;ctx.clearRect(0,0,fx.width,fx.height);return}
  ctx.clearRect(0,0,fx.width,fx.height);
  parts=parts.filter(p=>p.l>0);
  for(const p of parts){
    p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.vx*=.99;p.r+=p.vr;p.l--;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);
    ctx.globalAlpha=clamp(p.l/30,0,1);ctx.fillStyle=p.c;
    if(p.shape==='circle'){ctx.beginPath();ctx.arc(0,0,p.s/2,0,Math.PI*2);ctx.fill()}
    else ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.62);
    ctx.restore();
  }
  requestAnimationFrame(fxLoop);
}
function fxStart(){if(!fxOn){fxOn=true;requestAnimationFrame(fxLoop)}}
function boardXY(cx,cy){const r=board.getBoundingClientRect();return [r.left+cx,r.top+cy]}
function burstAt(cx,cy,cols,n){
  const [sx,sy]=boardXY(cx,cy);
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=2+Math.random()*5.5;
    parts.push({x:sx,y:sy,vx:Math.cos(a)*v,vy:Math.sin(a)*v-3,g:.16,s:5+Math.random()*6,r:Math.random()*6,vr:(Math.random()-.5)*.3,l:38+Math.random()*26,c:cols[i%cols.length]})}
  fxStart();
}
function confettiRain(cols){
  let burstN=0;
  const iv=setInterval(()=>{
    for(let i=0;i<26;i++){parts.push({x:Math.random()*fx.width,y:-14,vx:(Math.random()-.5)*2.4,vy:1+Math.random()*3,g:.055,s:6+Math.random()*7,r:Math.random()*6,vr:(Math.random()-.5)*.35,l:90+Math.random()*60,c:cols[Math.floor(Math.random()*cols.length)]})}
    fxStart();if(++burstN>=8)clearInterval(iv);
  },240);
}

/* ================= bgm (WebAudio, default ON — suara sisa cuma lagu) ================= */
const SFX={on:localStorage.getItem('gl-snd')!=='0',ctx:null,
  init(){if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}
    if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume()},
  tone(f,t0,dur,type,vol){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();
    o.type=type||'triangle';o.frequency.value=f;
    g.gain.setValueAtTime(0,c.currentTime+t0);
    g.gain.linearRampToValueAtTime(vol||.14,c.currentTime+t0+.012);
    g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+t0+dur);
    o.connect(g);g.connect(c.destination);o.start(c.currentTime+t0);o.stop(c.currentTime+t0+dur+.05);
  }};
/* BGM: playlist multi-lagu — otomatis ganti lagu pas habis, urut acak tiap sesi */
const BGM=(function(){
  let el=null,idx=-1,order=[];
  const TRACKS=['track01.mp3','track02.mp3','track03.mp3','track04.mp3','track05.mp3','track06.mp3','track07.mp3','track08.mp3','track09.mp3','track10.mp3'];
  function shuffle(a){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
  function nextTrack(){ // ganti ke lagu berikutnya (dipakai skip manual & auto-next)
    try{
      const a=get();
      if(order.length!==TRACKS.length)order=shuffle(TRACKS);
      idx=(idx+1)%order.length;
      a.src='assets/audio/'+order[idx];
      a.volume=.35;
      a.play().catch(()=>{});
    }catch(e){}
  }
  function get(){
    if(!el){
      el=document.createElement('audio');
      el.id='bgmTrack';
      el.volume=.35;el.preload='none'; // NONE: gak buffer 2-4MB lagu pas page buka (kentang hemat) — ke-load pas play
      el.addEventListener('ended',nextTrack); // lagu habis -> lagu berikutnya
      document.head.appendChild(el);
    }
    return el;
  }
  function play(){
    try{
      const a=get();
      if(a.src&&a.src.indexOf('track')>=0){
        /* lagu udah kepasang tapi PAUSE (autoplay diblok browser pas buka page)?
           play lagi — ini bug lama: early-return bikin musik gak pernah bunyi */
        if(a.paused)a.play().catch(()=>{});
        return; // jangan ganti lagu
      }
      nextTrack();
    }catch(e){}
  }
  return{
    play,
    stop(){try{if(el){el.pause()}}catch(e){}},
    next:nextTrack,
    current(){return el&&el.src?el.src.split('/').pop():'-'},
  };
})();
function sfxPlay(){ /* SFX langkah/dadu/makan DIHAPUS — sisa suara cuma BGM lagu */ }
function applySound(){
  if(SFX.on){BGM.play();SFX.init()}else{BGM.stop()}
}
/* HP: browser blok autoplay — pas gesture pertama (tap/tekan), langsung gas kalau sound ON */
function firstGesture(){
  if(SFX.on){SFX.init();BGM.play()}
  removeEventListener('touchstart',firstGesture,{passive:true});
  removeEventListener('click',firstGesture);
  removeEventListener('keydown',firstGesture);
}
addEventListener('touchstart',firstGesture,{passive:true});
addEventListener('click',firstGesture);
addEventListener('keydown',firstGesture);
function updSndBtn(){$('#sndBtn').textContent=SFX.on?'🔊 SOUND ON':'🔇 SOUND OFF'}
$('#sndBtn').addEventListener('click',()=>{
  SFX.init();SFX.on=!SFX.on;
  localStorage.setItem('gl-snd',SFX.on?'1':'0');
  updSndBtn();applySound();
});
updSndBtn();
/* BGM default ON & persist antar screen/reload — langsung gas pas buka web */
applySound();

/* ================= toasts ================= */
function toast(msg,ms){
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  $('#toasts').appendChild(t);
  setTimeout(()=>{t.style.transition='opacity .4s, transform .4s';t.style.opacity='0';t.style.transform='translateY(-10px)';
    setTimeout(()=>t.remove(),420)},ms||2000);
  while($('#toasts').children.length>3)$('#toasts').firstChild.remove();
}
