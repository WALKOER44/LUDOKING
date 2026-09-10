"use strict";
/* GACOR LUDO - admin.js: dashboard admin (butuh db.js) */
(function(){
  const $=s=>document.querySelector(s);
  let showPw=false, adminOk=false;

  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function fmt(ts){if(!ts)return '—';const d=new Date(ts);return d.toLocaleDateString('id-ID')+' '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}

  function unlock(){
    const code=$('#admCode').value;
    if(!DB.adminOk(code)){toast('kode admin salah 🫠');return}
    adminOk=true;
    sessionStorage.setItem('gl_admin','1');
    $('#lockCard').hidden=true;$('#dash').hidden=false;
    renderAll();
  }
  function toast(m,ms){
    const t=document.createElement('div');t.className='toast';t.textContent=m;
    t.style.cssText='position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99;background:#0E1219F2;border:1px solid #ffffff22;border-radius:999px;padding:9px 20px;font-size:13px;font-weight:600';
    document.body.appendChild(t);
    setTimeout(()=>{t.style.transition='opacity .4s';t.style.opacity='0';setTimeout(()=>t.remove(),400)},ms||2000);
  }

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
    let h='<tr><th>USERNAME</th><th>PASSWORD</th><th>MAIN</th><th>WIN</th><th>KALAH</th><th>DAFTAR</th><th></th></tr>';
    us.forEach(u=>{
      h+='<tr><td><b>'+esc(u.name)+'</b></td>'
        +'<td><span class="pw" data-u="'+esc(u.name)+'" title="klik buat tampilin">'+(showPw?esc(DB.reveal(u.name)):'••••••••')+'</span></td>'
        +'<td>'+u.games+'</td><td style="color:#2FBF71">'+u.wins+'</td><td style="color:#E5484D">'+u.losses+'</td>'
        +'<td class="mut">'+fmt(u.created)+'</td>'
        +'<td><button class="aBtn danger" style="padding:4px 10px;font-size:11px" data-del="'+esc(u.name)+'">HAPUS</button></td></tr>';
    });
    $('#userTable').innerHTML=h;
    $('#userTable').querySelectorAll('.pw').forEach(el=>{
      el.addEventListener('click',()=>{
        showPw=!showPw;renderUsers();
        if(!showPw)$('#togglePw').textContent='👁️ TAMPILIN';else $('#togglePw').textContent='🙈 SEMBUNYIIN';
      });
    });
    $('#userTable').querySelectorAll('[data-del]').forEach(b=>{
      b.addEventListener('click',()=>{
        if(!confirm('hapus akun '+b.dataset.del+'?'))return;
        DB.delUser(b.dataset.del);renderAll();toast('akun '+b.dataset.del+' kehapus');
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
  $('#admCode').addEventListener('keydown',e=>{if(e.key==='Enter')unlock()});
  $('#lockBtn').addEventListener('click',()=>{adminOk=false;sessionStorage.removeItem('gl_admin');$('#lockCard').hidden=false;$('#dash').hidden=true;$('#admCode').value=''});
  $('#togglePw').addEventListener('click',()=>{showPw=!showPw;renderUsers();
    $('#togglePw').textContent=showPw?'🙈 SEMBUNYIIN':'👁️ TAMPILIN'});
  $('#clearChat').addEventListener('click',()=>{if(confirm('hapus SEMUA chat?')){DB.clearChat();renderAll();toast('chat kebersihin 🧹')}});
  $('#saveCode').addEventListener('click',()=>{
    const r=DB.setAdminCode($('#oldCode').value,$('#newCode').value);
    if(r.err)return toast(r.err);
    toast('kode admin keganti ✅');$('#oldCode').value='';$('#newCode').value='';
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
  $('#admSnd').addEventListener('click',()=>toast('admin toast sound ciamik 🔊'));

  /* auto refresh presence */
  if(sessionStorage.getItem('gl_admin')==='1'){
    $('#lockCard').hidden=true;$('#dash').hidden=false;adminOk=true;renderAll();
  }
  setInterval(()=>{if(adminOk){renderOnline();renderStats()}},10000);
})();
