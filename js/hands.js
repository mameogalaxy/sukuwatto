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

// 指パッチン判定(手ごと)。まず しっかり開いてから(armed) 閉じた瞬間に1回だけ発火。
const armed = [false, false];

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
  if (window.Coloring && Coloring.clearAim) Coloring.clearAim();
  armed[0] = armed[1] = false;
}

function isActive() { return running; }

// 動画フレーム座標(正規化) → 画面座標(object-fit: cover を再現)
// 前面カメラ(鏡映し)のときは X を反転して、画面で見た手の位置に合わせる。
function toScreen(nx, ny) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const sw = window.innerWidth, sh = window.innerHeight;
  const scale = Math.max(sw / vw, sh / vh);
  const dw = vw * scale, dh = vh * scale;
  const ox = (sw - dw) / 2, oy = (sh - dh) / 2;
  let x = nx * vw * scale + ox;
  const y = ny * vh * scale + oy;
  if (window.AR && AR.isMirrored && AR.isMirrored()) x = sw - x;
  return { x, y };
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

// 1本の手の特徴量(指先・親指と中指の距離・手の大きさ)を計算
function handFeatures(lm) {
  const idx = toScreen(lm[8].x, lm[8].y);    // 人差し指の先(=ねらい)
  const thumb = toScreen(lm[4].x, lm[4].y);  // 親指の先
  const mid = toScreen(lm[12].x, lm[12].y);  // 中指の先
  const wrist = toScreen(lm[0].x, lm[0].y);  // 手首
  const mcp = toScreen(lm[9].x, lm[9].y);    // 中指のつけね
  const hs = dist(wrist, mcp) || 1;          // 手の大きさ(基準)
  return {
    idx,
    hs,
    thumbMid: dist(thumb, mid),                 // 親指と中指の先の距離
    indexExtended: dist(idx, wrist) > hs * 1.2, // 人差し指を のばしている
  };
}

function handle(res) {
  const hands = (res && res.landmarks) || [];
  renderCursors(hands);
  if (window.AR && AR.setSteady) AR.setSteady(hands.length > 0); // 手があるあいだは止めて狙いやすく

  if (hands.length === 0) {
    if (window.Coloring && Coloring.clearAim) Coloring.clearAim();
    armed[0] = armed[1] = false;
    return;
  }

  for (let i = 0; i < hands.length && i < 2; i++) {
    const f = handFeatures(hands[i]);
    // 先頭の手の 指先の近くのパーツを ハイライト(選択は安定化済み)
    if (i === 0 && window.Coloring && Coloring.aimAt) Coloring.aimAt(f.idx.x, f.idx.y);

    // パッチン判定: ①しっかり開く(armed) → ②しっかり閉じた瞬間に1回だけ発火
    const openT = f.hs * 0.6;   // これより離れていたら「開いた」
    const closeT = f.hs * 0.28; // これより近づいたら「パッチン」
    if (f.thumbMid > openT) armed[i] = true;
    if (armed[i] && f.thumbMid < closeT && f.indexExtended) {
      armed[i] = false; // 再び開くまで次は発火しない
      if (window.Coloring && Coloring.snapPaint) Coloring.snapPaint();
    }
  }
  if (hands.length < 2) armed[1] = false;
}

function renderCursors(hands) {
  if (!cursorsEl) return;
  while (cursorsEl.children.length < hands.length) {
    const c = document.createElement("div");
    c.className = "hand-cursor";
    cursorsEl.appendChild(c);
  }
  for (let i = 0; i < cursorsEl.children.length; i++) {
    const el = cursorsEl.children[i];
    if (i >= hands.length) { el.style.display = "none"; continue; }
    const f = handFeatures(hands[i]);
    el.style.display = "block";
    el.style.transform = `translate(${f.idx.x}px, ${f.idx.y}px)`;
    el.classList.toggle("snap", f.thumbMid < f.hs * 0.28); // 閉じてる時 緑に
  }
}

window.Hands = { start, stop, isActive };
