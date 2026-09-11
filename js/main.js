"use strict";
/* GACOR LUDO - main.js: auth (remember me + auto-login + role admin), menu/lobi, chat, riwayat, boot, test hooks */

/* ================= session / auth ================= */
let ME=null; // {name, guest:bool}
const REMEMBER_KEY='gl_remember';
function loadMe(){
  try{ME=JSON.parse(sessionStorage.getItem('gl_me'))||null}catch(e){ME=null}
  if(ME){
    $('#userChip').hidden=false;
    $('#userChip').textContent=(ME.guest?'🤎 ':'👤 ')+ME.name;
    const n=$('#nameIn');if(n)n.value=ME.name;
    // tombol ADMIN cuma muncul kalau role admin di DB (bukan tamu)
    $('#adminBtn').hidden=!!(ME.guest||!DB.isAdmin(ME.name));
  }else{
    $('#adminBtn').hidden=true;
  }
}
function saveMe(){sessionStorage.setItem('gl_me',JSON.stringify(ME))}
function logout(){
  DB.unbeat(ME?ME.name:'');
  ME=null;sessionStorage.removeItem('gl_me');
  sessionStorage.removeItem('gl_admin'); // sesi admin ikut kehapus — jangan nyangkut setelah logout
  localStorage.removeItem(REMEMBER_KEY); // logout = hapus remember me juga
  $('#userChip').hidden=true;$('#adminBtn').hidden=true;
  show('auth');
}

/* ================= auth wiring ================= */
const AUTH=(function(){
  function tab(login){
    $('#tabLogin').classList.toggle('on',login);
    $('#tabReg').classList.toggle('on',!login);
    $('#fLogin').hidden=!login;$('#fReg').hidden=login;
  }
  $('#tabLogin').addEventListener('click',()=>tab(true));
  $('#tabReg').addEventListener('click',()=>tab(false));
  function enter(name,guest,remember){
    ME={name,guest:!!guest};saveMe();loadMe();
    DB.beat(name,'menu');
    /* Remember Me: simpan kredensial di localStorage biar auto-login next visit */
    if(remember&&!guest){
      const u=$('#loginUser').value,p=$('#loginPw').value;
      if(u&&p)localStorage.setItem(REMEMBER_KEY,JSON.stringify({u,p}));
    }
    show('menu');renderHist();scanPubRooms();
    toast(guest?'main sebagai tamu 🤎 — chat & riwayat tetep kesimpen':'selamat datang, '+name+' 🎉');
  }
  $('#btnLogin').addEventListener('click',()=>{
    const r=DB.login($('#loginUser').value,$('#loginPw').value);
    if(r.err)return toast(r.err);
    enter(r.user.name,false,$('#rememberMe').checked);
  });
  $('#loginPw').addEventListener('keydown',e=>{if(e.key==='Enter')$('#btnLogin').click()});
  $('#btnReg').addEventListener('click',()=>{
    if($('#regPw').value!==$('#regPw2').value)return toast('password ulangannya beda 🫠');
    const r=DB.register($('#regUser').value,$('#regPw').value);
    if(r.err)return toast(r.err);
    enter(r.user.name,false);
    toast('akun jadi! selamat main 🚀');
  });
  $('#regPw2').addEventListener('keydown',e=>{if(e.key==='Enter')$('#btnReg').click()});
  $('#btnGuest').addEventListener('click',()=>{
    let n='Tamu'+Math.floor(100+Math.random()*900);
    enter(n,true);
  });
  $('#userChip').addEventListener('click',()=>{
    if(!ME)return;
    const adm=!!(!ME.guest&&DB.isAdmin(ME.name));
    showModal('<h2>'+ME.name+'</h2><div class="msub">'+(ME.guest?'main sebagai tamu — daftar biar stat kesimpen':(adm?'👑 role: ADMIN':'akun terdaftar'))+'</div>'+
      '<div class="mbtns"><button class="ghost" id="mOut">LOGOUT</button><button class="go" id="mOk">LANJUT MAIN</button></div>');
    $('#mOut').onclick=()=>{hideModal();logout()};
    $('#mOk').onclick=hideModal;
  });
  $('#adminBtn').addEventListener('click',()=>{
    if(location.hash==='#admin')checkHash(); // hash udah #admin (balik dari admin) — gak ada hashchange, paksa cek
    else location.href='#admin';
  });

  /* AUTO-LOGIN: kalau ada sesi remember me tersimpan, langsung masuk lobby */
  function tryAutoLogin(){
    let rem=null;
    try{rem=JSON.parse(localStorage.getItem(REMEMBER_KEY))}catch(e){}
    if(!rem||!rem.u||!rem.p)return false;
    const r=DB.login(rem.u,rem.p);
    if(r.err){localStorage.removeItem(REMEMBER_KEY);return false}
    ME={name:r.user.name,guest:false};saveMe();loadMe();
    DB.beat(ME.name,'menu');
    return true;
  }
  return{tryAutoLogin};
})();

