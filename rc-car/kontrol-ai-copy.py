import speech_recognition as sr
import paho.mqtt.client as mqtt
from google import genai
import time
from gtts import gTTS
import os
import subprocess
import dotenv
dotenv.load_dotenv()

broker = "broker.hivemq.com"
topik = "muhayara/rc/whatever-you-want"

klien = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
klien.connect(broker, 1883, 60)

ai_klien = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def bicara(teks):
    print("AI: " + teks)
    try:
        tts = gTTS(text=teks, lang='id')
        tts.save("temp_audio.mp3")
        # Menjalankan mpv untuk memutar suara
        subprocess.run(["mpv", "--no-video", "--really-quiet", "temp_audio.mp3"])
        if os.path.exists("temp_audio.mp3"):
            os.remove("temp_audio.mp3")
    except Exception as e:
        print("Eror suara:", e)

def proses_ai(teks):
    # Instruksi diperketat agar memprioritaskan gerakan
    instruksi = f"Balas santai. Gunakan format BALASAN | HURUF,ANGKA. F maju, B mundur, L kiri, R kanan. JIKA ADA KATA ARAH (maju, mundur, kiri, kanan) WAJIB BERIKAN KODE GERAK. Gunakan S,0 hanya jika benar-benar tidak ada perintah arah. Belok L/R tanpa angka tulis 0.3. Maju/Mundur tanpa angka tulis 1. Abaikan pengulangan kata. Kalimat: {teks}"
    hasil = ai_klien.models.generate_content(
        model='gemini-2.5-flash',
        contents=instruksi,
    )
    return hasil.text.strip()

def rekam():
    perekam = sr.Recognizer()
    perekam.pause_threshold = 0.5
    with sr.Microphone() as sumber:
        print("\nMendengarkan suara...")
        perekam.adjust_for_ambient_noise(sumber)
        try:
            audio = perekam.listen(sumber, timeout=3, phrase_time_limit=4)
        except sr.WaitTimeoutError:
            return

    try:
        ucapan = perekam.recognize_google(audio, language="id-ID")
        print("Ucapan: " + ucapan)
        
        data_ai = proses_ai(ucapan)
        
        if "|" in data_ai:
            bagian_ai = data_ai.split("|")
            kalimat_balasan = bagian_ai[0].strip()
            kode_arah = bagian_ai[1].strip()
            
            bicara(kalimat_balasan)
            
            bagian_kode = kode_arah.split(",")
            if len(bagian_kode) == 2:
                arah = bagian_kode[0]
                durasi = float(bagian_kode[1])
                
                if arah == 'S':
                    print("Status: Hanya mengobrol")
                    return

                if arah in ['L', 'R'] and durasi > 0.5:
                    durasi = 0.6
                
                if arah in ['F', 'B', 'L', 'R']:
                    klien.publish(topik, arah)
                    print(f"Mengirim ke MQTT: {arah} ({durasi} detik)")
                    time.sleep(durasi)
                    klien.publish(topik, 'S')
                    print("Mobil Berhenti")
            else:
                print("Eror: Format kode salah")
        else:
            print("Eror: AI tidak mengikuti format pemisah |")
            
    except sr.UnknownValueError:
        print("Suara kurang jelas")
    except Exception as e:
        print("Eror sistem: " + str(e))

bicara("Sistem siap. Silakan beri perintah.")
while True:
    rekam()