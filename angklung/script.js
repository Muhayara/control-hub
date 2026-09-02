// ─── DATA ────────────────────────────────────────────────────────────────────
const songs = [
  { title: "Selamat Ulang Tahun", meta: "4/4 · 100 BPM", duration: 50 },
  { title: "Balonku Ada Lima",   meta: "4/4 · 90 BPM",  duration: 42 },
  { title: "Gundul Pacul",       meta: "4/4 · 100 BPM", duration: 55 },
  { title: "Rasa Sayange",       meta: "4/4 · 110 BPM", duration: 48 },
  { title: "Manuk Dadali",       meta: "3/4 · 96 BPM",  duration: 60 },
  { title: "Jali-Jali",         meta: "4/4 · 118 BPM", duration: 52 },
  { title: "Demo Mode",          meta: "Free · All notes", duration: 30 },
];

const notes = ["Do","Re","Mi","Fa","Sol","La","Si","Do'"];
const noteFreq = [261,294,330,349,392,440,494,523];

// =============================================
// KONFIGURASI — samakan dengan main.cpp
// =============================================
const BASE_TOPIC = 'muhayara/example'
const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt'
// =============================================

let activeSong = -1, isPlaying = false, progTimer = null;
let relayState = new Array(8).fill(false);
let seqIdx = 0, seqTimer = null;
let connected = false;

// ─── BUILD SIDEBAR SONGS ────────────────────────────────────────────────────
const songList = document.getElementById('songList');
songs.forEach((s,i) => {
  const el = document.createElement('div');
  el.className = 'song-item';
  el.id = 'song-' + i;
  el.innerHTML = `<div class="song-num">${String(i+1).padStart(2,'0')}</div>
    <div class="song-info"><div class="song-title">${s.title}</div><div class="song-meta">${s.meta}</div></div>
    <div class="song-badge">MIDI</div>`;
  el.onclick = () => selectSong(i);
  songList.appendChild(el);
});

// ─── BUILD NOTE GRID ─────────────────────────────────────────────────────────
const noteGrid = document.getElementById('noteGrid');
notes.forEach((n,i) => {
  const btn = document.createElement('button');
  btn.className = 'note-btn'; btn.id = 'note-'+i;
  btn.innerHTML = `${n}<span>CH${i+1}</span>`;
  btn.onmousedown = () => fireRelay(i, true);
  btn.onmouseup   = () => fireRelay(i, false);
  btn.ontouchstart = (e) => { e.preventDefault(); fireRelay(i, true); }
  btn.ontouchend   = (e) => { e.preventDefault(); fireRelay(i, false); }
  noteGrid.appendChild(btn);
});

// ─── BUILD RELAY GRID ────────────────────────────────────────────────────────
const relayGrid = document.getElementById('relayGrid');
notes.forEach((n,i) => {
  const ch = document.createElement('div');
  ch.className = 'relay-ch'; ch.id = 'relay-'+i;
  ch.innerHTML = `<div class="relay-led" id="led-${i}"></div>
    <div class="relay-note">${n}</div>
    <div class="relay-idx">CH ${i+1}</div>`;
  relayGrid.appendChild(ch);
});

// ─── BUILD VIZ BARS ──────────────────────────────────────────────────────────
const vizBars = document.getElementById('vizBars');
notes.forEach((n,i) => {
  const wrap = document.createElement('div');
  wrap.className = 'viz-bar-wrap';
  wrap.innerHTML = `<div class="viz-bar" id="bar-${i}" style="height:4px"></div>
    <div class="viz-bar-label">${n}</div>`;
  vizBars.appendChild(wrap);
});

// ─── AUDIO TEST (Web Audio synth) ────────────────────────────────────────────
let audioCtx = null;
const activeOscillators = {};
function ensureAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playToneStart(ch) {
  if (!document.getElementById('audioTestToggle').checked) return;
  const ctx = ensureAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = noteFreq[ch];
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start();
  activeOscillators[ch] = {osc, gain};
}
function playToneStop(ch) {
  const o = activeOscillators[ch];
  if (!o) return;
  const ctx = ensureAudioCtx();
  o.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
  o.osc.stop(ctx.currentTime + 0.14);
  delete activeOscillators[ch];
}

