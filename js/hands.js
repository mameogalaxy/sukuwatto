/**
 * 手で塗る / つまむ（MediaPipe Hand Landmarker）
 *
 * カメラ映像から両手の指21点をリアルタイム検出し、
 *  - 指を ひらいて 人差し指で キャラに ふれる → じわっと色がしみこむ
 *  - 親指と人差し指で つまむ → キャラを つかんで うごかす
 * 指タッチでも塗れるので、手認識が不調でも遊べる（これは“追加の魔法”）。
 *
 * ※ モジュール。CDN から MediaPipe を読み込み、window.Hands に公開する。
 */
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let landmarker = null;
let running = false;
let video = null;
let cursorsEl = null;
let lastTs = -1;

// つまみ状態(手ごと)
const grabs = [false, false];
const lastGrabPt = [null, null];

async function ensureModel() {
  if (landmarker) return;
  const vision = await FilesetResolver.forVisionTasks(WASM);
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO",
    numHands: 2,
  });
  try {
    landmarker = await HandLandmarker.createFromOptions(vision, opts("GPU"));
  } catch (e) {
    console.warn("GPU delegate failed, trying CPU:", e);
    landmarker = await HandLandmarker.createFromOptions(vision, opts("CPU"));
  }
}

async function start() {
  await ensureModel();
  video = document.getElementById("ar-video");
  cursorsEl = document.getElementById("hand-cursors");
  running = true;
  loop();
}

function stop() {
  running = false;
  if (cursorsEl) cursorsEl.innerHTML = "";
  if (window.AR && AR.setSteady) AR.setSteady(false);
  grabs[0] = grabs[1] = false;
  lastGrabPt[0] = lastGrabPt[1] = null;
}

function isActive() { return running; }

// 動画フレーム座標(正規化) → 画面座標(object-fit: cover を再現)
function toScreen(nx, ny) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const sw = window.innerWidth, sh = window.innerHeight;
  const scale = Math.max(sw / vw, sh / vh);
  const dw = vw * scale, dh = vh * scale;
  const ox = (sw - dw) / 2, oy = (sh - dh) / 2;
  return { x: nx * vw * scale + ox, y: ny * vh * scale + oy };
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function loop() {
  if (!running) return;
  try {
    if (video && video.readyState >= 2 && video.videoWidth) {
      const ts = Math.max(lastTs + 1, performance.now());
      lastTs = ts;
      const res = landmarker.detectForVideo(video, ts);
      handle(res);
    }
  } catch (e) {
    console.warn("hand detect error:", e);
  }
  requestAnimationFrame(loop);
}

function handle(res) {
  const hands = (res && res.landmarks) || [];
  renderCursors(hands);
  if (window.AR && AR.setSteady) AR.setSteady(hands.length > 0); // 手があるあいだは止めて狙いやすく

  for (let i = 0; i < hands.length && i < 2; i++) {
    const lm = hands[i];
    const tip = toScreen(lm[8].x, lm[8].y);     // 人差し指の先
    const thumb = toScreen(lm[4].x, lm[4].y);   // 親指の先
    const palm = toScreen(lm[0].x, lm[0].y);    // 手首
    const handSize = dist(tip, palm) || 1;
    const pinching = dist(tip, thumb) < handSize * 0.45;

    if (pinching) {
      // つまむ → つかんで動かす
      const grabPt = { x: (tip.x + thumb.x) / 2, y: (tip.y + thumb.y) / 2 };
      if (!grabs[i]) {
        grabs[i] = window.AR && AR.isOverArt ? AR.isOverArt(grabPt.x, grabPt.y) : true;
        lastGrabPt[i] = grabPt;
      } else if (lastGrabPt[i] && window.AR && AR.moveBy) {
        AR.moveBy(grabPt.x - lastGrabPt[i].x, grabPt.y - lastGrabPt[i].y);
        lastGrabPt[i] = grabPt;
      }
    } else {
      grabs[i] = false;
      lastGrabPt[i] = null;
      // ひらいた手 → 指先で塗る
      if (window.Coloring && Coloring.handPaint) Coloring.handPaint(tip.x, tip.y);
    }
  }
  if (hands.length < 2) { grabs[1] = false; lastGrabPt[1] = null; }
  if (hands.length < 1) { grabs[0] = false; lastGrabPt[0] = null; }
}

function renderCursors(hands) {
  if (!cursorsEl) return;
  // 必要な数だけ カーソル要素を用意
  while (cursorsEl.children.length < hands.length) {
    const c = document.createElement("div");
    c.className = "hand-cursor";
    cursorsEl.appendChild(c);
  }
  for (let i = 0; i < cursorsEl.children.length; i++) {
    const el = cursorsEl.children[i];
    if (i >= hands.length) { el.style.display = "none"; continue; }
    const lm = hands[i];
    const tip = toScreen(lm[8].x, lm[8].y);
    const thumb = toScreen(lm[4].x, lm[4].y);
    const palm = toScreen(lm[0].x, lm[0].y);
    const pinching = dist(tip, thumb) < (dist(tip, palm) || 1) * 0.45;
    el.style.display = "block";
    el.style.transform = `translate(${tip.x}px, ${tip.y}px)`;
    el.classList.toggle("pinch", pinching);
  }
}

window.Hands = { start, stop, isActive };
