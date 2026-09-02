import cv2
import mediapipe as mp
import paho.mqtt.client as mqtt
import time

# Konfigurasi MQTT
broker = "broker.hivemq.com"
topik = "muhayara/rc/whatever-you-want"
klien = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
klien.connect(broker, 1883, 60)

# Inisialisasi MediaPipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.7)
mp_draw = mp.solutions.drawing_utils

# Inisialisasi Kamera
cap = cv2.VideoCapture(0)
perintah_terakhir = "S"

def kirim_perintah(perintah):
    global perintah_terakhir
    if perintah != perintah_terakhir:
        klien.publish(topik, perintah)
        perintah_terakhir = perintah
        print(f"Perintah: {perintah}")

while cap.isOpened():
    sukses, frame = cap.read()
    if not sukses:
        break

    # Balik frame agar seperti cermin
    frame = cv2.flip(frame, 1)
    h, w, c = frame.shape
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    hasil = hands.process(img_rgb)

    perintah_sekarang = "S"

    if hasil.multi_hand_landmarks:
        for hand_landmarks in hasil.multi_hand_landmarks:
            mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
            
            # Ambil koordinat ujung jari telunjuk (Landmark 8)
            index_finger_tip = hand_landmarks.landmark[8]
            x, y = int(index_finger_tip.x * w), int(index_finger_tip.y * h)
            
            # Visualisasi titik jari
            cv2.circle(frame, (x, y), 15, (0, 255, 0), cv2.FILLED)

            # Logika Area Kontrol (Bagi layar menjadi 3x3)
            if y < h // 3:
                perintah_sekarang = "F" # Maju
            elif y > 2 * h // 3:
                perintah_sekarang = "B" # Mundur
            elif x < w // 3:
                perintah_sekarang = "L" # Kiri
            elif x > 2 * w // 3:
                perintah_sekarang = "R" # Kanan
            else:
                perintah_sekarang = "S" # Berhenti (Tengah)

    kirim_perintah(perintah_sekarang)

    # Tampilan Visual
    cv2.putText(frame, f"KONTROL: {perintah_sekarang}", (10, 50), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
    
    # Gambar garis pembagi area
    cv2.line(frame, (w // 3, 0), (w // 3, h), (255, 255, 255), 1)
    cv2.line(frame, (2 * w // 3, 0), (2 * w // 3, h), (255, 255, 255), 1)
    cv2.line(frame, (0, h // 3), (w, h // 3), (255, 255, 255), 1)
    cv2.line(frame, (0, 2 * h // 3), (w, 2 * h // 3), (255, 255, 255), 1)

    cv2.imshow("Hand Tracking RC Car", frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
kirim_perintah("S")