// ─── RELAY FIRE ──────────────────────────────────────────────────────────────
function fireRelay(ch, on) {
  relayState[ch] = on;
  if (connected) mqttClient.publish(BASE_TOPIC + '/' + ch, on ? '1' : '0');
  if (on) playToneStart(ch); else playToneStop(ch);
  document.getElementById('relay-'+ch).classList.toggle('active', on);
  document.getElementById('note-'+ch).classList.toggle('firing', on);
  const bar = document.getElementById('bar-'+ch);
  if (on) {
    bar.style.height = (20 + Math.random()*55) + 'px';
    bar.style.background = 'linear-gradient(180deg, var(--active), var(--cic-blue))';
  } else {
    setTimeout(() => {
      bar.style.height = '4px';
      bar.style.background = 'linear-gradient(180deg, var(--cic-blue-light), var(--cic-blue-dim))';
    }, 80);
  }
}

// ─── SONG SELECT ─────────────────────────────────────────────────────────────
function selectSong(i) {
  if (isPlaying) stopAll();
  document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));
  document.getElementById('song-'+i).classList.add('active');
  activeSong = i;
  const s = songs[i];
  document.getElementById('npTitle').textContent = s.title.toUpperCase();
  document.getElementById('npSub').textContent = s.meta + ' · ESP32 MQTT';
  document.getElementById('timeTotal').textContent = formatTime(s.duration);
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('timeCur').textContent = '0:00';
  document.getElementById('tempoSlider').value = parseInt(s.meta.split('·')[1]) || 120;
  document.getElementById('tempoVal').textContent = document.getElementById('tempoSlider').value;
}

// ─── PLAY / STOP ─────────────────────────────────────────────────────────────
function togglePlay() {
  if (activeSong < 0) { selectSong(0); }
  isPlaying ? pauseSong() : playSong();
}

function playSong() {
  isPlaying = true;
  document.getElementById('playBtn').innerHTML = '⏸';
  document.getElementById('playBtn').classList.add('playing');
  const s = songs[activeSong];
  let elapsed = parseFloat(document.getElementById('progressFill').style.width||'0') / 100 * s.duration;
  progTimer = setInterval(() => {
    elapsed += 0.1;
    if (elapsed >= s.duration) { elapsed = s.duration; stopAll(); return; }
    document.getElementById('progressFill').style.width = (elapsed/s.duration*100)+'%';
    document.getElementById('timeCur').textContent = formatTime(elapsed);
  }, 100);
  startSequence();
}

function pauseSong() {
  isPlaying = false;
  document.getElementById('playBtn').innerHTML = '▶';
  document.getElementById('playBtn').classList.remove('playing');
  clearInterval(progTimer);
  clearTimeout(seqTimer);
  relayState.fill(false);
  notes.forEach((_,i) => fireRelay(i, false));
}

function stopAll() {
  pauseSong();
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('timeCur').textContent = '0:00';
}

function prevSong() {
  stopAll();
  selectSong(Math.max(0, activeSong-1));
}
function nextSong() {
  stopAll();
  selectSong(Math.min(songs.length-1, activeSong < 0 ? 0 : activeSong+1));
}

