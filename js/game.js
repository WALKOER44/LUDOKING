"use strict";
/* GACOR LUDO - game.js: state, aturan, bot, mesin giliran (authoritatif) */
/* ================= helpers ================= */
const $=s=>document.querySelector(s);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rndOf=a=>a[Math.floor(Math.random()*a.length)];
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const ERRS=[];window.__LUDO_ERRS=ERRS;
window.addEventListener('error',e=>ERRS.push(String(e.message)));
window.addEventListener('unhandledrejection',e=>ERRS.push(String(e.reason)));

/* ================= data ================= */
const COLS=[
  {id:'red',   nm:'MERAH', c:'var(--red)',   cv:'#E5484D', cd:'#B3383C'},
  {id:'green', nm:'HIJAU', c:'var(--green)', cv:'#2FBF71', cd:'#1F8A50'},
  {id:'yellow',nm:'KUNING',c:'var(--yellow)',cv:'#F2B705', cd:'#B98A04'},
  {id:'blue',  nm:'BIRU',  c:'var(--blue)',  cv:'#3E8BFF', cd:'#2A5FB3'},
];
const PATH=[[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],
[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],
[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],
[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6]];
const HOMEI=[0,13,26,39];
const HOMEPATH=[
  [[1,7],[2,7],[3,7],[4,7],[5,7]],
  [[7,1],[7,2],[7,3],[7,4],[7,5]],
  [[13,7],[12,7],[11,7],[10,7],[9,7]],
  [[7,13],[7,12],[7,11],[7,10],[7,9]],
];
const SAFEABS=new Set([0,8,13,21,26,34,39,47]);
const STARTABS={0:0,1:13,2:26,3:39};
const DIRG=['→','↓','←','↑'];
const BOTNAMES=['Mamang Rudi','Sultan Dadu','Ratu Gacor','Mbah Soer','Duta Dadu','Jago Kudus','Kapiten Dadu','Raja Token'];
const LVLS={easy:'GAAMPANG',medium:'SEDANG',hard:'SUSAH'};
const relToAbs=(s,p)=>(HOMEI[s]+p)%52;
const absCell=a=>PATH[a];

/* ================= game state ================= */
let G=null;              // authoritative state
let SPD=1;               // speed multiplier (tests)
let rigQ=[];             // forced dice (tests)
let rngF=Math.random;
let lastCfg=null;
/* Dadu boost: awal game tiap pemain punya "lucky meter".
   Kalau udah 2x giliran gak dapet 6 ATAU 3x gak ada langkah,
   peluang dapet 6 naikin bertahap (max 45%) biar game jalan, tetep random. */
function rollDice(s){
  if(rigQ.length)return rigQ.shift();
  const pl=G.seats[s];
  const pity=pl&&pl.dry!==undefined?pl.dry:0;
  const boost=Math.min(0.45,(pity>=2?0.10+pity*0.05:0));
  const r=rngF();
  if(r<boost)return 6;
  return 1+Math.floor(rngF()*5);
}
const d6=()=>{throw new Error('pakai rollDice(seat)')};

function newGame(seats,seed){
  if(seed!=null)rngF=mulberry32(seed);else rngF=Math.random;
  G={st:0,seats,tok:[[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]],
     turn:seats.findIndex(s=>s.active),phase:'roll',dice:0,streak:0,
     fin:[[],[],[],[]],rank:[],over:false,log:[]};
  for(const pl of G.seats)if(pl.active)pl.dry=0;
  buildTokens();buildPlayers();
  show('game');$('#quitBtn').hidden=false;
  toast('GAME MULAI — semoga gacor 🍀');
  log(G.turn,'game mulai! giliran '+G.seats[G.turn].name);
  render();boardIntro();broadcast();botKick();
}
function mkSeats(list){ // list of [seatIdx, kind, name, level]
  const seats=[0,1,2,3].map(i=>({seat:i,name:'',kind:'off',active:false,auto:false,done:false}));
  for(const [i,kind,name,level] of list){
    seats[i]={seat:i,kind,name:name||COLS[i].nm,active:true,auto:false,done:false,dry:0,
      level:kind==='bot'?(level||'medium'):'human'}
  }
  return seats;
}
function log(seat,msg){if(!G)return;G.log.push({seat,msg:msg.slice(0,90)});if(G.log.length>30)G.log.shift()}
function activeSeats(){return G.seats.filter(s=>s.active)}
function nextSeat(){let n=G.turn;do{n=(n+1)%4}while(!G.seats[n].active);G.turn=n}