/* ================= menu / lobby wiring ================= */
function segVal(id){return $('#'+id+' button.on').dataset.v}
function segGlider(id){ // indikator kuning yang meluncur antar tombol seg
  const seg=$('#'+id);if(!seg)return;
  let g=seg.querySelector('.segGlider');
  if(!g){g=document.createElement('div');g.className='segGlider';seg.insertBefore(g,seg.firstChild)}
  const on=seg.querySelector('button.on');if(!on){g.style.display='none';return}
  g.style.display='';
  g.style.left=(on.offsetLeft-4)+'px'; // -4 padding seg
  g.style.width=on.offsetWidth+'px';
}
for(const segId of ['botN','roomMode']){
  const seg=$('#'+segId);
  const move=e=>{
    const b=e.target.closest('button');if(!b)return;
    seg.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    segGlider(segId);
    if(segId==='roomMode')$('#roomPwIn').hidden=b.dataset.v!=='private';
  };
  seg.addEventListener('click',move);
  addEventListener('resize',()=>segGlider(segId));
}
setTimeout(()=>{segGlider('botN');segGlider('roomMode')},80); // posisi awal pas init
function myName(){return ME?ME.name:'Teman'}
const seatMapFor={bot:{1:[2],2:[1,2],3:[1,2,3]}};
function startLocal(cfg){
  lastCfg=cfg;
  const name=myName();
  let seats;
  if(cfg.mode==='bot'){
    const bots=seatMapFor.bot[+cfg.n];
    seats=mkSeats([[0,'human',name],...bots.map(s=>[s,'bot',rndOf(BOTNAMES),cfg.level||'medium'])]);
  }else{
    seats=mkSeats([[0,'human',name]]);
  }
  if(typeof CHAT!=='undefined'&&CHAT.newMatch)CHAT.newMatch('bot-'+Date.now().toString(36)); // chat match bersih tiap game baru
  newGame(seats,cfg.seed);
}
function startNetGame(){
  const list=[[0,'human',NET.seats[0].name]];
  const lvl=NET.botLevel||'medium';
  for(let i=1;i<4;i++){const s=NET.seats[i];
    if(s.kind==='bot')list.push([i,'bot',s.name||rndOf(BOTNAMES),lvl]);
    else if(s.kind==='human')list.push([i,'human',s.name]);
  }
  if(list.length<2)return toast('minimal 2 pemain — tambah bot atau share kodenya 🔑');
  NET.started=true;lastCfg={mode:'net',list,level:lvl};
  G=null;
  if(typeof CHAT!=='undefined'&&CHAT.newMatch)CHAT.newMatch(NET.code); // room online: chat per room
  newGame(mkSeats(list),null);
  for(const c of NET.conns)if(c.open)c.send({t:'start',g:snap(),botLevel:lvl});
}
document.querySelector('.modes').addEventListener('click',e=>{
  const b=e.target.closest('button[data-mode]');if(!b)return;
  const mode=b.dataset.mode;
  if(mode==='bot')startLocal({mode:'bot',n:+segVal('botN'),level:'medium'});
  else if(mode==='host')hostRoom(segVal('roomMode'),$('#roomPwIn').value);
  else if(mode==='enterhost')enterHostLobby(); /* room udah jadi — tinggal masuk lobby */
  else if(mode==='join')joinRoom($('#codeIn').value,$('#pwIn').value);
});
$('#codeIn').addEventListener('keydown',e=>{if(e.key==='Enter')$('#pwIn').focus()});
$('#pwIn').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom($('#codeIn').value,$('#pwIn').value)});
function renderLobby(){
  const list=$('#seatList');list.innerHTML='';
  const seats=NET.seats||[];
  $('#codeTxt').textContent=NET.code||'·····';
  const isHost=NET.host;
  $('#startBtn').style.display=isHost?'':'none';
  $('#startBtn').disabled=false;$('#startBtn').textContent='MULAI MAIN 🎲';
  $('#leaveBtn').style.display='';
  seats.forEach((s,i)=>{
  const row=document.createElement('div');row.className='srow';
    let inner='<span class="sdot" style="background:'+COLS[i].cv+'"></span>';
    if(s.kind==='off')inner+='<span class="sname"><span class="mut">'+COLS[i].nm+' — nggak ikut</span></span>';
    else if(s.kind==='open')inner+='<span class="sname"><span class="mut">'+COLS[i].nm+' — kosong, nunggu join</span></span>';
    else inner+='<span class="sname">'+s.name+' <span class="mut">• '+COLS[i].nm+'</span></span>';
    if(s.kind==='bot')inner+='<span class="sTag">🤖 BOT</span>';
    if(s.kind==='human'&&NET.on&&isHost&&i===0)inner+='<span class="sTag">👑 HOST</span>';
    if(NET.on&&i===NET.mySeat)inner+='<span class="sTag" style="color:var(--gold);border-color:#F5C04466">LO</span>';
    if(isHost&&i>0){
      inner+='<div class="sBtns">'
        +'<button data-i="'+i+'" data-k="bot" class="'+(s.kind==='bot'?'on':'')+'">🤖 BOT</button>'
        +'<button data-i="'+i+'" data-k="open" class="'+(s.kind==='open'?'on':'')+'">🔓 OPEN</button>'
        +'</div>';
    } else if(isHost&&i===0){
      inner+='<div class="sBtns"><button class="on" disabled>👤 LO</button></div>';
    }
    row.innerHTML=inner;list.appendChild(row);
  });
  list.querySelectorAll('.sBtns button[data-i]').forEach(b=>{
    b.addEventListener('click',()=>{
      const i=+b.dataset.i,k=b.dataset.k;
      if(NET.seats[i].kind==='human')return;
      NET.seats[i]=k==='bot'?{name:rndOf(BOTNAMES),kind:'bot'}:{name:'',kind:'open'};
      broadcastLobby();
    });
  });
}
/* level bot di lobby dihapus — bot default medium */
$('#startBtn').addEventListener('click',()=>{
  if(!NET.host)return;
  startNetGame();
});
$('#copyBtn').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(NET.code);toast('kode kecopy! share ke squad 🔥')}
  catch(e){toast('kode room: '+NET.code,3000)}
});
$('#leaveBtn').addEventListener('click',leaveAll);
$('#quitBtn').addEventListener('click',()=>{
  if(G&&!G.over){
    showModal('<h2>Keluar game?</h2><div class="msub">progress game bakal ilang, yakin?</div>'+
      '<div class="mbtns"><button class="go" id="mYes">YAKIN, KELUAR</button><button class="ghost" id="mNo">BATAL</button></div>');
    $('#mYes').onclick=()=>{hideModal();leaveAll()};
    $('#mNo').onclick=hideModal;
  }else leaveAll();
});