// ─── SEQUENCE LAGU ───────────────────────────────────────────────────────────
const songSeqs = [
  [
    {n:2,d:1},{n:3,d:1},{n:4,d:1},{n:7,d:1},{n:4,d:1},{n:2,d:1},{n:4,d:2},
    {n:1,d:1},{n:2,d:1},{n:3,d:1},{n:1,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:2},
    {n:0,d:1},{n:0,d:1},{n:5,d:1},{n:5,d:1},{n:6,d:1},{n:7,d:1},{n:4,d:2},
    {n:2,d:1},{n:3,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:1},{n:1,d:1},{n:0,d:2},
    {n:2,d:1},{n:3,d:1},{n:4,d:1},{n:7,d:1},{n:4,d:1},{n:2,d:1},{n:4,d:2},
    {n:1,d:1},{n:2,d:1},{n:3,d:1},{n:1,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:2},
    {n:0,d:1},{n:0,d:1},{n:5,d:1},{n:5,d:1},{n:6,d:1},{n:7,d:1},{n:4,d:2},
    {n:2,d:1},{n:3,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:1},{n:1,d:1},{n:0,d:2},
  ],
  [
    {n:0,d:1},{n:2,d:1},{n:0,d:1},{n:2,d:1},{n:3,d:1},{n:4,d:1},{n:4,d:2},
    {n:6,d:1},{n:7,d:1},{n:6,d:1},{n:7,d:1},{n:6,d:1},{n:4,d:2},
    {n:0,d:1},{n:2,d:1},{n:0,d:1},{n:2,d:1},{n:3,d:1},{n:4,d:1},{n:4,d:2},
    {n:6,d:1},{n:7,d:1},{n:6,d:1},{n:7,d:1},{n:6,d:1},{n:4,d:2},
    {n:0,d:1},{n:2,d:1},{n:4,d:1},{n:3,d:1},{n:3,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:1},{n:0,d:1},{n:3,d:1},{n:2,d:1},{n:0,d:2},
    {n:0,d:1},{n:2,d:1},{n:4,d:1},{n:3,d:1},{n:3,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:1},{n:0,d:1},{n:3,d:1},{n:2,d:1},{n:0,d:2},
  ],
  [
    {n:0,d:1},{n:0,d:1},{n:2,d:1},{n:4,d:1},{n:4,d:1},{n:4,d:1},{n:4,d:1},{n:5,d:1},{n:4,d:2},
    {n:4,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:1},{n:0,d:1},{n:2,d:1},{n:0,d:1},{n:1,d:1},{n:2,d:2},
    {n:0,d:1},{n:0,d:1},{n:0,d:1},{n:3,d:1},{n:3,d:1},{n:3,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:2},
    {n:0,d:1},{n:6,d:1},{n:7,d:1},{n:1,d:1},{n:1,d:1},{n:1,d:1},{n:0,d:1},{n:6,d:1},{n:7,d:2},
    {n:2,d:1},{n:3,d:1},{n:4,d:1},{n:4,d:1},{n:0,d:1},{n:6,d:1},{n:5,d:1},{n:4,d:1},{n:4,d:1},{n:2,d:1},{n:3,d:1},{n:4,d:2},
    {n:0,d:1},{n:6,d:1},{n:5,d:1},{n:5,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:1},{n:3,d:2},
    {n:2,d:1},{n:0,d:1},{n:1,d:1},{n:1,d:1},{n:0,d:1},{n:6,d:1},{n:7,d:2},
  ],
  [
    {n:2,d:1},{n:0,d:1},{n:1,d:1},{n:2,d:1},{n:4,d:1},{n:5,d:1},{n:4,d:1},{n:5,d:1},{n:0,d:1},{n:1,d:1},{n:2,d:1},{n:2,d:1},{n:2,d:2},
    {n:2,d:1},{n:0,d:1},{n:1,d:1},{n:2,d:1},{n:4,d:1},{n:5,d:1},{n:4,d:1},{n:5,d:1},{n:0,d:1},{n:2,d:1},{n:1,d:1},{n:0,d:1},{n:1,d:2},
    {n:2,d:1},{n:1,d:1},{n:0,d:1},{n:5,d:1},{n:0,d:1},{n:5,d:1},{n:0,d:1},{n:1,d:1},{n:2,d:1},{n:5,d:1},{n:0,d:1},{n:1,d:1},{n:1,d:1},{n:1,d:2},
    {n:5,d:1},{n:1,d:1},{n:2,d:1},{n:3,d:1},{n:1,d:1},{n:3,d:1},{n:3,d:1},{n:1,d:1},{n:2,d:1},{n:3,d:1},{n:3,d:1},{n:3,d:2},
    {n:5,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:1},{n:0,d:1},{n:2,d:1},{n:2,d:1},{n:0,d:1},{n:3,d:1},{n:2,d:1},{n:2,d:1},{n:2,d:2},
  ],
  [
    {n:5,d:1},{n:5,d:1},{n:4,d:1},{n:2,d:1},{n:1,d:1},{n:2,d:1},{n:1,d:1},{n:0,d:1},{n:5,d:2},
    {n:2,d:1},{n:4,d:1},{n:4,d:1},{n:5,d:1},{n:4,d:1},{n:2,d:1},{n:4,d:1},{n:4,d:1},{n:5,d:1},{n:4,d:1},{n:2,d:1},{n:3,d:1},{n:2,d:1},{n:3,d:1},{n:4,d:2},
    {n:4,d:1},{n:4,d:1},{n:4,d:1},{n:7,d:1},{n:6,d:1},{n:4,d:1},{n:4,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:1},{n:1,d:2},
    {n:4,d:1},{n:4,d:1},{n:2,d:1},{n:1,d:1},{n:2,d:1},{n:4,d:1},{n:4,d:1},{n:2,d:1},{n:1,d:1},{n:2,d:1},{n:0,d:1},{n:1,d:1},{n:0,d:1},{n:3,d:1},{n:2,d:1},{n:0,d:2},
  ],
  [
    // Selamat Ulang Tahun
    {n:2,d:1},{n:2,d:1},{n:2,d:1},{n:0,d:1},{n:4,d:1},{n:4,d:1},{n:4,d:2},
    {n:5,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:1},{n:1,d:2},
    {n:3,d:1},{n:3,d:1},{n:3,d:1},{n:4,d:1},{n:6,d:1},{n:6,d:1},{n:6,d:2},
    {n:6,d:1},{n:5,d:1},{n:6,d:1},{n:4,d:1},{n:5,d:1},{n:2,d:2},
    {n:2,d:1},{n:2,d:1},{n:2,d:1},{n:0,d:1},{n:4,d:1},{n:4,d:1},{n:4,d:2},
    {n:5,d:1},{n:4,d:1},{n:2,d:1},{n:0,d:1},{n:5,d:2},
    {n:5,d:1},{n:5,d:1},{n:5,d:1},{n:0,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:2},
    {n:4,d:1},{n:3,d:1},{n:2,d:1},{n:1,d:1},{n:0,d:2},
  ],
  [
    {n:0,d:1},{n:1,d:1},{n:2,d:1},{n:3,d:1},{n:4,d:1},{n:5,d:1},{n:6,d:1},{n:7,d:2},
    {n:6,d:1},{n:5,d:1},{n:4,d:1},{n:3,d:1},{n:2,d:1},{n:1,d:1},{n:0,d:2},
  ],
];