/* ---- rules ---- */
function checkLand(seat,abs){
  if(SAFEABS.has(abs))return{block:false,cap:null};
  let cap=null,n=0;
  for(const pl of G.seats){if(!pl.active||pl.seat===seat)continue;
    for(let k=0;k<4;k++){const p=G.tok[pl.seat][k];
      if(p>=0&&p<=50&&relToAbs(pl.seat,p)===abs){n++;cap={seat:pl.seat,k}}}}
  if(n>=2)return{block:true,cap:null};
  return{block:false,cap:n===1?cap:null};
}
function legal(seat,d){
  const mv=[];
  for(let k=0;k<4;k++){const p=G.tok[seat][k];
    if(p===56)continue;
    let to;
    if(p===-1){if(d!==6)continue;to=0}
    else{to=p+d;if(to>56)continue}
    if(to<=50){const c=checkLand(seat,relToAbs(seat,to));if(c.block)continue;mv.push({k,from:p,to,cap:c.cap})}
    else mv.push({k,from:p,to,cap:null});
  }
  return mv;
}
function apply(m,seat){
  G.tok[seat][m.k]=m.to;
  const r={capd:false,fin:false};
  if(m.cap){G.tok[m.cap.seat][m.cap.k]=-1;r.capd=true;
    log(seat,'💥 '+G.seats[seat].name+' makan token '+G.seats[m.cap.seat].name+'! balik markas');
    toast(G.seats[seat].name+' makan token '+G.seats[m.cap.seat].name+' 💥');}
  if(m.to===56){G.fin[seat].push(m.k);r.fin=true;
    log(seat,'🏠 '+G.seats[seat].name+' satu token sampai rumah');
    if(G.fin[seat].length===4){G.seats[seat].done=true;G.rank.push(seat);G.over=true;
      log(seat,'🏆 '+G.seats[seat].name+' JAGOAN!');}}
  return r;
}
function eatFlash(col){ // flash merah + nama korban — dipanggil animateMove pas makan
  const f=document.getElementById('eatFlash');
  if(!f)return;
  f.style.background=col||'rgba(229,72,77,.22)';
  f.classList.remove('on');
  void f.offsetWidth; // restart animasi
  f.classList.add('on');
}
function movePath(seat,m){
  const path=[];
  if(m.from===-1){path.push(absCell(HOMEI[seat]));return path}
  for(let p=m.from+1;p<=m.to;p++){
    if(p<=50)path.push(absCell(relToAbs(seat,p)));
    else if(p<=55)path.push(HOMEPATH[seat][p-51]);
  }
  return path;
}
const WEDGE_DIR=seat=>[[-1,0],[0,-1],[1,0],[0,1]][seat];
function finalPath(seat,m){ // dipanggil SETELAH apply() supaya fin[] udah keupdate
  const path=movePath(seat,m);
  if(m.to===56){const d=WEDGE_DIR(seat);const i=G.fin[seat].length-1;
    path.push([7.5+d[0]*(0.95-i*0.22),7.5+d[1]*(0.95-i*0.22)])}
  return path;
}

/* ---- bot ---- */
function threat(seat,p){ // opponents 1..6 steps behind rel pos p
  if(p<0||p>50)return 0;
  const abs=relToAbs(seat,p);let n=0;
  for(const pl of G.seats){if(!pl.active||pl.seat===seat)continue;
    for(let k=0;k<4;k++){const po=G.tok[pl.seat][k];
      if(po>=0&&po<=50){const ao=relToAbs(pl.seat,po);const d0=(abs-ao+52)%52;if(d0>=1&&d0<=6)n++}}}
  return n;
}
function botPick(s,d){
  const mv=legal(s,d);if(!mv.length)return null;
  const lvl=G.seats[s].level||'medium';
  /* easy: 45% milih random, nggak mikir ancaman
     medium: kayak semula — mikir basic
     hard: full hitung + 2 langkah ke depan (greedy lookahead ringan) */
  const noise=lvl==='easy'?22:lvl==='medium'?7:2;
  let best=mv[0],bs=-1e9;
  for(const m of mv){
    let v=Math.random()*noise;
    if(m.to===56)v+=120;
    if(m.cap){v+=90+G.tok[m.cap.seat][m.cap.k]*0.45;
      if(lvl!=='easy')v+=threat(m.cap.seat,G.tok[m.cap.seat][m.cap.k])*4} // makan token yang paling maju + bahaya buat lawan
    if(m.from===-1){const out=G.tok[s].filter(p=>p>=0&&p<56).length;v+=out===0?70:out<2?42:14}
    if(lvl!=='easy'&&m.to<=50&&SAFEABS.has(relToAbs(s,m.to)))v+=14;
    if(lvl!=='easy'&&m.from>=0&&m.from<=50){const t=threat(s,m.from);if(t)v+=Math.min(t,3)*9}
    if(lvl!=='easy'&&m.to<=50){const t=threat(s,m.to);if(t)v-=Math.min(t,3)*11}
    v+=m.to*0.25;
    if(lvl==='hard'&&m.to<=50){ // lookahead: kalau abis gerak masih bisa dimakan lawan dgn dadu 5/6, kurangi
      const abs2=relToAbs(s,m.to);
      let danger=0;
      if(!SAFEABS.has(abs2)){
        for(const pl of G.seats){if(!pl.active||pl.seat===s)continue;
          for(let k2=0;k2<4;k2++){const po=G.tok[pl.seat][k2];
            if(po>=0&&po<=50){const ao=relToAbs(pl.seat,po);
              const dd=(abs2-ao+52)%52;
              if(dd>=1&&dd<=6)danger++;
              const dd2=(ao-abs2+52)%52; // kita di belakang dia -> kita bisa makan dia
              if(dd2>=1&&dd2<=6)v+=3;
            }}}
        v-=danger*6;
      }
    }
    if(v>bs){bs=v;best=m}
  }
  return best;
}

