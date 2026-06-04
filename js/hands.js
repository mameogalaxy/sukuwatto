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
let hcanvas = null, hctx = null;
let lastTs = -1;

// 指パッチン判定(手ごと)。まず しっかり開いてから(armed) 閉じた瞬間に1回だけ発火。
const armed = [false, false];
// パッチン成立の瞬間だけ 緑にフラッシュ(青→緑→青)。緑にする期限の時刻。
const flashUntil = [0, 0];
const FLASH_MS = 280;

// 手の骨格(関節のつなぎ方)
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],          // おやゆび
  [0,5],[5,6],[6,7],[7,8],          // ひとさしゆび
  [5,9],[9,10],[10,11],[11,12],     // なかゆび
  [9,13],[13,14],[14,15],[15,16],   // くすりゆび
  [13,17],[17,18],[18,19],[19,20],  // こゆび
  [0,17],                           // てのひら
];

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
  hcanvas = document.getElementById("hand-canvas");
  hctx = hcanvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  running = true;
  loop();
}

function resizeCanvas() {
  if (!hcanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  hcanvas.width = window.innerWidth * dpr;
  hcanvas.height = window.innerHeight * dpr;
  hcanvas.style.width = window.innerWidth + "px";
  hcanvas.style.height = window.innerHeight + "px";
  hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function stop() {
  running = false;
  if (hctx) hctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (window.AR && AR.setSteady) AR.setSteady(false);
  if (window.Coloring && Coloring.clearAim) Coloring.clearAim();
  armed[0] = armed[1] = false;
  flashUntil[0] = flashUntil[1] = 0;
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
  if (window.AR && AR.setSteady) AR.setSteady(hands.length > 0); // 手があるあいだは止めて狙いやすく

  for (let i = 0; i < hands.length && i < 2; i++) {
    const f = handFeatures(hands[i]);
    // 選択は「タップ」で行うので、手では選ばない(パッチンの発火だけ担当)

    // パッチン判定: ①しっかり開く(armed) → ②しっかり閉じた瞬間に1回だけ発火
    const openT = f.hs * 0.6;   // これより離れていたら「開いた」
    const closeT = f.hs * 0.28; // これより近づいたら「パッチン」
    if (f.thumbMid > openT) armed[i] = true;
    if (armed[i] && f.thumbMid < closeT && f.indexExtended) {
      armed[i] = false; // 再び開くまで次は発火しない
      flashUntil[i] = performance.now() + FLASH_MS; // ★成立の瞬間だけ緑に
      if (window.Coloring && Coloring.snapPaint) Coloring.snapPaint();
    }
  }
  if (hands.length < 2) armed[1] = false;

  drawHands(hands);
}

// 手の骨格(ハンドトラッキング)を描く。カメラ映像は出さず、手だけ見える。
function drawHands(hands) {
  if (!hctx) return;
  const w = window.innerWidth, h = window.innerHeight;
  hctx.clearRect(0, 0, w, h);
  const now = performance.now();

  for (let i = 0; i < hands.length && i < 2; i++) {
    const pts = hands[i].map((p) => toScreen(p.x, p.y));
    const flashing = now < flashUntil[i];
    const accent = flashing ? "#7bd66b" : "#3b6dff"; // パッチンの瞬間だけ緑(青→緑→青)

    // 線(骨)
    hctx.lineCap = "round";
    hctx.lineWidth = 5;
    hctx.strokeStyle = "rgba(255,255,255,0.9)";
    hctx.shadowColor = accent;
    hctx.shadowBlur = 14;
    HAND_CONNECTIONS.forEach(([a, b]) => {
      hctx.beginPath();
      hctx.moveTo(pts[a].x, pts[a].y);
      hctx.lineTo(pts[b].x, pts[b].y);
      hctx.stroke();
    });

    // 関節(点)
    hctx.shadowBlur = 8;
    for (let k = 0; k < pts.length; k++) {
      const tip = (k === 4 || k === 8 || k === 12 || k === 16 || k === 20);
      hctx.fillStyle = tip ? accent : "#ffffff";
      hctx.beginPath();
      hctx.arc(pts[k].x, pts[k].y, tip ? 7 : 5, 0, Math.PI * 2);
      hctx.fill();
    }

    // 人差し指の先を 大きく強調(ねらい)。パッチンの瞬間はポンッと大きく光る。
    hctx.shadowBlur = flashing ? 30 : 18;
    hctx.fillStyle = accent;
    hctx.beginPath();
    hctx.arc(pts[8].x, pts[8].y, flashing ? 19 : 12, 0, Math.PI * 2);
    hctx.fill();
  }
  hctx.shadowBlur = 0;
}

window.Hands = { start, stop, isActive };
