"""
RC Car Controller - Flask Backend
==================================
Menyajikan 6 jenis kontroler RC Car via web browser.
Bertindak sebagai proxy aman untuk Gemini API agar API key tidak terekspos ke frontend.
"""

import os
import httpx
from flask import Flask, render_template, request, jsonify, redirect, url_for
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# ── Konfigurasi (dari .env) ──────────────────────────────────────────────
MQTT_TOPIC = os.getenv("MQTT_TOPIC")
MQTT_BROKER_WSS = os.getenv("MQTT_BROKER_WSS")

if not MQTT_TOPIC or not MQTT_BROKER_WSS:
    raise ValueError("Konfigurasi MQTT di file .env belum lengkap")



"""
MQTT_TOPIC       = os.getenv("MQTT_TOPIC",      "")
MQTT_BROKER_WSS  = os.getenv("MQTT_BROKER_WSS", "")
"""


# ── Data Kontroler ─────────────────────────────────────────────────────────
CONTROLLERS = [
    {
        "id":     "button",
        "name":   "Tombol",
        "icon":   "🕹️",
        "desc":   "Tekan dan tahan tombol arah untuk menggerakkan RC Car.",
        "source": "web_kontrolv2.html",
        "tech":   ["MQTT", "Touch & Mouse"],
        "color":  "#00d4ff",
    },
    {
        "id":     "finger",
        "name":   "Kontrol Jari",
        "icon":   "✋",
        "desc":   "Arahkan jari telunjuk ke zona layar. Kamera mendeteksi gerakan secara real-time.",
        "source": "kontrol-jari.py",
        "tech":   ["MediaPipe", "Kamera", "MQTT"],
        "color":  "#ff6b35",
    },
    {
        "id":     "voice",
        "name":   "Kontrol Suara",
        "icon":   "🎤",
        "desc":   "Ucapkan perintah seperti \"maju 2\" atau \"kiri\" untuk menggerakkan mobil selama N detik.",
        "source": "kontrol.py",
        "tech":   ["Web Speech API", "MQTT"],
        "color":  "#1ff070",
    },
    {
        "id":     "voice_copy",
        "name":   "Kontrol Suara Plus",
        "icon":   "🎙️",
        "desc":   "Versi suara yang ditingkatkan. belok otomatis 0.6 detik jika tidak ada angka.",
        "source": "kontrol-copy.py",
        "tech":   ["Web Speech API", "MQTT"],
        "color":  "#00c45a",
    },
]


# ── Routes ─────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Halaman utama — pilihan kontroler."""
    return render_template("index.html", controllers=CONTROLLERS)


@app.route("/controller/<controller_id>")
def controller(controller_id):
    """Halaman kontroler yang dipilih."""
    ctrl = next((c for c in CONTROLLERS if c["id"] == controller_id), None)
    if not ctrl:
        return redirect(url_for("index"))

    template = f"controllers/{controller_id}.html"
    return render_template(
        template,
        ctrl=ctrl,
        mqtt_topic=MQTT_TOPIC,
        mqtt_broker=MQTT_BROKER_WSS,
    )


# ── Entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "true").lower() == "true"
    print(f"\n🚗  RC Car Controller berjalan di http://localhost:{port}\n")
    app.run(debug=debug, host="0.0.0.0", port=port)
