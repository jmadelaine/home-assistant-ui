import { BellAlert, Pause, Play, Trash3, VolumeSlash } from "../../shared/icons.js";
import { createRoot, css, haptic, icon, registerCard } from "../../shared/card.js";
import { everySecond } from "../../shared/clock.js";
import styles from "./styles.css?inline";

const sheet = css(styles);

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const STORAGE_KEY = "timer-card";
const MAX_MINUTES = 24 * 60;
// A finished timer chimes every CHIME_EVERY until dismissed, for up to RING_FOR.
// Ticks come once a second, so it's a whole number of seconds.
const CHIME_EVERY = 2 * SECOND;
const RING_FOR = 10 * MINUTE;

/*
 * Timers, shared by every timer card in this browser and kept in its storage,
 * so they survive a reload. A running timer has `end` (a timestamp), a paused
 * one `left` (ms). A running timer whose end has passed is finished.
 *
 * Ends fall on whole seconds, and the cards redraw on the shared clock, so
 * every timer (and any clock card) changes at the same moment.
 */

let timers = read();
const cards = new Set();
let stopTicking;
let lastChime = 0;
let audio;

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(list)
      ? list.filter((t) => typeof t?.id === "string" && typeof t.duration === "number" && (t.end ?? t.left) != null)
      : [];
  } catch {
    return [];
  }
}

function write(next) {
  timers = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  } catch {
    // Storage is blocked: the timers still run until the page closes
  }
  tick();
}

// Another tab on this device changed the timers
addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY) return;
  timers = read();
  tick();
});

// The end of a timer `ms` from now, on the second before so it shows its
// full length right away, e.g. 5:00 rather than 5:01
const endIn = (ms) => Math.floor((Date.now() + ms) / SECOND) * SECOND;

const change = (id, fn) => write(timers.map((t) => (t.id === id ? fn({ ...t }) : t)));

const actions = {
  start(duration) {
    // crypto.randomUUID needs HTTPS, and Home Assistant is often on plain HTTP
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    write([...timers, { id, duration, end: endIn(duration) }]);
  },
  pause: (id) =>
    change(id, (t) => {
      t.left = Math.max(0, t.end - Date.now());
      delete t.end;
      return t;
    }),
  resume: (id) =>
    change(id, (t) => {
      t.end = endIn(t.left);
      delete t.left;
      return t;
    }),
  // A minute more (+1) or less (−1). A finished timer can only gain one, which
  // starts it again; a timer can't lose its last minute.
  adjust: (id, minutes) =>
    change(id, (t) => {
      const ms = minutes * MINUTE;
      const left = t.left ?? t.end - Date.now();
      if (left <= 0) return minutes > 0 ? { ...t, end: endIn(MINUTE), duration: MINUTE } : t;
      if (left + ms <= 0) return t;
      if (t.left != null) t.left += ms;
      else t.end += ms;
      t.duration = Math.max(SECOND, t.duration + ms);
      return t;
    }),
  // Only a paused or finished timer can go, so a stray tap can't lose one that's running
  remove: (id) => write(timers.filter((t) => t.id !== id || stateOf(t, Date.now()) === "running")),
};

// Redraws every card, and chimes while a timer has finished. Runs every second
// on the shared clock while there's a card and a timer to show, and straight
// away when the timers change.
function tick(now = Date.now()) {
  const ringing = timers.some((t) => t.end != null && t.end <= now && now - t.end < RING_FOR);
  if (!ringing) lastChime = 0;
  // Ticks land a few ms apart from second to second, hence the leeway
  else if (now - lastChime >= CHIME_EVERY - 100) {
    lastChime = now;
    chime();
    // Vibrates the Home Assistant app
    const [card] = cards;
    if (card) haptic(card, "heavy");
  }

  for (const card of cards) card._render(now);

  const needed = cards.size > 0 && timers.length > 0;
  if (needed && !stopTicking) stopTicking = everySecond(tick);
  else if (!needed && stopTicking) {
    stopTicking();
    stopTicking = undefined;
  }
}

/*
 * Sound. Browsers only let a page play sound once someone has interacted with
 * it, but any tap anywhere in Home Assistant counts, including the one that
 * opened this dashboard. So the card turns sound on as soon as it shows, and
 * again at the first tap anywhere on the page if that was too early.
 */

