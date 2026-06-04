/**
 * AR（カメラオーバーレイ）機能
 *
 * 本格的な WebXR は端末依存が大きいため、ここでは「カメラ映像を背景に、
 * 塗ったキャラクターを空間に浮かべる」ビルボード方式で広い端末で動くようにする。
 *
 *  - 背面カメラを <video> に流す
 *  - 塗り絵を PNG にして、ドラッグ移動 / 2本指ピンチで拡大縮小 / 回転
 *  - 端末の傾き(DeviceOrientation)に応じて少し動かし、空間に置いた感を出す
 *  - シャッターで video + キャラを合成して PNG 保存 / シェア
 */
(function (global) {
  "use strict";

  const video = document.getElementById("ar-video");
  const canvas = document.getElementById("ar-canvas");
  const ctx = canvas.getContext("2d");
  const fallback = document.getElementById("ar-fallback");

  let stream = null;
  let rafId = null;
  let sprite = null; // {img, x, y, scale, rot, baseScale}
  let tilt = { x: 0, y: 0 };
  let bob = 0;
  let running = false;

  // ---- ジェスチャ状態 ----
  const gesture = { dragging: false, lastX: 0, lastY: 0, pinchDist: 0, pinchScale: 1 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  async function start(spriteImg) {
    resize();
    sprite = {
      img: spriteImg,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      scale: 1,
      rot: 0,
      baseScale: Math.min(window.innerWidth, window.innerHeight) / spriteImg.width * 0.7,
    };
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
      // カメラ不可（PC やキョカなし）でもオーバーレイは触れるようにする
      console.warn("camera unavailable:", err);
      fallback.hidden = false;
    }

    enableOrientation();
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

  function enableOrientation() {
    const handler = (e) => {
      // gamma:左右(-90..90) beta:前後  少しだけ反映
      if (e.gamma != null) tilt.x = Math.max(-1, Math.min(1, e.gamma / 45));
      if (e.beta != null) tilt.y = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
    };
    // iOS 13+ は許可が必要。タップ時の start() 内なのでここで要求してよい。
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission()
        .then((s) => { if (s === "granted") window.addEventListener("deviceorientation", handler); })
        .catch(() => {});
    } else {
      window.addEventListener("deviceorientation", handler);
    }
  }

  function loop() {
    if (!running) return;
    bob += 0.04;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // 背景：カメラ映像を cover で描画
    if (video.readyState >= 2 && video.videoWidth) {
      drawCover(video, w, h);
    }

    if (!sprite) return;
    const s = sprite.baseScale * sprite.scale;
    const drawW = sprite.img.width * s;
    const drawH = sprite.img.height * s;

    // 傾きパララックス + ふわふわ
    const px = tilt.x * 26;
    const py = tilt.y * 18 + Math.sin(bob) * 8;

    ctx.save();
    ctx.translate(sprite.x + px, sprite.y + py);
    ctx.rotate((sprite.rot * Math.PI) / 180);
    // 接地っぽい影
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.scale(1, 0.25);
    ctx.beginPath();
    ctx.ellipse(0, drawH * 1.7, drawW * 0.32, drawH * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
    ctx.drawImage(sprite.img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  function drawCover(src, w, h) {
    const sw = src.videoWidth || src.width;
    const sh = src.videoHeight || src.height;
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  // ---- 操作 ----
  function bindGestures() {
    const el = canvas;

    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      gesture.dragging = true;
      gesture.lastX = e.clientX;
      gesture.lastY = e.clientY;
    });
    el.addEventListener("pointermove", (e) => {
      if (!gesture.dragging || !sprite) return;
      sprite.x += e.clientX - gesture.lastX;
      sprite.y += e.clientY - gesture.lastY;
      gesture.lastX = e.clientX;
      gesture.lastY = e.clientY;
    });
    const end = (e) => {
      gesture.dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);

    // ピンチ拡大縮小（touch）
    el.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && sprite) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        if (gesture.pinchDist) {
          sprite.scale *= d / gesture.pinchDist;
          sprite.scale = Math.max(0.2, Math.min(4, sprite.scale));
        }
        gesture.pinchDist = d;
        gesture.dragging = false; // ピンチ中はドラッグしない
      }
    }, { passive: false });
    el.addEventListener("touchend", () => { gesture.pinchDist = 0; });

    // PC: ホイールで拡大縮小
    el.addEventListener("wheel", (e) => {
      if (!sprite) return;
      e.preventDefault();
      sprite.scale *= e.deltaY < 0 ? 1.08 : 0.92;
      sprite.scale = Math.max(0.2, Math.min(4, sprite.scale));
    }, { passive: false });
  }

  function dist(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function rotate() { if (sprite) sprite.rot = (sprite.rot + 15) % 360; }
  function reset() {
    if (!sprite) return;
    sprite.x = window.innerWidth / 2;
    sprite.y = window.innerHeight / 2;
    sprite.scale = 1;
    sprite.rot = 0;
  }

  // 現在の画面（カメラ+キャラ）を PNG dataURL で返す
  function capture() {
    return canvas.toDataURL("image/png");
  }

  window.addEventListener("resize", () => { if (running) resize(); });

  global.AR = { start, stop, bindGestures, rotate, reset, capture };
  bindGestures();
})(window);
