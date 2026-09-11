"use strict";
/* GACOR LUDO - net.js: online via PeerJS (host authoritatif, kode room) */
/* ================= net (PeerJS) ================= */
const NET={on:false,host:false,mySeat:0,peer:null,conn:null,conns:[],code:'',pw:'',seats:null,started:false};
const PEERJS_SRC='https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const PFX='gacor-ludo-v1-';
const PUBMAX=16; // slot room publik: PUB00..PUB15
const pubCode=n=>'PUB'+String(n).padStart(2,'0');
function loadPeerJS(){
  return new Promise((res,rej)=>{
    if(window.Peer)return res();
    const s=document.createElement('script');s.src=PEERJS_SRC;s.async=true;
    s.onload=()=>window.Peer?res():rej(new Error('PeerJS load gagal'));
    s.onerror=()=>rej(new Error('PeerJS load gagal — cek internet'));
    document.head.appendChild(s);
    setTimeout(()=>{if(!window.Peer)rej(new Error('PeerJS timeout'))},9000);
  });
}
const genCode=()=>{const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let c='';for(let i=0;i<5;i++)c+=A[Math.floor(Math.random()*A.length)];return c};
const snap=()=>JSON.parse(JSON.stringify(G));
function broadcast(anim){
  render();
  if(!NET.on||!NET.host)return;
  const msg={t:'st',g:snap()};if(anim)msg.anim=anim.anim||anim;
  for(const c of NET.conns)if(c.open)c.send(msg);
}
function broadcastLobby(){
  renderLobby();
  if(!NET.on||!NET.host)return;
  for(const c of NET.conns){if(!c.open)continue;
    c.send({t:'lobby',code:NET.code,seats:NET.seats,you:c._seat})}
}
async function hostRoom(mode,pw){
  if(!ME)return toast('login dulu biar bisa bikin room 🎫');
  const isPriv=mode==='private';
  if(isPriv&&!(pw||'').trim())return toast('room privat butuh password — isi dulu 🔑');
  toast('nyambungin ke server room…',1400);
  try{await loadPeerJS()}catch(e){return toast('gagal load PeerJS: '+e.message)}
  let code=genCode(),tries=0;
  const mk=c=>new Promise((res,rej)=>{
    const p=new Peer(PFX+c,{debug:0});
    p.on('open',()=>res(p));
    p.on('error',e=>{if(e.type==='unavailable-id'&&tries<3){tries++;code=genCode();p.destroy();res(mk(code))}else rej(e)});
  });
  /* room publik: rebut slot PUB00..PUB15 (id first-wins) biar ke-list di menu semua orang */
  if(!isPriv){
    const mkPub=c=>new Promise((res,rej)=>{ // gak ada retry random — slot ditempat = pindah slot
      const p=new Peer(PFX+c,{debug:0});
      p.on('open',()=>res(p));
      p.on('error',e=>{try{p.destroy()}catch(x){}rej(e)});
    });
    let got=null;
    for(let i=0;i<PUBMAX&&!got;i++){
      try{got=await mkPub(pubCode(i))}catch(e){}
    }
    if(!got)return toast('slot room publik penuh — coba lagi bentar 🌍');
    peerUp(got,code,'');return;
  }
  let peer;
  try{peer=await mk(code)}catch(e){toast('gagal bikin room: '+e.type);return}
  peerUp(peer,code,(pw||'').trim());
}
function peerUp(peer,code,pw){
  NET.on=true;NET.host=true;NET.peer=peer;NET.code=code;NET.pw=pw;NET.mySeat=0;NET.started=false;
  NET.seats=[{name:myName(),kind:'human'},{name:'',kind:'open'},{name:'',kind:'open'},{name:'',kind:'open'}];
  peer.on('connection',c=>{
    c.on('data',m=>hostOnData(c,m));
    c.on('close',()=>hostDrop(c));
    c.on('error',()=>hostDrop(c));
  });
  peer.on('error',e=>{if(e.type!=='peer-unavailable')toast('jaringan room bermasalah: '+e.type)});
  /* JANGAN otomatis masuk lobby — room kebikin di background, host masuk sendiri */
  toast('ROOM '+(pw?'PRIVAT 🔒':'PUBLIK 🌍')+' SIAP — klik MASUK 🎫',3500);
  resetHostBtn(true); /* tombol jadi "MASUK ROOM" — room nunggu host masuk */
  renderLobby(); /* siapin lobby data — tapi tetap di menu */
}
function enterHostLobby(){ /* dipanggil pas host klik MASUK ROOM */
  show('lobby');renderLobby();
  $('#roomChip').hidden=false;$('#roomChip').textContent='ROOM '+NET.code+(NET.pw?' 🔒':'');
  CHAT.resetLobby(); /* chat lobby kosong buat host (baru "join") */
}
function resetHostBtn(ready){ /* tombol BUAT ROOM ⇄ MASUK ROOM — ready=true: nunggu host masuk */
  const b=document.querySelector('button[data-mode="host"],button[data-mode="enterhost"]');
  if(!b)return;
  if(ready&&NET.on&&NET.host&&!NET.started){
    b.dataset.mode='enterhost';b.textContent='MASUK ROOM '+NET.code+' →';b.classList.add('ready');
  }else{
    b.dataset.mode='host';b.textContent='BUAT ROOM →';b.classList.remove('ready');
  }
}
function hostOnData(c,m){
  if(!m)return;
  if(m.t==='hello'){
    if(NET.started){c.send({t:'kick',why:'game udah mulai'});setTimeout(()=>c.close(),300);return}
    const seat=NET.seats.findIndex(s=>s.kind==='open');
    if(seat<0){c.send({t:'kick',why:'room penuh'});setTimeout(()=>c.close(),300);return}
    if(NET.pw&&String(m.pw||'').trim()!==NET.pw){c.send({t:'kick',why:'password room salah 🔑'});setTimeout(()=>c.close(),300);return}
    c._seat=seat;NET.seats[seat]={name:san(m.name),kind:'human'};
    NET.conns.push(c);broadcastLobby();
  }
  else if(m.t==='meta'){ // probe daftar room publik — jawab info, gak ambil kursi
    c.send({t:'meta',started:!!NET.started,
      host:(NET.seats&&NET.seats[0]&&NET.seats[0].name)||'HOST',
      players:(NET.seats||[]).filter(s=>s.kind==='human'||s.kind==='bot').length,max:4});
    setTimeout(()=>{try{c.close()}catch(e){}},200);
  }
  else if(m.t==='chat'){ // relay chat ke semua + simpen host
    DB.addChat(NET.code||'?',m.seat,san(m.name),String(m.text||'').slice(0,120));
    if(typeof CHAT!=='undefined'&&CHAT.renderChat)CHAT.renderChat(true);
    for(const c2 of NET.conns)if(c2.open&&c2!==c)c2.send({t:'chat',name:san(m.name),seat:m.seat,text:m.text});
    /* chat lobby room: relay in-memory juga (joiner baru gak liat yang lama, yang udah di dalem tetep liat) */
    if(!NET.started&&document.querySelector('#scr-lobby')&&!document.querySelector('#scr-lobby').hidden){
      if(typeof CHAT!=='undefined'&&CHAT.pushLobby)CHAT.pushLobby({name:san(m.name),seat:m.seat,text:String(m.text||'').slice(0,120)});
    }
  }
  else if(m.t==='roll'||m.t==='move'){
    const st=c._seat;if(st==null||!G)return;
    if(G.turn!==st||G.seats[st].auto||G.over)return;
    clearTimeout(idleT[st]);
    if(m.t==='roll'&&G.phase==='roll')doRoll();
    else if(m.t==='move'&&G.phase==='move'){const mv=legal(st,G.dice).find(x=>x.k===m.k);if(mv)doMove(mv)}
  }
  else if(m.t==='bye'){hostDrop(c)}
}
function hostDrop(c){
  const i=NET.conns.indexOf(c);if(i>=0)NET.conns.splice(i,1);
  const st=c._seat;if(st==null)return;
  if(!NET.started&&NET.seats){if(NET.seats[st].kind==='human'){NET.seats[st]={name:'',kind:'open'};broadcastLobby()}}
  else if(G&&!G.over&&G.seats[st].kind==='human'){G.seats[st].auto=true;
    toast(G.seats[st].name+' putus — bot gantian 🤖');log(st,G.seats[st].name+' putus, bot gantian');
    if(G.turn===st)botKick();broadcast()}
}
async function joinRoom(code,pw){
  code=(code||'').trim().toUpperCase();
  if(!/^[A-Z2-9]{4,6}$/.test(code))return toast('kode room gak valid');
  if(!ME)return toast('login dulu biar bisa join 🎫');
  toast('cari room '+code+'…',1400);
  try{await loadPeerJS()}catch(e){return toast('gagal load PeerJS: '+e.message)}
  const peer=new Peer({debug:0});
  NET.on=true;NET.host=false;NET.code=code;NET.mySeat=-1;NET.peer=peer;NET.started=false;
  const fail=t=>{toast(t);cleanupNet()};
  const to=setTimeout(()=>{if(NET.mySeat<0)fail('room nggak ketemu — cek kode / internet')},10000);
  peer.on('error',e=>{
    if(e.type==='peer-unavailable'){clearTimeout(to);fail('room '+code+' nggak ada (udah tutup / salah kode)')}
    else if(e.type!=='peer-unavailable'){clearTimeout(to);fail('koneksi gagal: '+e.type)}
  });
  peer.on('open',()=>{
    const conn=peer.connect(PFX+code,{reliable:true});
    NET.conn=conn;
    conn.on('open',()=>conn.send({t:'hello',name:myName(),pw:String(pw||'').trim()}));
    conn.on('data',m=>{
      if(!m)return;
      if(m.t==='lobby'){clearTimeout(to);NET.started=false;NET.code=m.code;NET.mySeat=m.you;NET.seats=m.seats;
        show('lobby');renderLobby();
        CHAT.resetLobby(); /* joiner baru: chat lobby mulai kosong — yang join duluan chatnya tetep di layar dia */
        $('#roomChip').hidden=false;$('#roomChip').textContent='ROOM '+m.code;}
      else if(m.t==='start'){NET.started=true;G=m.g;buildTokens();buildPlayers();show('game');
        $('#quitBtn').hidden=false;render();botKickLocalOnly()}
      else if(m.t==='st'){G=m.g;if(m.anim&&!animLock){playRemoteAnim(m.anim)}else render();
        if(G.over&&!NET.overShown){NET.overShown=true;setTimeout(gameOver,900)}}
      else if(m.t==='chat'){ // chat dari host relay
        /* di lobby room: masuk ke chat lobby in-memory; di game/match: ke DB match */
        if(!NET.started&&document.querySelector('#scr-lobby')&&!document.querySelector('#scr-lobby').hidden){
          if(typeof CHAT!=='undefined'&&CHAT.pushLobby)CHAT.pushLobby({name:san(m.name),seat:m.seat,text:String(m.text||'').slice(0,120)});
        }else{
          DB.addChat(NET.code||'?',m.seat,san(m.name),String(m.text||'').slice(0,120));
          if(typeof CHAT!=='undefined'&&CHAT.renderChat)CHAT.renderChat(true);
        }
      }
      else if(m.t==='kick'){clearTimeout(to);toast('nggak bisa masuk: '+m.why);cleanupNet()}
    });
    conn.on('close',()=>{if(NET.on&&!NET.host){
      toast('koneksi ke host putus 💔');
      if(G&&!G.over){ // game masih jalan tapi host ilang -> game mati buat client
        showModal('<h2>HOST KABUR 🫠</h2><div class="msub">host nutup koneksi di tengah game — game-nya gak bisa lanjut</div>'+
          '<div class="mbtns"><button class="go" id="mNet">BALIK MENU</button></div>');
        var mb=document.getElementById('mNet');if(mb)mb.onclick=function(){hideModal();leaveAll()};
      }
      cleanupNet();
    }});
  });
}
function botKickLocalOnly(){ /* clients: bots are driven by host broadcasts; nothing to do */ }
function playRemoteAnim(a){
  if(a.type==='roll')spinDice(a.v);
  else if(a.type==='move')animateMove(a);
}