/* ================= turn engine (authority) ================= */
let botT=null,idleT={};
const wait=ms=>sleep(ms/SPD);
function clearTimers(){clearTimeout(botT);for(const k in idleT)clearTimeout(idleT[k])}
function botKick(){
  clearTimeout(botT);
  if(!G||G.over)return;
  const pl=G.seats[G.turn];
  if(pl.kind!=='bot'&&!pl.auto)return;
  const dly=G.phase==='roll'?780:620;
  botT=setTimeout(()=>{
    if(!G||G.over)return;
    if(G.phase==='roll')doRoll();
    else if(G.phase==='move'){const m=botPick(G.turn,G.dice);if(m)doMove(m)}
  },dly/SPD);
}
function idleWatch(){ // host: AFK remote humans -> auto
  if(!NET.on||!NET.host||!G||G.over)return;
  for(const k in idleT)clearTimeout(idleT[k]);
  const pl=G.seats[G.turn];
  if(pl.kind==='human'&&pl.seat!==0){
    idleT[pl.seat]=setTimeout(()=>{
      if(!G||G.over||G.turn!==pl.seat)return;
      if(G.phase==='roll'||G.phase==='move'){pl.auto=true;
        toast(pl.name+' AFK — bot gantian 🤖');log(pl.seat,pl.name+' AFK, bot gantian');botKick()}
    },30000);
  }
}
async function doRoll(){
  if(!G||G.over||G.phase!=='roll')return;
  const s=G.turn,pl=G.seats[s];
  const d=rollDice(s);
  G.dice=d;G.streak=d===6?G.streak+1:0;
  pl.dry=d===6?0:(pl.dry||0)+1; // dry streak: giliran tanpa angka 6
  log(s,pl.name+' lempar dadu: '+d+(d===6?' — ENAM! 🎉':''));
  G.phase='rolling';G.st++;broadcast({anim:{type:'roll',v:d,st:G.st}});
  await spinDice(d);
  if(G.streak===3){
    log(s,'🔥 '+pl.name+' 3x enam — giliran hangus');toast('3x ENEM — giliran hangus 🔥');
    await wait(520);return endTurn(false);
  }
  const mv=legal(s,d);
  if(!mv.length){
    log(s,'⏭️ '+pl.name+' nggak ada jalan');toast(pl.name+' nggak ada langkah ⏭️',1100);
    await wait(750);
    if(d===6){G.phase='roll';G.dice=0;G.st++;broadcast();botKick();idleWatch();return}
    return endTurn(false);
  }
  if(mv.length===1){
    await wait(560);toast('cuma satu jalan — auto gas ⚡',900);
    return doMove(mv[0]);
  }
  G.phase='move';G.st++;broadcast();botKick();idleWatch();
}
async function doMove(m){
  if(!G||G.over||(G.phase!=='move'&&G.phase!=='rolling'))return;
  const s=G.turn;
  const r=apply(m,s);
  const anim={type:'move',seat:s,k:m.k,from:m.from,to:m.to,caps:m.cap?[m.cap]:[],fin:r.fin,path:null,st:0};
  anim.path=finalPath(s,m);
  G.phase='anim';G.st++;anim.st=G.st;broadcast({anim});
  if(m.from===-1)log(s,'🚀 '+G.seats[s].name+' narik token keluar markas');
  await animateMove(anim);
  if(G.over)return gameOver();
  endTurn(G.dice===6||r.capd||r.fin);
}
function endTurn(extra){
  if(!extra){G.streak=0;nextSeat();G.dice=0}
  G.phase='roll';G.st++;broadcast();botKick();idleWatch();
  if(!G.over)sfxPlay('turn');
}
