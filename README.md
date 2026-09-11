# 🎲 GACOR LUDO

Game **Ludo online 4 pemain** rasa gacor — vanilla HTML/CSS/JS, tanpa framework, tanpa build.

![GACOR LUDO](assets/img/preview-final.png)

## 🎮 Fitur

- **4 mode main**: lawan bot (atur 1-3 bot), buat room online, join via kode
- **Room PUBLIK 🌍 / PRIVAT 🔒** — room publik otomatis muncul di daftar menu, siapa aja bisa join tanpa kode; room privat butuh kode + password
- **Online P2P** — PeerJS, host authoritatif, AFK/disconnect auto bot gantian
- **Chat 3 tempat** — global di menu, chat room (lobby, per-joiner: yang baru join mulai bersih), chat match
- **Dadu 3D** nempel di slot pemain yang giliran — pindah otomatis tiap giliran, **pencet dadu buat lempar**
- **Aturan lengkap**: keluar base butuh 6, makan token balik markas, petak aman ★ (2 bidak beda warna di petak bintang gak saling makan), block 2 token, 3x enam hangus
- **Auth + Remember Me** — login/daftar/tamu, auto-login pas balik buka
- **Role admin** — dashboard user (akun+pw), chat, riwayat, presence online
- **Playlist BGM 15 lagu** — ganti lagu otomatis, jalan setelah tap pertama (aturan autoplay browser)
- **Responsive HP** — slot dadu baris atas, papan pas layar, chat compact

## 🚀 Cara main

Buka https://walkoer44.github.io/LUDOKING/ — selesai.

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
│   └── admin.js     dashboard admin
└── assets/
    ├── audio/       15 track BGM
    └── img/         bg-lobby.jpg, bg-match.jpg, preview-final.png
```

## 🔧 Teknologi

Vanilla JS, localStorage database, PeerJS untuk online, WebAudio + `<audio>` BGM, CSS grid/flex — responsive mobile ready.

---

© 2026 WALKOER • KUDUS 🔥
