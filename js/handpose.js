// 手話ミラー - AR手検出
//
// MediaPipe Hands（CDNで読み込み、グローバルに Hands / Camera が入る）を使って
// Webカメラから手の21関節を検出し、各指が「立っているか」を判定する。
// 検出した指の状態ベクトル [親指,人さし指,中指,薬指,小指] を、見本の手形と照合する。
//
// ※完全な手話認識ではなく「手形（どの指を立てているか）と動きの有無」を
//   リアルタイムに採点する、練習を助けるためのAR機能。

import { FINGER_NAMES } from './data.js';

// MediaPipe の landmark インデックス
const TIPS = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const PIPS = { thumb: 2, index: 6, middle: 10, ring: 14, pinky: 18 };
const WRIST = 0;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

// 1つの手のlandmarkから [親指,人さし指,中指,薬指,小指] の0/1ベクトルを作る。
// 指先が手首から十分離れていれば「立っている(1)」と判定（向きに強い）。
export function fingerStateFromLandmarks(lm) {
  const wrist = lm[WRIST];
  const state = [];
  for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
    const tip = lm[TIPS[f]];
    const pip = lm[PIPS[f]];
    const tipD = dist(tip, wrist);
    const pipD = dist(pip, wrist);
    // 指先が第2関節より手首から遠ければ伸びている。親指は基準を少しゆるめる。
    const ratio = f === 'thumb' ? 1.0 : 1.05;
    state.push(tipD > pipD * ratio ? 1 : 0);
  }
  return state;
}

// 検出ベクトルと見本handshapeを比較し、一致度(0-1)と指ごとのヒントを返す。
export function matchHandshape(detected, target) {
  let checked = 0, hit = 0;
  const hints = [];
  target.forEach((want, i) => {
    if (want === null) return; // 判定しない指
    checked++;
    if (detected[i] === want) {
      hit++;
    } else {
      hints.push(`${FINGER_NAMES[i]}を${want ? '立てて' : '曲げて'}`);
    }
  });
  const score = checked === 0 ? 0 : hit / checked;
  return { score, hints };
}

// カメラと手検出を管理するクラス
export class HandTracker {
  constructor() {
    this.hands = null;
    this.camera = null;
    this.running = false;
    this.onFrame = null;     // ({ fingerState, landmarks }) を毎フレーム呼ぶ
    this._lastWrist = null;
    this._motion = 0;        // 直近の手の移動量（動きの検出に使う）
  }

  static isSupported() {
    return typeof window.Hands !== 'undefined' &&
           typeof window.Camera !== 'undefined' &&
           !!navigator.mediaDevices?.getUserMedia;
  }

  async start(videoEl, canvasEl, onFrame) {
    if (!HandTracker.isSupported()) {
      throw new Error('カメラまたは手検出ライブラリが利用できません。');
    }
    this.onFrame = onFrame;
    const ctx = canvasEl.getContext('2d');

    this.hands = new window.Hands({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    this.hands.onResults(results => {
      canvasEl.width = videoEl.videoWidth || 640;
      canvasEl.height = videoEl.videoHeight || 480;
      ctx.save();
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

      const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
      if (hasHand) {
        const lm = results.multiHandLandmarks[0];
        // 骨格を描画
        if (window.drawConnectors && window.HAND_CONNECTIONS) {
          window.drawConnectors(ctx, lm, window.HAND_CONNECTIONS,
            { color: '#22b8cf', lineWidth: 3 });
          window.drawLandmarks(ctx, lm, { color: '#ffffff', radius: 3 });
        }
        // 動き量を更新
        const w = lm[WRIST];
        if (this._lastWrist) {
          const d = dist(w, this._lastWrist);
          this._motion = this._motion * 0.7 + d * 0.3;
        }
        this._lastWrist = { x: w.x, y: w.y, z: w.z };

        const fingerState = fingerStateFromLandmarks(lm);
        this.onFrame?.({ fingerState, landmarks: lm, motion: this._motion, hasHand: true });
      } else {
        this._lastWrist = null;
        this.onFrame?.({ fingerState: null, landmarks: null, motion: 0, hasHand: false });
      }
      ctx.restore();
    });

    this.camera = new window.Camera(videoEl, {
      onFrame: async () => { if (this.running) await this.hands.send({ image: videoEl }); },
      width: 640,
      height: 480,
    });
    this.running = true;
    await this.camera.start();
  }

  stop() {
    this.running = false;
    try { this.camera?.stop(); } catch {}
    try {
      const stream = this.camera?.video?.srcObject;
      stream?.getTracks?.().forEach(t => t.stop());
    } catch {}
    this.hands = null;
    this.camera = null;
  }
}
