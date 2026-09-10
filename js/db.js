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

  function fresh(){return{v:2,users:{},chat:[],games:[],settings:{adminCode:'GACOR-ADMIN'},created:now()}}
  function load(){try{const d=JSON.parse(localStorage.getItem(KEY));
    if(d&&d.users){
      for(const k in d.users){if(!d.users[k].role)d.users[k].role=(k==='walkoer')?'admin':'user'} // migrasi role
      return d;
    }
    return fresh()}catch(e){return fresh()}}
  let db=load();
  function save(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}}
  const key=u=>''+(u||'').trim().toLowerCase();

  return{
    /* ---- akun ---- */
    register(u,p){
      u=(u||'').trim();
      if(!/^[a-zA-Z0-9_]{3,12}$/.test(u))return{err:'username 3-12 huruf/angka/underscore'};
      if(String(p||'').length<3)return{err:'password minimal 3 karakter'};
      if(db.users[key(u)])return{err:'username udah ada yang punya 😅'};
      db.users[key(u)]={name:u,pw:b64(p),created:now(),last:0,wins:0,losses:0,games:0,role:key(u)==='walkoer'?'admin':'user'};
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
    delUser(u){delete db.users[key(u)];save()},
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

    /* ---- admin ---- */
    adminOk(code){return String(code)===String(db.settings.adminCode)},
    setAdminCode(oldC,newC){
      if(String(oldC)!==String(db.settings.adminCode))return{err:'kode admin lama salah'};
      if(!/^[A-Za-z0-9-]{4,20}$/.test(String(newC||'')))return{err:'kode baru 4-20 huruf/angka/dash'};
      db.settings.adminCode=String(newC);save();return{ok:1};
    },
    stats(){return{users:Object.keys(db.users).length,chat:db.chat.length,games:db.games.length}},

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