function startSequence() {
  seqIdx = 0;
  runNote();
}

function runNote() {
  if (!isPlaying) return;
  const seq = songSeqs[activeSong] || songSeqs[0];
  const step = seq[seqIdx % seq.length];
  const ch = step.n;
  const bpm = parseInt(document.getElementById('tempoSlider').value) || 120;
  const beatMs = (60000 / bpm) * step.d;
  fireRelay(ch, true);
  seqTimer = setTimeout(() => {
    fireRelay(ch, false);
    seqIdx++;
    seqTimer = setTimeout(runNote, beatMs * 0.15);
  }, beatMs * 0.6);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function formatTime(s) {
  return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
}

// ─── CLOCK ───────────────────────────────────────────────────────────────────
function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent =
    [n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':');
}
setInterval(updateClock, 1000); updateClock();

// ─── MQTT ────────────────────────────────────────────────────────────────────
const connDot   = document.getElementById('connDot');
const connLabel = document.getElementById('connLabel');

const mqttClient = mqtt.connect(BROKER_URL, {
  clientId: 'angklung-web-' + Math.random().toString(16).slice(2, 10),
  clean: true,
  reconnectPeriod: 2000,
  connectTimeout: 8000,
  keepalive: 30,
});

mqttClient.on('connect', () => {
  connected = true;
  connDot.className = 'conn-dot';
  connLabel.textContent = 'MQTT CONNECTED';
});
mqttClient.on('reconnect', () => {
  connected = false;
  connDot.className = 'conn-dot off';
  connLabel.textContent = 'MENGHUBUNGKAN...';
});
mqttClient.on('offline', () => {
  connected = false;
  connDot.className = 'conn-dot off';
  connLabel.textContent = 'DISCONNECTED';
});
mqttClient.on('error', (e) => {
  connected = false;
  connDot.className = 'conn-dot off';
  connLabel.textContent = 'ERROR';
  console.error('MQTT error:', e.message);
});
connDot.style.cursor = 'pointer';
connDot.title = 'Klik untuk reconnect manual';
connDot.addEventListener('click', () => { try { mqttClient.reconnect(); } catch(e){} });

