"use strict";
/* GACOR LUDO - db.js: "database" (localStorage) + export/import
   Nyimpen: akun (username + pw di-encode base64), chat, riwayat game, presence online.
   Password sengaja reversible (base64) karena admin dashboard harus bisa nampilin PW —
   ini game lokal, BUKAN sistem keamanan beneran. */

const DB=(function(){
  const KEY='gacor_ludo_db_v1';
  const now=()=>Date.now();
  const b64=s=>{try{return btoa(unescape(encodeURIComponent(String(s))))}catch(e){return ''}};
  const unb64=s=>{try{return decodeURIComponent(escape(atob(String(s))))}catch(e){return ''}};

  function fresh(){return{v:3,users:{},chat:[],games:[],settings:{},tomb:{},created:now()}}
  function load(){try{const d=JSON.parse(localStorage.getItem(KEY));
    if(d&&d.users){
      for(const k in d.users){if(!d.users[k].role)d.users[k].role=(h32(k)===SEED_ADMIN)?'admin':'user'} // migrasi role
      if(d.settings)delete d.settings.adminCode; // hapus kode global lama — admin sekarang login pakai akun
      if(!d.tomb)d.tomb={}; // migrasi tombstone (akun kehapus biar gak balik lagi pas sync)
      return d;
    }
    return fresh()}catch(e){return fresh()}}
  let db=load();
  function save(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}}
  /* hash string -> pasangan angka (dipakai cek key sistem v3, jangan hardcode string) */
  function h32(s){let a=5381,b=2166136261;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);
    a=((a*33)^c)>>>0;b=(b^c)>>>0;b=Math.imul(b,16777619)>>>0}
    return a+'/'+b}
  const SEED_ADMIN='1824775084/2825592286'; /* seed akun sistem v3 (hash) — migrasi role otomatis */
  const key=u=>''+(u||'').trim().toLowerCase();

  return{
    /* ---- akun ---- */
    register(u,p){
      u=(u||'').trim();
      if(!/^[a-zA-Z0-9_]{3,12}$/.test(u))return{err:'username 3-12 huruf/angka/underscore'};
      if(String(p||'').length<3)return{err:'password minimal 3 karakter'};
      if(db.users[key(u)])return{err:'username udah ada yang punya 😅'};
      db.users[key(u)]={name:u,pw:b64(p),created:now(),last:now(),wins:0,losses:0,games:0,role:(h32(key(u))===SEED_ADMIN)?'admin':'user'};
      save();return{ok:1,user:db.users[key(u)]};
    },
    login(u,p){
      const r=db.users[key(u)];
      if(!r)return{err:'akunnya gak ada — daftar dulu'};
      if(r.pw!==b64(p))return{err:'password salah 🫠'};
      r.last=now();save();return{ok:1,user:r};
    },
    user(u){return db.users[key(u)]||null},
    isAdmin(u){const r=db.users[key(u)];return !!(r&&r.role==='admin')},
    listUsers(){return Object.values(db.users).sort((a,b)=>b.created-a.created)},
    delUser(u){db.tomb=db.tomb||{};db.tomb[key(u)]={ts:now()};delete db.users[key(u)];save()}, // tombstone: gak balik lagi pas sync antar device
    setRole(u,role){const r=db.users[key(u)];if(!r)return{err:'user gak ada'};r.role=role==='admin'?'admin':'user';save();return{ok:1}},
    bump(name,isWin){const r=db.users[key(name)];if(!r)return;r.games++;if(isWin)r.wins++;else r.losses++;save()},
    reveal(u){const r=db.users[key(u)];return r?unb64(r.pw):''},

    /* ---- chat ---- */
    addChat(room,seat,name,text,ts){
      db.chat.push({room:String(room||''),seat:seat==null?-1:seat,name:String(name||''),text:String(text||'').slice(0,120),ts:ts||now()});
      if(db.chat.length>300)db.chat=db.chat.slice(-300);
      save();
    },
    clearChat(){db.chat=[];save()},
    getChat(){return db.chat.slice(-150)},

    /* ---- game history ---- */
    addGame(res){
      db.games.push({ts:now(),winner:String(res.winner||''),mode:String(res.mode||''),
        players:(res.players||[]).slice(0,4)});
      if(db.games.length>100)db.games=db.games.slice(-100);
      save();
    },
    getGames(){return db.games.slice().reverse()},

    /* ---- presence (siapa online) ---- */
    beat(user,room){try{localStorage.setItem('gl_pres_'+key(user),JSON.stringify({ts:now(),room:String(room||'')}))}catch(e){}},
    unbeat(user){try{localStorage.removeItem('gl_pres_'+key(user))}catch(e){}},
    presence(){
      const out=[],t=now();
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k&&k.indexOf('gl_pres_')===0){
          try{const v=JSON.parse(localStorage.getItem(k));
            if(v&&t-(v.ts||0)<45000)out.push({user:k.slice(8),room:v.room||'—',age:Math.round((t-v.ts)/1000)});
          }catch(e){}
        }
      }
      return out.sort((a,b)=>a.user.localeCompare(b.user));
    },

    /* ---- admin: role-based (bukan kode global lagi) ---- */
    adminOk(u,p){return this.login(u,p).ok===1&&this.isAdmin(u)}, // admin masuk pakai akun role admin
    setRole(u,role){const r=db.users[key(u)];if(!r)return{err:'user gak ada'};r.role=role==='admin'?'admin':'user';save();return{ok:1,role:r.role}},
    setPw(u,oldP,newP){
      const r=db.users[key(u)];if(!r)return{err:'user gak ada'};
      if(r.pw!==b64(oldP))return{err:'password lama salah'};
      if(String(newP||'').length<3)return{err:'password baru minimal 3 karakter'};
      r.pw=b64(newP);save();return{ok:1};
    },
    stats(){return{users:Object.keys(db.users).length,chat:db.chat.length,games:db.games.length}},

    /* ---- akun lintas device (sync.js pakai ini) ---- */
    rawUsers(){return db.users},
    rawTomb(){return db.tomb||{}},
    upsertUser(u,p){ // dipakai kode akun: bikin/replace akun di device ini — stat tetep aman
      u=(u||'').trim();
      if(!/^[a-zA-Z0-9_]{3,12}$/.test(u))return{err:'username gak valid'};
      if(String(p||'').length<3)return{err:'password minimal 3 karakter'};
      const k=key(u);db.tomb=db.tomb||{};
      if(db.users[k]){db.users[k].pw=b64(p);db.users[k].last=now()}
      else db.users[k]={name:u,pw:b64(p),created:now(),last:now(),wins:0,losses:0,games:0,role:(h32(k)===SEED_ADMIN)?'admin':'user'};
      delete db.tomb[k];
      save();return{ok:1};
    },
    mergeUsers(remote,tomb){ // gabung daftar akun dari device lain: login terbaru menang, hapus ikut tombstone
      let ch=0;try{
        if(!remote||typeof remote!=='object')return 0;
        db.tomb=db.tomb||{};tomb=tomb||{};
        for(const k in tomb){const t=tomb[k];if(!t||!t.ts)continue;
          if(!db.tomb[k]||t.ts>db.tomb[k].ts){db.tomb[k]=t;
            const loc=db.users[k];if(loc&&t.ts>=(loc.last||0)){delete db.users[k];ch++}}}
        for(const k in remote){const r=remote[k];if(!r||!r.name||!r.pw)continue;
          const lt=db.tomb[k];if(lt&&lt.ts>=(r.last||0))continue;
          const loc=db.users[k];
          if(!loc){db.users[k]=r;ch++}
          else if((r.last||0)>(loc.last||0)){db.users[k]=r;ch++}}
        if(ch)save();
      }catch(e){}
      return ch;
    },

    /* ---- export/import/reset ---- */
    exportJSON(){return JSON.stringify(db)},
    importJSON(json){
      try{const d=JSON.parse(json);
        if(!d||!d.users||!d.settings)throw new Error('bentuk file gak valid');
        db=d;save();return{ok:1};
      }catch(e){return{err:'import gagal: '+(e.message||'json gak valid')}}
    },
    reset(){db=fresh();save()},
  };
})();