/* ================= ROOM PUBLIK: slot probe PUB00..PUB15 =================
   listAllPeers dimatikan di cloud PeerJS, jadi room publik makai slot tetap:
   host publik nyantol di id PUB00..PUB15, menu probing slot itu buat daftar. */
function probePub(cb){ /* probing slot PUB di-batch 4 per 900ms — 16 koneksi serentak bikin kentang ngos */
  const out=[];
  if(!window.Peer){cb(out);return}
  const p=new Peer({debug:0});
  let n=0;
  const doneOne=()=>{if(++n>=PUBMAX){try{p.destroy()}catch(e){}cb(out)}};
  p.on('error',()=>{}); // probe error (id dsb) diabaikan — slot kosong biasanya timeout aja
  p.on('disconnected',()=>{try{p.reconnect()}catch(e){}});
  p.on('open',()=>{
    let idx=0;
    const batch=()=>{
      const hi=Math.min(idx+4,PUBMAX);
      for(;idx<hi;idx++){
        const slot=idx;
        const c=p.connect(PFX+pubCode(slot),{reliable:true});
        c.on('open',()=>{
          c.send({t:'meta'});
          const t2=setTimeout(()=>{try{c.close()}catch(e){};doneOne()},2500);
          c.on('data',m=>{
            if(m&&m.t==='meta'&&!m.started){clearTimeout(t2);
              out.push({slot:pubCode(slot),host:m.host||'HOST',players:m.players||1,max:m.max||4});
              try{c.close()}catch(e){};doneOne()}
            else if(m&&m.t==='meta'&&m.started){clearTimeout(t2);try{c.close()}catch(e){};doneOne()}});
        });
        c.on('error',()=>doneOne());
        setTimeout(()=>{if(!c.open)doneOne()},3200); // slot kosong: peer-unavailable / gak kebuka
      }
      if(idx<PUBMAX)setTimeout(batch,900);
    };
    batch();
  });
}
function scanPubRooms(){
  const box=$('#pubBox');if(!box)return;
  if(typeof ME==='undefined'||!ME){box.innerHTML='<span class="mut">login dulu buat liat room publik 🌍</span>';return}
  if(NET.on){return} // lagi di room / game — jangan scan
  loadPeerJS().then(()=>{
    box.innerHTML='<span class="mut">cari room publik…</span>';
    probePub(list=>{
      const box2=$('#pubBox');if(!box2||NET.on)return;
      if(!list.length){box2.innerHTML='<span class="mut">sepi — belum ada room publik 🌙</span>';return}
      box2.innerHTML=list.map(r=>
        '<div class="pubRow"><span class="pc">'+r.slot+'</span><span class="ph">'+esc2(r.host)+' • '+r.players+'/'+r.max+' pemain</span>'+
        '<button class="go" data-joinpub="'+r.slot+'">MASUK →</button></div>').join('');
      box2.querySelectorAll('[data-joinpub]').forEach(b=>{
        b.addEventListener('click',()=>{b.disabled=true;joinRoom(b.dataset.joinpub,'')});
      });
    });
  }).catch(()=>{});
}
function cleanupNet(){
  clearTimers();
  try{if(NET.conn)NET.conn.close()}catch(e){}
  try{for(const c of NET.conns)c.close()}catch(e){}
  try{if(NET.peer)NET.peer.destroy()}catch(e){}
  NET.on=false;NET.host=false;NET.peer=null;NET.conn=null;NET.conns=[];NET.started=false;NET.overShown=false;
  $('#roomChip').hidden=true;
  if(typeof resetHostBtn==='function')resetHostBtn(false);
}
function san(s){return String(s||'').replace(/[<>]/g,'').slice(0,12)||'Teman'}
