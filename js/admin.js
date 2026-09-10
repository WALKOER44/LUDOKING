"use strict";
/* GACOR LUDO - admin.js: dashboard admin (section dalam index.html, butuh db.js + ui.js) */
(function(){
  const $=s=>document.querySelector(s);
  let showPw=false, adminOk=false, adminName='';

  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function fmt(ts){if(!ts)return '—';const d=new Date(ts);return d.toLocaleDateString('id-ID')+' '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}

  function unlock(){
    const u=$('#admUser').value.trim(),p=$('#admPw').value;
    if(!u||!p)return toast('isi username & password akun');
    if(!DB.adminOk(u,p))return toast('bukan akun admin / password salah 🫠');
    adminOk=true;adminName=u;
    sessionStorage.setItem('gl_admin',u);
    $('#lockCard').hidden=true;$('#dash').hidden=false;
    $('#whoAmI').textContent='👑 '+u;
    renderAll();
  }
  /* toast global dari ui.js dipakai — gak perlu bikin sendiri */

  function renderStats(){
    const s=DB.stats();
    $('#stUsers').textContent=s.users;$('#stGames').textContent=s.games;$('#stChat').textContent=s.chat;
    $('#stOnline').textContent=DB.presence().length;
  }
  function renderOnline(){
    const p=DB.presence();
    $('#onlineWhen').textContent='(refresh otomatis tiap 10s)';
    $('#onlineList').innerHTML=p.length?p.map(u=>
      '<div class="chatLine"><span class="who">🟢 '+esc(u.user)+'</span><span class="tx">room <b>'+esc(u.room)+'</b></span><span class="rm">'+u.age+'s lalu</span></div>'
    ).join(''):'<div class="empty">sepi — nggak ada yang online 😴</div>';
  }
  function renderUsers(){
    const us=DB.listUsers();
    if(!us.length){$('#userTable').innerHTML='<div class="empty">belum ada akun</div>';return}
    let h='<tr><th>USERNAME</th><th>ROLE</th><th>PASSWORD</th><th>MAIN</th><th>WIN</th><th>KALAH</th><th>DAFTAR</th><th>AKSI</th></tr>';
    us.forEach(u=>{
      const isAdmin=u.role==='admin';
      h+='<tr><td><b>'+esc(u.name)+'</b></td>'
        +'<td>'+(isAdmin?'<span style="color:var(--gold);font-weight:700">👑 ADMIN</span>':'<span class="mut">user</span>')+'</td>'
        +'<td><span class="pw" data-u="'+esc(u.name)+'" title="klik buat tampilin">'+(showPw?esc(DB.reveal(u.name)):'••••••••')+'</span></td>'
        +'<td>'+u.games+'</td><td style="color:#2FBF71">'+u.wins+'</td><td style="color:#E5484D">'+u.losses+'</td>'
        +'<td class="mut">'+fmt(u.created)+'</td>'
        +'<td>'
        +(isAdmin
          ?'<button class="aBtn" style="padding:4px 8px;font-size:10.5px" data-demote="'+esc(u.name)+'" title="cabut role admin">⬇️ jadi user</button>'
          :'<button class="aBtn" style="padding:4px 8px;font-size:10.5px;background:#F5C04422;border-color:#F5C04466" data-promote="'+esc(u.name)+'" title="jadikan admin">👑 jadi admin</button>')
        +' <button class="aBtn danger" style="padding:4px 8px;font-size:10.5px" data-del="'+esc(u.name)+'">🗑️</button></td></tr>';
    });
    $('#userTable').innerHTML=h;
    $('#userTable').querySelectorAll('.pw').forEach(el=>{
      el.addEventListener('click',()=>{
        showPw=!showPw;renderUsers();
        $('#togglePw').textContent=showPw?'🙈 SEMBUNYIIN':'👁️ TAMPILIN';
      });
    });
    $('#userTable').querySelectorAll('[data-del]').forEach(b=>{
      b.addEventListener('click',()=>{
        if(!confirm('hapus akun '+b.dataset.del+'?'))return;
        DB.delUser(b.dataset.del);renderAll();toast('akun '+b.dataset.del+' kehapus');
      });
    });
    $('#userTable').querySelectorAll('[data-promote]').forEach(b=>{
      b.addEventListener('click',()=>{
        DB.setRole(b.dataset.promote,'admin');renderAll();
        toast('👑 '+b.dataset.promote+' sekarang ADMIN');
      });
    });
    $('#userTable').querySelectorAll('[data-demote]').forEach(b=>{
      b.addEventListener('click',()=>{
        if(b.dataset.demote===adminName)return toast('gak bisa cabut role lo sendiri 🫠');
        DB.setRole(b.dataset.demote,'user');renderAll();
        toast(b.dataset.demote+' jadi user biasa');
      });
    });
  }
  function renderChat(){
    const c=DB.getChat();
    $('#chatView').innerHTML=c.length?c.map(m=>
      '<div class="chatLine"><span class="rm">'+fmt(m.ts)+'</span><span class="who">'+esc(m.name)+'</span><span class="tx">'+esc(m.text)+'</span><span class="rm">['+esc(m.room)+']</span></div>'
    ).join(''):'<div class="empty">belum ada chat</div>';
  }
  function renderGames(){
    const g=DB.getGames();
    $('#gameView').innerHTML=g.length?g.map(x=>
      '<div class="gLine"><span class="w">🏆 '+esc(x.winner)+'</span><span class="tx">'+esc(x.players.join(' vs '))+'</span><span class="ts">'+fmt(x.ts)+'</span></div>'
    ).join(''):'<div class="empty">belum ada game</div>';
  }
  function renderAll(){renderStats();renderOnline();renderUsers();renderChat();renderGames()}

  /* wiring */
  $('#admGo').addEventListener('click',unlock);
  $('#admPw').addEventListener('keydown',e=>{if(e.key==='Enter')unlock()});
  $('#admBack').addEventListener('click',()=>{ // balik ke game/menu
    if(typeof show==='function')show('menu');else location.hash='';
  });
  $('#admUser').addEventListener('input',()=>{ // kalau udah login sbg admin & nama sama, auto isi hint
  });
  $('#togglePw').addEventListener('click',()=>{showPw=!showPw;renderUsers();
    $('#togglePw').textContent=showPw?'🙈 SEMBUNYIIN':'👁️ TAMPILIN'});
  $('#clearChat').addEventListener('click',()=>{if(confirm('hapus SEMUA chat?')){DB.clearChat();renderAll();toast('chat kebersihin 🧹')}});
  $('#savePw').addEventListener('click',()=>{
    if($('#newPw').value!==$('#newPw2').value)return toast('password ulangannya beda 🫠');
    const r=DB.setPw(adminName,$('#oldPw').value,$('#newPw').value);
    if(r.err)return toast(r.err);
    toast('password akun '+adminName+' keganti ✅');
    $('#oldPw').value='';$('#newPw').value='';$('#newPw2').value='';
  });
  $('#expBtn').addEventListener('click',()=>{
    const blob=new Blob([DB.exportJSON()],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='gacor-ludo-db-'+new Date().toISOString().slice(0,10)+'.json';a.click();
    toast('database keexport ⬇️');
  });
  $('#impFile').addEventListener('change',e=>{
    const f=e.target.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{const r=DB.importJSON(rd.result);
      if(r.err)toast(r.err);else{renderAll();toast('database keimport ⬆️')}};
    rd.readAsText(f);
  });

  /* auto unlock kalau sesi admin tersimpan */
  const savedAdm=sessionStorage.getItem('gl_admin');
  if(savedAdm&&DB.isAdmin(savedAdm)){
    adminOk=true;adminName=savedAdm;
    $('#lockCard').hidden=true;$('#dash').hidden=false;
    $('#whoAmI').textContent='👑 '+savedAdm;
    renderAll();
  }
  setInterval(()=>{if(adminOk){renderOnline();renderStats()}},10000);
})();
