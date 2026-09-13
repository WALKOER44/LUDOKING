# 🎲 GACOR LUDO

Game **Ludo online 4 pemain** rasa gacor — vanilla HTML/CSS/JS, tanpa framework, tanpa build.

![GACOR LUDO](assets/img/preview-final.png)

## 🎮 Fitur

- **4 mode main**: lawan bot (atur 1-3 bot), buat room online, join via kode
- **Room PUBLIK 🌍 / PRIVAT 🔒** — room publik otomatis muncul di daftar menu, siapa aja bisa join tanpa kode; room privat butuh kode + password
- **Online P2P** — PeerJS, host authoritatif, AFK/disconnect auto bot gantian
- **Chat 3 tempat** — global di menu, chat room (lobby), chat match (bisa di-gedein buat baca riwayat)
- **Dadu 3D** nempel di slot pemain yang giliran — pindah otomatis tiap giliran, **pencet dadu buat lempar**
- **Aturan lengkap**: keluar base butuh 6, makan token balik markas, petak aman ★ (2 bidak beda warna di petak bintang gak saling makan), block 2 token, 3x enam hangus
- **Auth + Remember Me** — login/daftar/tamu, auto-login pas balik buka
- **Role admin** — dashboard user (akun+pw), chat, riwayat, presence online lintas device
- **Akun lintas device** — kode akun GLK buat pindah akun ke HP/device lain
- **Playlist BGM 10 lagu** — ganti lagu otomatis, jalan setelah tap pertama (aturan autoplay browser)
- **Responsive HP** — slot dadu baris atas, papan pas layar, chat compact

## 🚀 Cara main

Buka `index.html` langsung di browser, atau host di GitHub Pages / Netlify — statis aja, gak perlu server.

Main online: **BUAT ROOM** (pilih PUBLIK biar semua bisa join, atau PRIVAT + pw) → share kode → temen klik join / pilih dari daftar room publik.

## 🗂️ Struktur

```
├── index.html       game + dashboard admin (section, login role admin)
├── css/style.css    tema cream + biru #2B4BFF + kuning #FFD400
├── js/
│   ├── db.js        "database" localStorage (akun, chat, riwayat, presence)
│   ├── game.js      mesin aturan ludo + bot + giliran
│   ├── net.js       PeerJS online (slot room publik PUB00-15, pw room privat)
│   ├── ui.js        papan, token, dadu 3D, animasi, BGM
│   ├── main.js      auth, menu, lobby, chat wiring
│   ├── sync.js      akun lintas device (kode GLK + presence cloud)
│   └── admin.js     dashboard admin
└── assets/
    ├── audio/       10 track BGM
    └── img/         bg-lobby.jpg, bg-match.jpg, preview-final.png
```

## 🔧 Teknologi

Vanilla JS, localStorage database, PeerJS untuk online, WebAudio + `<audio>` BGM, CSS grid/flex — responsive mobile ready.
