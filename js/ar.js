/**
 * AR ぬりえ機能
 *
 * カメラ映像を背景に、塗れるキャラクター(SVG)を空間に浮かべ、
 * 指でその場で色を塗れるようにする「ライブぬりえ」方式。
 *
 *  - 背面カメラを <video> に流して背景に(CSS object-fit: cover)
 *  - キャラは DOM の SVG。タップ=その領域をぬる(coloring.js が担当)
 *  - 2本指で 移動 / 拡大縮小 / 回転
 *  - 端末の傾き(DeviceOrientation)で少しゆれ、ふわふわ浮かせて空間感を出す
 *  - シャッターで カメラ映像 + 現在のキャラを合成して PNG 保存 / シェア
 */
(function (global) {
  "use strict";

  const video = document.getElementById("ar-video");
  const fallback = document.getElementById("ar-fallback");
  const scene = document.getElementById("ar-scene");
  const art = document.getElementById("ar-art"); // 位置・拡大・回転を JS で当てる入れ物
  const float = document.getElementById("ar-float"); // ふわふわ(CSS)
  const stage = document.getElementById("svg-stage"); // SVG 本体

  let stream = null;
  let rafId = null;
  let running = false;
  let orientationOn = false;
  let lastMultiTouch = 0; // 直近の2本指操作の時刻(タップ誤爆ガード用)

  const tilt = { x: 0, y: 0 };
  const state = { x: 0, y: 0, scale: 1, rot: 0, base: 0 };

  function computeBase() {
    return Math.min(window.innerWidth, window.innerHeight) * 0.72;
  }

  async function start() {
    state.x = 0; state.y = 0; state.scale = 1; state.rot = 0;
    state.base = computeBase();
    applyTransform();
    running = true;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      fallback.hidden = true;
    } catch (err) {
      // カメラ不可(PC やキョカなし)でも、塗って保存はできるようにする
      console.warn("camera unavailable:", err);
      fallback.hidden = false;
    }

    loop();
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.srcObject = null;
  }

  /**
   * 端末の傾きセンサーを有効化。
   * iOS 13+ は requestPermission() を「タップ直後に同期的に」呼ぶ必要があるため、
   * await を挟む start() とは分け、click ハンドラから直接呼べるようにしている。
   */
  function enableOrientation() {
    if (orientationOn) return;
    const handler = (e) => {
      if (e.gamma != null) tilt.x = Math.max(-1, Math.min(1, e.gamma / 45));
      if (e.beta != null) tilt.y = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
    };
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission()
        .then((s) => { if (s === "granted") { window.addEventListener("deviceorientation", handler); orientationOn = true; } })
        .catch(() => {});
    } else {
      window.addEventListener("deviceorientation", handler);
      orientationOn = true;
    }
  }

  function applyTransform() {
    const px = tilt.x * 22;
    const py = tilt.y * 16;
    art.style.width = state.base + "px";
    art.style.height = state.base + "px";
    art.style.transform =
      `translate(-50%, -50%) translate(${state.x + px}px, ${state.y + py}px) ` +
      `scale(${state.scale}) rotate(${state.rot}deg)`;
  }

  function loop() {
    if (!running) return;
    applyTransform(); // 傾きを毎フレーム反映
    rafId = requestAnimationFrame(loop);
  }

  // ---- 2本指ジェスチャ(移動・拡大縮小・回転) ----
  let g = null;
  function dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  function mid(a, b) { return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }; }
  function ang(a, b) { return Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX); }

  function bindGestures() {
    scene.addEventListener("touchstart", (e) => {
      setSteady(true); // 触っている間はふわふわを止めて塗りやすく
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        g = { m: mid(a, b), d: dist(a, b), a: ang(a, b), scale: state.scale, rot: state.rot };
        lastMultiTouch = Date.now();
      }
    }, { passive: false });

    scene.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && g) {
        e.preventDefault();
        const [a, b] = e.touches;
        const m = mid(a, b), d = dist(a, b), an = ang(a, b);
        state.x += m.x - g.m.x;
        state.y += m.y - g.m.y;
        state.scale = Math.max(0.25, Math.min(4, g.scale * (d / g.d)));
        state.rot = g.rot + (an - g.a) * 180 / Math.PI;
        g.m = m;
        lastMultiTouch = Date.now();
        applyTransform();
      }
    }, { passive: false });

    const onEnd = (e) => {
      if (!e.touches || e.touches.length < 2) g = null;
      if (!e.touches || e.touches.length === 0) setSteady(false);
      if (Date.now() - lastMultiTouch < 400) lastMultiTouch = Date.now();
    };
    scene.addEventListener("touchend", onEnd);
    scene.addEventListener("touchcancel", onEnd);

    // PC: ホイールで拡大縮小
    scene.addEventListener("wheel", (e) => {
      e.preventDefault();
      state.scale = Math.max(0.25, Math.min(4, state.scale * (e.deltaY < 0 ? 1.08 : 0.92)));
      applyTransform();
    }, { passive: false });
  }

  function setSteady(on) { float.classList.toggle("steady", on); }

  // 直近に2本指操作していたら、その指離しで起きる click(=塗り)を無視させる
  function suppressTap() { return Date.now() - lastMultiTouch < 350; }

  function rotate() { state.rot = (state.rot + 15) % 360; applyTransform(); }
  function reset() { state.x = 0; state.y = 0; state.scale = 1; state.rot = 0; applyTransform(); }

  function drawCover(ctx, src, w, h) {
    const sw = src.videoWidth || src.width;
    const sh = src.videoHeight || src.height;
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale, dh = sh * scale;
    ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  /**
   * いまの画面(カメラ + 現在のキャラ)を合成して PNG dataURL を返す(Promise)。
   */
  async function capture() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cv = document.createElement("canvas");
    cv.width = vw * dpr; cv.height = vh * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);

    if (video.readyState >= 2 && video.videoWidth) {
      drawCover(ctx, video, vw, vh);
    } else {
      const grd = ctx.createLinearGradient(0, 0, 0, vh);
      grd.addColorStop(0, "#2a1a5e");
      grd.addColorStop(1, "#1b1140");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, vw, vh);
    }

    const artCanvas = await Coloring.renderToCanvas(1024);
    const px = tilt.x * 22, py = tilt.y * 16;
    const cx = vw / 2 + state.x + px;
    const cy = vh / 2 + state.y + py;
    const size = state.base * state.scale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.rot * Math.PI / 180);
    ctx.drawImage(artCanvas, -size / 2, -size / 2, size, size);
    ctx.restore();

    return cv.toDataURL("image/png");
  }

  window.addEventListener("resize", () => {
    if (running) { state.base = computeBase(); applyTransform(); }
  });

  global.AR = { start, stop, enableOrientation, suppressTap, rotate, reset, capture };
  bindGestures();
})(window);
