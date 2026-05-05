import speech_recognition as sr
import paho.mqtt.client as mqtt
import time
import re

broker = "broker.hivemq.com"
topik = "muhayara/rc/whatever-you-want"

klien = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
klien.connect(broker, 1883, 60)

def proses_teks(teks):
    teks = teks.lower()
    arah = "S"
    if "maju" in teks:
        arah = "F"
    elif "mundur" in teks:
        arah = "B"
    elif "kiri" in teks:
        arah = "L"
    elif "kanan" in teks:
        arah = "R"

    angka = re.findall(r'\d+', teks)

    if angka:
        durasi = float(angka[0])
    else:
        # Durasi otomatis untuk belok tanpa angka
        if arah in ["L", "R"]:
            durasi = 0.6
        else:
            durasi = 1.0

    if arah != "S":
        return f"{arah},{durasi}"
    return "SALAH"

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
        
        hasil = proses_teks(ucapan)
        
        bagian = hasil.split(",")
        if len(bagian) == 2:
            arah = bagian[0]
            durasi = float(bagian[1])
            klien.publish(topik, arah)
            print("Jalan " + arah)
            time.sleep(durasi)
            klien.publish(topik, 'S')
            print("Berhenti")
        else:
            print("Arah salah")
            
    except sr.UnknownValueError:
        print("Suara kurang jelas")
    except Exception as e:
        print("Eror: " + str(e))

while True:
    rekam()