// ─── VOICE COMMAND ───────────────────────────────────────────────────────────
const voiceKeywords = [
  ['balonku'],
  ['gundul', 'pacul'],
  ['rasa sayange', 'rasa sayang'],
  ['manuk dadali', 'manuk'],
  ['jali jali', 'jali-jali'],
  ['selamat ulang tahun', 'ulang tahun', 'ultah'],
  ['demo'],
];

let recognition = null;
let voiceActive = false;
const micBtn = document.getElementById('micBtn');
const voiceCard = document.getElementById('voiceCard');
const voiceStatus = document.getElementById('voiceStatus');
const voiceHeard = document.getElementById('voiceHeard');

function setupRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = 'id-ID';
  r.continuous = true;
  r.interimResults = false;

  r.onresult = (e) => {
    const said = e.results[e.results.length - 1][0].transcript.trim().toLowerCase();
    voiceHeard.textContent = said;

    let matched = -1;
    voiceKeywords.forEach((kws, idx) => {
      if (matched === -1 && kws.some(k => said.includes(k))) matched = idx;
    });

    if (matched >= 0) {
      selectSong(matched);
      playSong();
    } else if (said.includes('mulai') || said.includes('main') || said.includes('play')) {
      togglePlay();
    } else if (said.includes('berhenti') || said.includes('stop')) {
      stopAll();
    }
  };
  r.onerror = (e) => {
    voiceStatus.textContent = 'Error: ' + e.error;
    voiceStatus.style.color = 'var(--warning)';
  };
  r.onend = () => {
    if (voiceActive) { try { r.start(); } catch(e){} }
  };
  return r;
}

function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert('Browser ini tidak mendukung fitur rekaman suara (Web Speech API). Gunakan Chrome atau Edge terbaru.');
    return;
  }
  if (!recognition) recognition = setupRecognition();

  voiceActive = !voiceActive;
  voiceCard.style.display = voiceActive ? 'block' : 'none';
  micBtn.style.borderColor = voiceActive ? 'var(--active)' : '';
  micBtn.style.color = voiceActive ? 'var(--active)' : '';

  if (voiceActive) {
    ensureAudioCtx();
    try { recognition.start(); } catch(e) {}
    voiceStatus.textContent = 'Mendengarkan...';
    voiceStatus.style.color = 'var(--success)';
  } else {
    try { recognition.stop(); } catch(e) {}
    voiceStatus.textContent = 'Nonaktif';
    voiceStatus.style.color = 'var(--cic-blue-light)';
  }
}

// ─── IDLE VIZ FLICKER ────────────────────────────────────────────────────────
setInterval(() => {
  if (!isPlaying) {
    const i = Math.floor(Math.random()*8);
    const bar = document.getElementById('bar-'+i);
    const h = 4 + Math.random() * 8;
    bar.style.height = h+'px';
    setTimeout(() => { if (!relayState[i]) bar.style.height = '4px'; }, 300);
  }
}, 600);