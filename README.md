# 🚗 RC Car Controller — Web Dashboard

Dashboard web untuk mengontrol RC Car via MQTT menggunakan 6 metode kontrol berbeda.

---

## Struktur Proyek

```
rc-car-controller/
├── app.py                          ← Flask backend + proxy Gemini API
├── requirements.txt
├── .env.example                    ← Salin ke .env dan isi API key
├── README.md
│
├── templates/
│   ├── base.html                   ← Template dasar (font, CSS)
│   ├── index.html                  ← Halaman pilihan kontroler
│   └── controllers/
│       ├── button.html             ← web_kontrolv2.html  → Kontrol tombol
│       ├── voice.html              ← kontrol.py          → Kontrol suara
│       ├── voice_copy.html         ← kontrol-copy.py     → Suara Plus (durasi otomatis)
│       ├── voice_ai.html           ← kontrol-ai.py       → Suara + Gemini AI
│       ├── voice_ai_copy.html      ← kontrol-ai-copy.py  → Suara AI Plus (belok dibatasi)
│       └── finger.html             ← kontrol-jari.py     → Kontrol jari (MediaPipe)
│
└── static/
    └── css/
        └── style.css               ← Tema dark racing
```

---

## Cara Menjalankan

### 1. Install dependensi

```bash
pip install -r requirements.txt
```

### 2. Buat file konfigurasi

```bash
cp .env.example .env
```

Edit `.env`:
```
GEMINI_API_KEY=your_api_key_here   # Diperlukan untuk kontroler Suara AI
MQTT_TOPIC=
MQTT_BROKER_WSS=
PORT=5000
DEBUG=false
```

### 3. Jalankan server

```bash
python app.py
```

Buka di browser: `http://localhost:5000`

---

## Ringkasan 6 Kontroler

| File Asli | Route | Metode | Kebutuhan |
|---|---|---|---|
| `web_kontrolv2.html` | `/controller/button` | Tombol tekan-tahan | MQTT |
| `kontrol.py` | `/controller/voice` | Suara + regex | Mikrofon, Chrome |
| `kontrol-copy.py` | `/controller/voice_copy` | Suara + durasi otomatis belok | Mikrofon, Chrome |
| `kontrol-ai.py` | `/controller/voice_ai` | Suara + Gemini AI | Mikrofon, Gemini API |
| `kontrol-ai-copy.py` | `/controller/voice_ai_copy` | Suara AI + belok dibatasi 0.6s | Mikrofon, Gemini API |
| `kontrol-jari.py` | `/controller/finger` | Tracking jari MediaPipe | Kamera, Chrome |

---

## Catatan

- **Web Speech API** hanya berfungsi di **Google Chrome** atau **Microsoft Edge** (tidak di Firefox/Safari).
- **Kamera** memerlukan izin browser. HTTPS diperlukan jika deploy ke server publik.
- **Gemini API key** disimpan di `.env` server — tidak pernah dikirim ke browser.
- Semua kontroler mengirim perintah `S` (Stop) otomatis saat tab/window tidak aktif untuk keamanan.

---



> **Penting:** Kamera dan mikrofon browser hanya berfungsi di HTTPS.
> Gunakan nginx + certbot, atau layanan seperti Railway / Render yang menyediakan HTTPS otomatis.