/* ================= riwayat / stats di menu ================= */
function renderHist(){
  const box=$('#histBox');if(!box)return;
  const me=ME?DB.user(ME.name):null;
  const games=DB.getGames().slice(0,5);
  let h='';
  if(me&&!ME.guest){
    h+='<div class="hStats"><span>⚔️ '+me.games+' main</span><span>🏆 '+me.wins+' menang</span><span>💀 '+me.losses+' kalah</span></div>';
  }else{
    h+='<div class="hStats mut">main sebagai tamu — stat nggak kesimpen, daftar biar kecatet 📈</div>';
  }
  if(games.length){
    h+=games.map(g=>'<div class="hGame"><span class="w">🏆 '+esc2(g.winner)+'</span><span class="mut">'+esc2(g.players.join(' vs '))+'</span></div>').join('');
  }else{
    h+='<div class="hGame mut">belum ada game — gas main dulu!</div>';
  }
  box.innerHTML=h;
}
function esc2(s){return String(s||'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}

/* ================= chat (multi-room: global + match) — render incremental, gak berkedip ================= */
const CHAT=(function(){
  let matchRoom=''; // room match aktif
  const seenCount={}; // jumlah pesan yang udah ke-render per box — cuma append yang baru
  function lineHTML(m){
    return '<div class="cLine'+(ME&&m.name===ME.name?' me':'')+'"><span class="who" style="color:'+seatCol(m.seat)+'">'+esc2(m.name)+'</span><span class="tx">'+esc2(m.text)+'</span></div>';
  }
  function renderIn(box,room,scroll){
    if(!box)return;
    const msgs=DB.getChat().filter(m=>m.room===room);
    const key=room;
    if(seenCount[key]==null)seenCount[key]=0;
    if(msgs.length<seenCount[key]){ // chat dihapus (clear) -> rebuild penuh
      box.innerHTML='';seenCount[key]=0;
    }
    const fresh=msgs.slice(seenCount[key]);
    if(fresh.length){ // cuma append pesan baru — pesan lama gak disentuh, gak ada kedip
      const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<40;
      box.insertAdjacentHTML('beforeend',fresh.map(lineHTML).join(''));
      while(box.children.length>50)box.removeChild(box.firstChild); // max 50 baris
      seenCount[key]=msgs.length;
      if(scroll||atBottom)box.scrollTop=box.scrollHeight;
    }
  }
  function renderAll(scroll){
    document.querySelectorAll('.chatList').forEach(box=>{
      renderIn(box,box.dataset.room||'global',scroll&&box.closest('#side'));
    });
  }
  function seatCol(s){return s>=0&&COLS[s]?COLS[s].cv:'#8B97AD'}
  function push(name,seat,text,room){
    if(!text)return;
    DB.addChat(room,seat,name,text);
    renderAll(true);
    if(NET.on&&NET.host){
      for(const c of NET.conns)if(c.open)c.send({t:'chat',name,seat,text});
    }
  }
  /* wiring semua form.chatForm (menu-global + match + lobby room) */
  document.querySelectorAll('form.chatForm').forEach(form=>{
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const inp=form.querySelector('input');
      const t=inp.value.trim();if(!t)return;
      inp.value='';
      const cbox=form.closest('.chatBox');
      const isLobby=!!cbox.querySelector('.chatList[data-room="lobby"]');
      if(isLobby){ // chat lobby: in-memory, relay ke semua di room
        pushLobby({name:ME?ME.name:'Teman',seat:NET.on?NET.mySeat:-1,text:t});
        if(NET.on&&NET.host)for(const c of NET.conns)if(c.open)c.send({t:'chat',name:ME?ME.name:'Teman',seat:NET.mySeat,text:t});
        else if(NET.on&&NET.conn&&NET.conn.open)NET.conn.send({t:'chat',name:ME?ME.name:'Teman',seat:NET.mySeat,text:t});
        return;
      }
      const room=cbox.querySelector('.chatList').dataset.room||'global';
      push(ME?ME.name:'Teman',NET.on?NET.mySeat:-1,t,room==='global'?'global':(NET.code||matchRoom||'local'));
      if(NET.on&&!NET.host&&NET.conn&&NET.conn.open)NET.conn.send({t:'chat',name:ME?ME.name:'Teman',seat:NET.mySeat,text:t});
    });
  });
  /* match baru = chat match bersih (room kode unik per match) */
  function newMatch(code){
    matchRoom=code||('m'+Date.now().toString(36));
    const sideList=document.querySelector('#side .chatList');
    if(sideList){sideList.dataset.room=matchRoom;sideList.innerHTML='';seenCount[matchRoom]=0;}
    renderAll(false);
  }
  /* ==== CHAT LOBBY: in-memory per klien (gak nyimpen di DB) ====
     Orang yang join duluan: chatnya tetep ada di layar dia.
     Orang yang baru join: mulai kosong — cuma liat pesan SETELAH dia masuk. */
  let lobMsgs=[]; // pesan lobby sejak dia masuk
  function lobHTML(box){
    box.innerHTML=lobMsgs.map(lineHTML).join('');
    box.scrollTop=box.scrollHeight;
  }
  function resetLobby(){
    lobMsgs=[];
    const box=document.querySelector('.lobChat .chatList');
    if(box)lobHTML(box);
  }
  function pushLobby(m){ // m={name,seat,text} — dateng dari: submit sendiri / relay host
    lobMsgs.push({name:String(m.name||'').slice(0,12),seat:m.seat==null?-1:m.seat,text:String(m.text||'').slice(0,120)});
    if(lobMsgs.length>50)lobMsgs=lobMsgs.slice(-50);
    const box=document.querySelector('.lobChat .chatList');
    if(box)lobHTML(box);
  }
  setInterval(()=>renderAll(false),2000); // polling halus — append-only, gak bikin kedip
  return{room:'global',push,renderChat:renderAll,newMatch,resetLobby,pushLobby,get matchRoom(){return matchRoom}};
})();

