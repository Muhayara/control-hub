import speech_recognition as sr
import paho.mqtt.client as mqtt
from google import genai
import time
from gtts import gTTS
import os
import dotenv
dotenv.load_dotenv()
os.environ['PYGAME_HIDE_SUPPORT_PROMPT'] = "hide"
import pygame
import io

broker = "broker.hivemq.com"
topik = "muhayara/rc/whatever-you-want"

klien = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
klien.connect(broker, 1883, 60)

ai_klien = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

pygame.mixer.init()

def bicara(teks):
    print("AI: " + teks)
    try:
        tts = gTTS(text=teks, lang='id')
        file_suara = io.BytesIO()
        tts.write_to_fp(file_suara)
        file_suara.seek(0)
        pygame.mixer.music.load(file_suara)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)
    except Exception as e:
        print("Eror suara:", e)

def proses_ai(teks):
    instruksi = f"Buat balasan percakapan santai dan terjemahkan arah. Gunakan format mutlak BALASAN | HURUF,ANGKA. F maju, B mundur, L kiri, R kanan. Angka adalah durasi detik. Jika tidak ada angka tulis 1. Ambil arah pertama saja. DILARANG menggunakan karakter pemisah lain. Contoh keluaran: Siap mobil bergerak maju satu detik | F,1. Kalimat Kamu: {teks}"
    hasil = ai_klien.models.generate_content(
        model='gemini-2.5-flash',
        contents=instruksi,
    )
    return hasil.text.strip()

def rekam():
    perekam = sr.Recognizer()
    perekam.pause_threshold = 0.5
    with sr.Microphone() as sumber:
        print("Mendengarkan suara")
        perekam.adjust_for_ambient_noise(sumber)
        try:
            audio = perekam.listen(sumber, timeout=3, phrase_time_limit=4)
        except sr.WaitTimeoutError:
            print("Tidak ada suara")
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
                
                if arah in ['F', 'B', 'L', 'R']:
                    klien.publish(topik, arah)
                    print("Jalan " + arah)
                    time.sleep(durasi)
                    klien.publish(topik, 'S')
                    print("Berhenti")
                else:
                    bicara("Arah pergerakan tidak valid")
            else:
                bicara("Format kode arah salah")
        else:
            bicara("Maaf saya tidak memahami maksud Kamu")
            
    except sr.UnknownValueError:
        print("Suara kurang jelas")
    except Exception as e:
        print("Eror: " + str(e))

bicara("Sistem kontrol suara aktif silakan beri perintah")
while True:
    rekam()