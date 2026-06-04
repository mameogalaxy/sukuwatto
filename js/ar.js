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
  let facing = "environment"; // "environment"=背面 / "user"=前面(手モード)
  let mirrored = false;       // 前面カメラは鏡映しにする

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
    facing = "user"; applyMirror(); // 最初から前面(インカメ)＋鏡映し

    await startCamera();

    // カメラの許可が済んだあとに、権限不要な端末でだけ傾きを有効化
    enableOrientationAuto();
    loop();
  }

  function reasonText(err) {
    const n = (err && err.name) ? err.name : "Error";
    const map = {
      NotAllowedError: "カメラの きょかが ありません",
      NotFoundError: "カメラが みつかりません",
      NotReadableError: "カメラが ほかで つかわれています",
      OverconstrainedError: "カメラの せっていに しっぱい",
      SecurityError: "セキュリティの せいげん",
      AbortError: "カメラの きどうが ちゅうだんされました",
    };
    return (map[n] || "カメラを つかえませんでした") + "（" + n + "）";
  }

  function showFallback(msg) {
    const el = document.getElementById("ar-fallback-msg");
    if (el && msg) el.textContent = msg;
    fallback.hidden = false;
  }

  function applyMirror() {
    mirrored = (facing === "user");
    video.classList.toggle("mirror", mirrored);
  }
  function isMirrored() { return mirrored; }

  // 手モード=前面カメラ＋鏡映し / 通常=背面 に切り替え
  async function setFacing(f) {
    if (f === facing && stream) return true;
    facing = f;
    applyMirror();
    return startCamera();
  }

  // カメラ取得(失敗理由を画面に出す。希望の向き → 何でも の順に試す)
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showFallback("この ブラウザは カメラに たいおうしていません");
      return false;
    }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }

    const tries = [
      { video: { facingMode: { ideal: facing } }, audio: false },
      { video: true, audio: false },
    ];
    let lastErr = null;
    for (const c of tries) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        video.srcObject = stream;
        await video.play().catch(() => {});
        applyMirror();
        fallback.hidden = true;
        return true;
      } catch (e) {
        lastErr = e;
        if (e && e.name === "NotAllowedError") break; // 拒否なら再試行しない
      }
    }
    console.warn("camera unavailable:", lastErr);
    showFallback(reasonText(lastErr));
    return false;
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

  function orientationHandler(e) {
    if (e.gamma != null) tilt.x = Math.max(-1, Math.min(1, e.gamma / 45));
    if (e.beta != null) tilt.y = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
  }

  /**
   * 傾きセンサー(おまけのパララックス)を有効化。
   *
   * 重要: iOS は「1回のユーザー操作につき許可ダイアログは1つ」までしか出せない。
   * ここでカメラと同じタップ内に DeviceOrientationEvent.requestPermission() を呼ぶと、
   * カメラの getUserMedia がはじかれてしまう。よってカメラを最優先にし、
   * 権限が不要な端末(Android など)でだけ自動で有効化する。
   * (iOS でも、ユーザーが「ゆらす」ボタンを押したときだけ別途要求する)
   */
  function enableOrientationAuto() {
    if (orientationOn) return;
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      return; // iOS: ここでは要求しない(カメラ優先)
    }
    window.addEventListener("deviceorientation", orientationHandler);
    orientationOn = true;
  }

  /** iOS 用: ユーザー操作から明示的に傾き許可を求める */
  function requestOrientation() {
    if (orientationOn) return Promise.resolve(false);
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      return DeviceOrientationEvent.requestPermission()
        .then((s) => {
          if (s === "granted") {
            window.addEventListener("deviceorientation", orientationHandler);
            orientationOn = true;
            return true;
          }
          return false;
        })
        .catch(() => false);
    }
    enableOrientationAuto();
    return Promise.resolve(orientationOn);
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
        const d = dist(a, b), an = ang(a, b);
        // 位置は動かさない(ずれない)。大きさと向きだけ調整。
        state.scale = Math.max(0.25, Math.min(4, g.scale * (d / g.d)));
        state.rot = g.rot + (an - g.a) * 180 / Math.PI;
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
  // 手でつまんで動かす用
  function moveBy(dx, dy) { state.x += dx; state.y += dy; applyTransform(); }
  // 指先が キャラの上に乗っているか(画面座標)
  function isOverArt(x, y) {
    const r = art.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

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
      if (mirrored) { ctx.save(); ctx.translate(vw, 0); ctx.scale(-1, 1); drawCover(ctx, video, vw, vh); ctx.restore(); }
      else drawCover(ctx, video, vw, vh);
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

  // フォールバックの「もう一度カメラ」ボタン(ユーザー操作からの再試行)
  const retryBtn = document.getElementById("btn-retry-cam");
  if (retryBtn) retryBtn.addEventListener("click", () => startCamera());

  global.AR = { start, stop, startCamera, setFacing, isMirrored, requestOrientation, suppressTap, rotate, reset, moveBy, setSteady, isOverArt, capture };
  bindGestures();
})(window);