/* presence heartbeat */
setInterval(()=>{if(ME)DB.beat(ME.name,NET.on?NET.code:'menu')},15000);
addEventListener('beforeunload',()=>{if(ME)DB.unbeat(ME.name)});

/* hash routing: #admin -> buka dashboard admin (cek role dulu) */
function checkHash(){
  if(location.hash==='#admin'){
    if(ME&&!ME.guest&&DB.isAdmin(ME.name))show('admin');
    else{show('menu');toast('khusus akun admin 👑');if(location.hash)location.hash=''}
  }
}
addEventListener('hashchange',checkHash);

/* ================= boot ================= */
buildBoard();setArrows();metrics();
const autoOK=AUTH.tryAutoLogin(); // auto-login kalau remember me tersimpan
loadMe();
if(autoOK||ME){show('menu');DB.beat(ME.name,'menu');renderHist();scanPubRooms()}
else show('auth');
checkHash(); // support link langsung #admin

/* ================= test hooks ================= */
window.__LUDO={
  g:()=>G,
  errors:ERRS,
  me:()=>ME,
  db:()=>DB,
  spd:v=>{SPD=v||1},
  rig:arr=>{rigQ=(arr||[]).slice()},
  set:tok=>{G.tok=JSON.parse(JSON.stringify(tok));render()},
  legal:(s,d)=>legal(s,d),
  roll:()=>{if(G&&G.phase==='roll'&&G.seats[G.turn].kind==='human'&&!NET.on)doRoll()},
  moveTok:k=>{if(G&&G.phase==='move'&&G.seats[G.turn].kind==='human'&&!NET.on){const m=legal(G.turn,G.dice).find(x=>x.k===k);if(m)doMove(m)}},
  newBot:(n,seed,level)=>{SPD=1;rigQ=[];startLocal({mode:'bot',n:n||1,seed,level:level||'medium'})},
  allBots:(seed,spd,level)=>{SPD=spd||30;rigQ=[];lastCfg={mode:'bot',n:3,seed,level:level||'medium'};
    const seats=mkSeats([[0,'bot',rndOf(BOTNAMES),level||'medium'],[1,'bot',rndOf(BOTNAMES),level||'medium'],[2,'bot',rndOf(BOTNAMES),level||'medium'],[3,'bot',rndOf(BOTNAMES),level||'medium']]);
    newGame(seats,seed)},
  net:()=>({on:NET.on,host:NET.host,mySeat:NET.mySeat,code:NET.code}),
  host:()=>hostRoom(),
  join:c=>joinRoom(c),
  over:()=>!!(G&&G.over),
  modalOpen:()=>!$('#modal').hidden,
  login:(u,p)=>{const r=DB.login(u,p);if(r.ok){ME={name:r.user.name,guest:false};saveMe();loadMe()}return r},
  register:(u,p)=>DB.register(u,p),
  chat:()=>CHAT,
};