const GESTURES = ["click", "keydown", "touchend", "pointerdown"];

function unlockAudio() {
  if (soundOn()) return;
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) return;
  if (!audio) {
    audio = new Context();
    audio.addEventListener("statechange", () => tick());
    for (const type of GESTURES) addEventListener(type, unlockAudio, { capture: true, passive: true });
  }
  audio.resume().catch(() => {});
}

const soundOn = () => audio?.state === "running";

// Five quick dings climbing a major chord to the octave and bouncing back a
// step, like a friendly doorbell: da-da-da-da-da. The rest of CHIME_EVERY is
// the pause before the next five. The notes sit at about 500 Hz–1 kHz, warm
// rather than piercing, and their second harmonics reach 1–2 kHz, where
// hearing is sharpest, so they still carry over an extractor's hum and a
// pan's sizzle.
const DING = {
  notes: [523.25, 659.25, 784, 1046.5, 784], // Hz: C5 E5 G5 C6 G5
  gap: 0.13, // s from one ding to the next
  attack: 0.012, // s to full strength; a slower swell takes the click off the start
  hold: 0.03, // s at full strength
  release: 0.18, // s to fade out
  volume: 0.45,
  // The tones each ding is made of: [multiple of the note, level, wave]. The
  // note is layered across four octaves: one below for warmth, and two above
  // for presence and a marimba's ring. A touch of the third rounds it out.
  partials: [
    [0.5, 0.3, "sine"],
    [1, 1, "sine"],
    [2, 0.3, "sine"],
    [3, 0.05, "sine"],
    [4, 0.12, "sine"],
  ],
};

// A light bell over each ding, an octave up: struck quickly and left to ring,
// for a little sparkle. Its overtones aren't whole multiples of the note,
// which is what makes a bell sound like a bell rather than a pipe.
const BELL = {
  octave: 2, // multiple of the ding's note
  attack: 0.003,
  hold: 0,
  release: 0.4,
  volume: 0.12,
  partials: [
    [1, 1, "sine"],
    [2.76, 0.25, "sine"],
    [5.4, 0.06, "sine"],
  ],
};

// A small, warm room: each ding plays straight out, plus reverb that fades
// over `length` seconds, softened above `tone` Hz so the tail isn't hissy
const REVERB = {
  length: 1.2,
  decay: 3, // how quickly the echo dies away; higher is quicker
  tone: 3000,
  mix: 0.3, // the reverb's level against the ding itself
};

// Echoes: each ding repeats every `time` seconds, each repeat quieter (by
// `feedback`) and softer (above `tone` Hz). Half a ding apart from the dings
// themselves, so the repeats fall between them and can be heard.
const ECHO = {
  time: 0.195, // 1.5 × DING.gap
  feedback: 0.35,
  tone: 2500,
  mix: 0.3, // the first repeat's level against the ding itself
};

// Where every ding plays: straight to the speakers, through the echo, and
// through the reverb, which the echoes go through too. Made once per audio context.
let output;
function soundOutput() {
  if (output?.context === audio) return output;
  const gain = (value) => {
    const node = audio.createGain();
    node.gain.value = value;
    return node;
  };
  const lowpass = (frequency) => {
    const node = audio.createBiquadFilter();
    node.type = "lowpass";
    node.frequency.value = frequency;
    return node;
  };

  const room = audio.createConvolver();
  room.buffer = roomImpulse();
  room.connect(lowpass(REVERB.tone)).connect(gain(REVERB.mix)).connect(audio.destination);

  const delay = audio.createDelay(1);
  delay.delayTime.value = ECHO.time;
  const repeat = lowpass(ECHO.tone);
  delay.connect(repeat).connect(gain(ECHO.feedback)).connect(delay);
  const echoes = gain(ECHO.mix);
  repeat.connect(echoes);
  echoes.connect(audio.destination);
  echoes.connect(room);

  output = gain(1);
  output.connect(audio.destination);
  output.connect(delay);
  output.connect(room);
  return output;
}

// How a room answers a sound: noise fading away, a little different in each ear
function roomImpulse() {
  const length = Math.round(audio.sampleRate * REVERB.length);
  const impulse = audio.createBuffer(2, length, audio.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** REVERB.decay;
  }
  return impulse;
}

