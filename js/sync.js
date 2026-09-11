"use strict";
/* GACOR LUDO - sync.js: akun lintas device.
   Masalah: DB akun disimpen di localStorage — akun yang dibikin di laptop gak ada di HP.
   Solusi 2 jalur (tanpa server/backend, site statis):
   1. KODE AKUN (utama, instan): di menu LOGIN ada tombol "PAKE KODE AKUN".
      Lo dapet kode dari device lama (menu > PAKE KODE AKUN > tulis kode itu di device baru),
      enter di device baru -> akun (username+pw+stat) kepindah. Bisa juga tulis manual.
   2. SYNC CLOUD (bonus): tiap login sukses, akun lo di-push ke cloud slot peer
      (PeerJS id 'gacor-ludo-v1-ACC-<username>'). Device lain yang login username sama
      bakal narik akun itu otomatis kalau device ini lagi online.
   Gak ada data pribadi lain yang keluar — cuma {name,pw(base64),stat,role}. */

const SYNC=(function(){
  const ACC_PFX='gacor-ludo-v1-ACC-'; // slot cloud per-username
  let peer=null;

  /* ---------- kode akun (offline, gak butuh internet) ---------- */
  function encodeAccount(u,p){
    const payload={u:String(u||'').trim(),p:String(p||'')};
    const json=JSON.stringify(payload);
    // bytes -> base64 url-safe (tanpa padding biar pendek)
    const b64=btoa(unescape(encodeURIComponent(json))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    // checksum kecil biar typo ketahuan: jumlah byte mod 97
    let sum=0;for(let i=0;i<b64.length;i++)sum=(sum+b64.charCodeAt(i))%97;
    const cs=String(sum).padStart(2,'0');
    return 'GLK-'+b64+'-'+cs;
  }
  function decodeAccount(code){
    code=String(code||'').trim().toUpperCase();
    if(code.indexOf('GLK-')!==0)return{err:'kodenya harus mulai GLK-'};
    const parts=code.split('-'); // ['GLK','<b64>','<cs>']
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
  function importCode(code){ // masukin kode di device baru -> akun kesimpen + langsung login
    const d=decodeAccount(code);
    if(d.err)return d;
    const r=DB.upsertUser(d.u,d.p);
    if(r.err)return r;
    return{ok:1,name:d.u};
  }

  /* ---------- sync cloud via PeerJS (bonus, keduanya online) ---------- */
  function goOnline(){ // host slot ACC-<username>: device lain bisa narik akun ini
    try{
      if(peer||!window.Peer||!ME||ME.guest)return;
      const id=ACC_PFX+ME.name.toLowerCase();
      peer=new Peer(id,{debug:0});
      peer.on('error',()=>{}); // id taken (device sama dua tab) — gak fatal, slot udah ada
      peer.on('connection',c=>{
        c.on('data',m=>{
          if(m&&m.t==='pull'){ // device lain minta akun username ini
            const u=DB.user(ME.name);
            if(u)c.send({t:'acc',name:u.name,pw:u.pw,stat:{wins:u.wins||0,losses:u.losses||0,games:u.games||0},role:u.role,ts:Date.now()});
            setTimeout(()=>{try{c.close()}catch(e){}},300);
          }
        });
      });
    }catch(e){}
  }
  function goOffline(){try{if(peer){peer.destroy();peer=null}}catch(e){}}
  function pullAccount(name,cb){ // dari device baru: tarik akun dari slot cloud pemiliknya
    cb=cb||function(){};
    if(!window.Peer)return cb({err:'PeerJS belum ke-load'});
    try{
      const p=new Peer({debug:0});
      let done=false;
      const fin=r=>{if(done)return;done=true;try{p.destroy()}catch(e){}cb(r)};
      p.on('error',()=>fin({err:'offline'}));
      p.on('open',()=>{
        const c=p.connect(ACC_PFX+String(name||'').toLowerCase(),{reliable:true});
        const to=setTimeout(()=>fin({err:'device pemilik akun lagi offline / gak ketemu'}),6000);
        c.on('open',()=>c.send({t:'pull'}));
        c.on('data',m=>{
          clearTimeout(to);
          if(m&&m.t==='acc'&&m.pw){
            const k=String(name).toLowerCase();
            DB.mergeUsers({[k]:{name:m.name,pw:m.pw,created:Date.now(),last:m.ts||Date.now(),
              wins:m.stat&&m.stat.wins||0,losses:m.stat&&m.stat.losses||0,games:m.stat&&m.stat.games||0,role:m.role||'user'}},{});
            fin({ok:1});
          }else fin({err:'akun gak ketemu di cloud'});
        });
        c.on('error',()=>{clearTimeout(to);fin({err:'gak konek ke slot akun'})});
      });
    }catch(e){cb({err:e.message})}
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

  return{encodeAccount,decodeAccount,importCode,pullAccount,goOnline,goOffline,wire};
})();
