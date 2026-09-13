"use strict";
/* GACOR LUDO - sync.js: akun lintas device + presence online antar device.
   Masalah: localStorage = per-device. Akun & status online yang dibikin di laptop gak
   keliatan di HP (dan sebaliknya). Solusi 2 jalur (tanpa server, site statis):
   1. KODE AKUN (offline): device lama kasih kode GLK-xxx, device baru tempel → akun pindah.
   2. SYNC CLOUD (bonus): tiap login sukses, akun lo di-push ke slot peer PeerJS
      ('gacor-ludo-v1-ACC-<username>') + presence slot ('gacor-ludo-v1-PRES-<username>').
      Device lain bisa narik akun / liat status online lo. */

const SYNC=(function(){
  const ACC_PFX='gacor-ludo-v1-ACC-';
  const PRES_PFX='gacor-ludo-v1-PRES-'; // slot presence: nyala pas online, mati pas tutup
  let peer=null, presPeer=null;

  /* ---------- kode akun (offline, gak butuh internet) ---------- */
  function encodeAccount(u,p){
    const payload={u:String(u||'').trim(),p:String(p||'')};
    const json=JSON.stringify(payload);
    const b64=btoa(unescape(encodeURIComponent(json))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    let sum=0;for(let i=0;i<b64.length;i++)sum=(sum+b64.charCodeAt(i))%97;
    const cs=String(sum).padStart(2,'0');
    return 'GLK-'+b64+'-'+cs;
  }
  function decodeAccount(code){
    code=String(code||'').trim().toUpperCase();
    if(code.indexOf('GLK-')!==0)return{err:'kodenya harus mulai GLK-'};
    const parts=code.split('-');
    if(parts.length<3)return{err:'format kode gak valid'};
    const b64=parts[1],cs=parts[2];
    let sum=0;for(let i=0;i<b64.length;i++)sum=(sum+b64.charCodeAt(i))%97;
    if(String(sum).padStart(2,'0')!==cs)return{err:'kode salah / salah ketik (checksum beda)'};
    let json;try{json=decodeURIComponent(escape(atob(b64.replace(/-/g,'+').replace(/_/g,'/'))))}
    catch(e){return{err:'kode gak kebaca 🫠'}}
    try{const d=JSON.parse(json);
      if(!d.u||!d.p)return{err:'kode gak lengkap'};
      return d;
    }catch(e){return{err:'kode rusak'}}
  }
  function importCode(code){
    const d=decodeAccount(code);
    if(d.err)return d;
    const r=DB.upsertUser(d.u,d.p);
    if(r.err)return r;
    return{ok:1,name:d.u};
  }

  /* ---------- akun: slot cloud per-username ---------- */
  function goOnline(){
    try{
      if(peer||!window.Peer||!ME||ME.guest)return;
      const id=ACC_PFX+ME.name.toLowerCase();
      peer=new Peer(id,{debug:0});
      peer.on('error',()=>{}); // id taken (device sama dua tab) — gak fatal, slot udah ada
      peer.on('connection',c=>{
        c.on('data',m=>{
          if(m&&m.t==='pull'){
            const u=DB.user(ME.name);
            if(u)c.send({t:'acc',name:u.name,pw:u.pw,stat:{wins:u.wins||0,losses:u.losses||0,games:u.games||0},role:u.role,ts:Date.now()});
            setTimeout(()=>{try{c.close()}catch(e){}},300);
          }
        });
      });
    }catch(e){}
  }
  function goOffline(){
    try{if(peer){peer.destroy();peer=null}}catch(e){}
    try{if(presPeer){presPeer.destroy();presPeer=null}}catch(e){}
  }
  /* tarik akun dari slot cloud pemiliknya (device lama lagi online) — dipakai tombol ☁️ TARIK */
  function pullAccount(name,cb){
    cb=cb||function(){};
    if(!window.Peer)return cb({err:'koneksi belum siap'});
    try{
      const p=new Peer({debug:0});
      let done=false;
      const fin=r=>{if(done)return;done=true;try{p.destroy()}catch(e){}cb(r)};
      p.on('error',()=>fin({err:'device pemilik akun lagi offline'}));
      p.on('open',()=>{
        const c=p.connect(ACC_PFX+String(name||'').toLowerCase(),{reliable:true});
        const to=setTimeout(()=>fin({err:'nggak ketemu / kehabisan waktu'}),6000);
        c.on('open',()=>c.send({t:'pull'}));
        c.on('data',m=>{
          clearTimeout(to);
          if(m&&m.t==='acc'&&m.pw){
            const k=String(name).toLowerCase();
            DB.mergeUsers({[k]:{name:m.name,pw:m.pw,created:Date.now(),last:m.ts||Date.now(),
              wins:m.stat&&m.stat.wins||0,losses:m.stat&&m.stat.losses||0,games:m.stat&&m.stat.games||0,role:m.role||'user'}},{});
            fin({ok:1});
          }else fin({err:'akun gak ketemu'});
        });
        c.on('error',()=>{clearTimeout(to);fin({err:'gak konek'})});
      });
    }catch(e){cb({err:e.message})}
  }

  /* ---------- presence online antar device ----------
     Device yang login nyala slot PRES-<username> + ngejawab probe 'ping'.
     Admin (device mana pun) nge-probe semua username di DB → dapetin siapa aja yang online
     di SEMUA device (bukan cuma localStorage device itu sendiri). */
  function presenceUp(){
    try{
      if(!window.Peer||!ME||ME.guest)return;
      const id=PRES_PFX+ME.name.toLowerCase();
      if(presPeer)return;
      presPeer=new Peer(id,{debug:0});
      presPeer.on('error',()=>{}); // slot udah ada (tab laen) — biarin
      presPeer.on('connection',c=>{
        c.on('data',m=>{
          if(m&&m.t==='ping'){
            c.send({t:'pong',room:NET&&NET.on?NET.code:'menu',ts:Date.now()});
            setTimeout(()=>{try{c.close()}catch(e){}},200);
          }
        });
      });
    }catch(e){}
  }
  /* probe satu username: online? (callback dipanggil pasti — true/false) */
  function probeUser(name,cb){
    if(!window.Peer){cb(false);return}
    try{
      const p=new Peer({debug:0});
      let done=false;
      const fin=v=>{if(done)return;done=true;try{p.destroy()}catch(e){}cb(v)};
      p.on('error',()=>fin(false));
      p.on('open',()=>{
        const c=p.connect(PRES_PFX+String(name||'').toLowerCase(),{reliable:true});
        const to=setTimeout(()=>fin(false),2500);
        c.on('open',()=>c.send({t:'ping'}));
        c.on('data',m=>{clearTimeout(to);fin(!!(m&&m.t==='pong'))});
        c.on('error',()=>{clearTimeout(to);fin(false)});
      });
    }catch(e){cb(false)}
  }
  /* probe SEMUA akun di DB (buat admin "yang online") — cb(listOnline[]) */
  function probeAll(cb){
    const users=DB.listUsers();
    if(!users.length)return cb([]);
    if(!window.Peer){cb([]);return}
    loadPeerJS().then(()=>{
      const names=users.map(u=>u.name);
      const out=[];let n=0;
      names.forEach(nm=>{
        probeUser(nm,ok=>{
          if(ok)out.push(nm);
          if(++n>=names.length)cb(out);
        });
      });
    }).catch(()=>cb([]));
  }

  /* ---------- UI: tombol di auth ---------- */
  function wire(){
    const btn=$('#accCodeBtn'),box=$('#accCodeBox');
    if(!btn)return;
    btn.addEventListener('click',()=>{
      const open=!box.hidden;box.hidden=open;
      if(open)return;
      $('#codeAccGet').textContent=ME&&!ME.guest?encodeAccount(ME.name,DB.reveal(ME.name)):'login dulu buat liat kode lo';
      const inp=$('#codeAccIn');if(inp){inp.value='';inp.placeholder='tempel kode GLK-… dari device lain'}
    });
    const use=$('#codeAccUse');
    if(use)use.addEventListener('click',()=>{
      const r=importCode($('#codeAccIn').value);
      if(r.err)return toast(r.err);
      toast('akun '+r.name+' masuk — login aja 🎉');
      $('#loginUser').value=r.name;
      $('#tabLogin').click();
      box.hidden=true;
    });
    const pullBtn=$('#codeAccPull');
    if(pullBtn)pullBtn.addEventListener('click',()=>{
      const name=($('#loginUser').value||'').trim();
      if(!name)return toast('isi username dulu, baru tarik akun');
      toast('nyari akun '+name+' di device lain…',2500);
      loadPeerJS().then(()=>pullAccount(name,r=>{
        if(r.err)return toast('gak bisa tarik: '+r.err);
        toast('akun '+name+' ketarik! tinggal isi password 🎉');
      })).catch(()=>toast('gagal load koneksi'));
    });
  }

  return{encodeAccount,decodeAccount,importCode,pullAccount,goOnline,goOffline,wire,
    presenceUp,probeUser,probeAll};
})();