function chime() {
  if (!soundOn()) return;
  const start = audio.currentTime + 0.02;
  DING.notes.forEach((pitch, i) => {
    const at = start + i * DING.gap;
    play(DING, pitch, at);
    play(BELL, pitch * BELL.octave, at);
  });
}

// One note of a voice (DING or BELL): a swell, a hold, then a natural fade
function play(voice, pitch, at) {
  const { attack, hold, release, volume, partials } = voice;
  const fade = at + attack + hold;
  const envelope = audio.createGain();
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(volume, at + attack);
  envelope.gain.setValueAtTime(volume, fade);
  // Falls to about 2% by the end of the release
  envelope.gain.setTargetAtTime(0, fade, release / 4);
  envelope.connect(soundOutput());
  for (const [ratio, level, type] of partials) {
    const tone = audio.createOscillator();
    tone.type = type;
    tone.frequency.value = pitch * ratio;
    const gain = audio.createGain();
    gain.gain.value = level;
    tone.connect(gain).connect(envelope);
    tone.start(at);
    tone.stop(fade + release);
  }
}

/*
 * Formatting
 */

// Time left as a clock, e.g. "4:05" or "1:02:30". Seconds round up, so a
// 5-minute timer starts at 5:00 and finishes as it reaches 0:00.
function countdown(ms) {
  const total = Math.ceil(Math.max(0, ms) / SECOND);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// The keys that change the length of the next timer, in minutes: around the
// length, then the bigger jumps beside Start
const STEPS = [-5, -1, 1, 5];
const QUICK_STEPS = [10, 30];

const stepKey = (m) =>
  `<button class="key step" data-minutes="${m}" aria-label="${m > 0 ? "Add" : "Take off"} ${Math.abs(m)} min">${m > 0 ? "+" : "−"}${Math.abs(m)}</button>`;

const stateOf = (t, now) => (t.left != null ? "paused" : t.end <= now ? "done" : "running");
// Finished first, then running, then paused; within each, soonest first
const RANK = { done: 0, running: 1, paused: 2 };

class TimerCard extends HTMLElement {
  setConfig(config) {
    this.config = { ...config };
    if (!this.shadowRoot) {
      this._build();
      this._setMinutes(0);
    }
    this._render(Date.now());
  }

  set hass(hass) {
    const lang = hass.locale?.language ?? hass.language;
    if (lang === this._lang) return;
    this._lang = lang;
    this._render(Date.now());
  }

  connectedCallback() {
    cards.add(this);
    unlockAudio();
    tick();
  }

  disconnectedCallback() {
    cards.delete(this);
    tick();
  }

  _build() {
    const root = createRoot(
      this,
      sheet,
      `<ha-card>
        <div class="title"></div>
        <div class="timers"></div>
        <div class="controls">
          <div class="setter">
            ${STEPS.map(stepKey).join("")}
            <span class="length" aria-live="polite"></span>
          </div>
          <div class="go">
            <button class="key clear">Clear</button>
            <button class="key start">${icon(Play)}<span>Start</span></button>
            ${QUICK_STEPS.map(stepKey).join("")}
          </div>
        </div>
        <!-- Last, so hiding it after the first tap doesn't shift the buttons above -->
        <button class="sound-off key" hidden>${icon(VolumeSlash)}<span>Tap anywhere to turn the sound on</span></button>
      </ha-card>`,
    );
    this._rows = new Map();


    const press = (selector, fn) =>
      root.querySelector(selector).addEventListener("click", () => {
        fn();
        haptic(this);
      });
    for (const key of root.querySelectorAll(".step")) {
      key.addEventListener("click", () => {
        this._setMinutes(this._minutes + Number(key.dataset.minutes));
        haptic(this);
      });
    }
    press(".clear", () => this._setMinutes(0));
    // Back to 0 after starting, ready for the next timer
    press(".start", () => {
      actions.start(this._minutes * MINUTE);
      this._setMinutes(0);
    });
  }

  // Sets the length of the next timer, from 0 to MAX_MINUTES
  _setMinutes(minutes) {
    this._minutes = Math.min(MAX_MINUTES, Math.max(0, minutes));
    const root = this.shadowRoot;
    root.querySelector(".length").textContent = countdown(this._minutes * MINUTE);
    root.querySelector(".start").disabled = this._minutes === 0;
    root.querySelector(".clear").disabled = this._minutes === 0;
    for (const key of root.querySelectorAll(".step")) {
      key.disabled = this._minutes === (key.dataset.minutes < 0 ? 0 : MAX_MINUTES);
    }
  }

  // One row per timer, made once and updated on every tick
  _row(timer) {
    const row = document.createElement("div");
    row.className = "timer surface";
    row.innerHTML = `
      <div class="info">
        <div class="left"><span class="ring">${icon(BellAlert, "Filled")}</span><span class="time"></span></div>
        <div class="when secondary"></div>
      </div>
      <div class="actions">
        <button class="key toggle"></button>
        <button class="key less" aria-label="One minute less">−1</button>
        <button class="key more" aria-label="One minute more">+1</button>
        <button class="key remove" aria-label="Delete">${icon(Trash3)}</button>
      </div>
      <div class="bar"><span></span></div>`;
    const press = (selector, fn) =>
      row.querySelector(selector).addEventListener("click", () => {
        fn();
        haptic(this);
      });
    press(".toggle", () => (row.dataset.state === "paused" ? actions.resume : actions.pause)(timer.id));
    press(".less", () => actions.adjust(timer.id, -1));
    press(".more", () => actions.adjust(timer.id, 1));
    press(".remove", () => actions.remove(timer.id));
    return row;
  }

  _render(now) {
    const root = this.shadowRoot;
    if (!root || !this.config) return;
    const $ = (selector) => root.querySelector(selector);
    const clock = (t) =>
      new Date(t).toLocaleTimeString(this._lang, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

    $(".title").textContent = this.config.name ?? "";
    $(".sound-off").hidden = !timers.length || soundOn();

    const sorted = timers
      .map((t) => ({ ...t, state: stateOf(t, now) }))
      .sort((a, b) => RANK[a.state] - RANK[b.state] || (a.end ?? a.left) - (b.end ?? b.left));

    for (const id of this._rows.keys()) {
      if (!sorted.some((t) => t.id === id)) this._rows.delete(id);
    }
    const rows = sorted.map((t) => {
      if (!this._rows.has(t.id)) this._rows.set(t.id, this._row(t));
      const row = this._rows.get(t.id);
      const left = t.state === "paused" ? t.left : t.end - now;

      // ⏸ and ▶ share the end of the row. A paused timer also gets 🗑, at the
      // other end, away from the finger that paused it (styles.css).
      if (row.dataset.state !== t.state) {
        row.dataset.state = t.state;
        const paused = t.state === "paused";
        row.querySelector(".toggle").replaceChildren(
          (paused ? Play : Pause)({ weight: "Outline" }),
        );
        row.querySelector(".toggle").setAttribute("aria-label", paused ? "Resume" : "Pause");
      }
      row.querySelector(".time").textContent = t.state === "done" ? "Done" : countdown(left);
      // The timer's length, then where it's at, e.g. "5:00 · ends 14:44"
      const status =
        t.state === "done"
          ? `ended ${clock(t.end)} · ${countdown(now - t.end)} ago`
          : t.state === "paused"
            ? "paused"
            : `ends ${clock(t.end)}`;
      row.querySelector(".when").textContent = `${countdown(t.duration)} · ${status}`;
      // The bar fills as the time runs out
      const done = t.state === "done" ? 1 : 1 - left / t.duration;
      row.querySelector(".bar span").style.width = `${Math.min(1, Math.max(0, done)) * 100}%`;
      // Losing a minute would finish it, so −1 is off for the last minute
      row.querySelector(".less").disabled = t.state === "done" || left <= MINUTE;
      return row;
    });

    const list = $(".timers");
    if (rows.length !== list.children.length || rows.some((row, i) => list.children[i] !== row)) {
      list.replaceChildren(...rows);
    }
  }

  getCardSize() {
    return 2 + timers.length;
  }
}

registerCard("timer-card", TimerCard, {
  name: "Timer",
  description: "Kitchen timers: start several at once, watch them count down, and hear a chime when each finishes",
});
