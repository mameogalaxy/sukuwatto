/**
 * キラキラ エフェクト
 *
 * 塗ったときに、その場所から星と粒がはじけて飛ぶ。
 * カメラ映像とキャラの上(UIの下)に重ねる専用キャンバスに描く。
 * 粒が無いときは描画ループを止めて省電力。
 */
(function (global) {
  "use strict";

  const canvas = document.getElementById("fx-canvas");
  if (!canvas) { global.FX = { burst() {}, celebrate() {}, clear() {} }; return; }
  const ctx = canvas.getContext("2d");

  let particles = [];
  let rafId = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  function spawn(x, y, color, opts) {
    const o = opts || {};
    const count = o.count || 14;
    const power = o.power || 1;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1 + Math.random() * 4) * power;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.5 * power,
        life: 1,
        decay: 0.010 + Math.random() * 0.018,
        size: (3 + Math.random() * 4) * (o.big ? 1.6 : 1),
        color: Math.random() < 0.5 ? color : "#ffffff",
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        star: Math.random() < 0.65,
      });
    }
    if (particles.length > 600) particles.splice(0, particles.length - 600);
    if (!rafId) loop();
  }

  // 塗ったときの小さなはじけ
  function burst(x, y, color) {
    spawn(x, y, color, { count: 16, power: 1 });
  }

  // 手でなぞったとき: ふわっと色がにじむ(やわらかい光の粒)
  function soak(x, y, color) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.3 + Math.random() * 1.2;
      particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.6,
        life: 1,
        decay: 0.018 + Math.random() * 0.02,
        size: 6 + Math.random() * 8,
        color: Math.random() < 0.4 ? "#ffffff" : color,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.15,
        star: false,
      });
    }
    if (!rafId) loop();
  }

  // 完成したときの お祝い(キャラの周りに大きく)
  function celebrate(cx, cy, radius) {
    const r = radius || 140;
    for (let k = 0; k < 5; k++) {
      const hue = ["#ffd23f", "#ff8f4c", "#ff8fcf", "#5aa9ff", "#7bd66b"][k % 5];
      setTimeout(() => {
        const a = Math.random() * Math.PI * 2;
        spawn(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4, hue, { count: 22, power: 1.6, big: true });
      }, k * 110);
    }
  }

  function drawStar(r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function loop() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.vx *= 0.985;
      p.life -= p.decay; p.rot += p.vr;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      if (p.star) drawStar(p.size);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (particles.length) rafId = requestAnimationFrame(loop);
    else { rafId = null; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
  }

  function clear() {
    particles = [];
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  global.FX = { burst, celebrate, clear };
})(window);
