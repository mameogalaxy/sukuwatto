/**
 * マジック いろチェンジ（AIなし）
 *
 * 写真の中のモノをタップすると、その点と「似た色」の範囲を選び、
 * 影や質感(明るさ)はそのままに、選んだ色へ置き換える。
 *   - 元画像 base は固定（選択の基準＆明るさの元）
 *   - 表示用 work を書き換える
 *   - しきい値スライダーで「選ぶ範囲の広さ」を調整
 *   - もどす（スナップショット方式）/ 保存
 * すべてブラウザ内の画像処理で完結（サーバー・モデル不要）。
 */
(function (global) {
  "use strict";

  const MAXDIM = 880; // 長辺の最大ピクセル（スマホでも軽快に）

  const canvas = document.getElementById("magic-canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const startPanel = document.getElementById("magic-start");
  const tools = document.getElementById("magic-tools");
  const hint = document.getElementById("magic-hint");
  const paletteEl = document.getElementById("magic-palette");
  const thrInput = document.getElementById("magic-threshold");

  let base = null; // Uint8ClampedArray（元画像コピー）
  let work = null; // ImageData（表示中）
  let W = 0, H = 0;
  let color = "#ff5d73";
  let undoStack = [];

  // ---- パレット ----
  function buildPalette() {
    paletteEl.innerHTML = "";
    global.NurieTemplates.palette.forEach((c) => {
      const sw = document.createElement("button");
      sw.className = "swatch";
      sw.style.background = c;
      sw.dataset.color = c;
      if (c === color) sw.classList.add("is-selected");
      sw.addEventListener("click", () => {
        color = c;
        paletteEl.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("is-selected", s === sw));
      });
      paletteEl.appendChild(sw);
    });
  }

  // ---- 写真の読み込み ----
  async function loadFile(file) {
    if (!file) return;
    let bmp;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
      bmp = await loadViaImg(file); // 古い端末向けフォールバック
    }
    const scale = Math.min(1, MAXDIM / Math.max(bmp.width, bmp.height));
    W = Math.max(1, Math.round(bmp.width * scale));
    H = Math.max(1, Math.round(bmp.height * scale));
    canvas.width = W;
    canvas.height = H;
    ctx.drawImage(bmp, 0, 0, W, H);
    const img = ctx.getImageData(0, 0, W, H);
    base = new Uint8ClampedArray(img.data);
    work = img;
    undoStack = [];

    startPanel.hidden = true;
    tools.hidden = false;
    hint.hidden = false;
    clearTimeout(hint._t);
    hint._t = setTimeout(() => { hint.hidden = true; }, 2600);
  }

  function loadViaImg(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }

  // ---- タップ → 色チェンジ ----
  function onTap(clientX, clientY) {
    if (!base) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) * (W / rect.width));
    const y = Math.floor((clientY - rect.top) * (H / rect.height));
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    recolorRegion(x, y);
  }

  function recolorRegion(sx, sy) {
    const thr = parseInt(thrInput.value, 10) || 42;
    const thr2 = thr * thr * 3; // RGB二乗距離のしきい値
    const i0 = (sy * W + sx) * 4;
    const tr = base[i0], tg = base[i0 + 1], tb = base[i0 + 2];
    const hs = hexToHs(color); // 選んだ色の色相・彩度

    pushUndo();

    const visited = new Uint8Array(W * H);
    const stack = [sy * W + sx];
    const data = work.data;
    let count = 0;

    while (stack.length) {
      const p = stack.pop();
      if (visited[p]) continue;
      visited[p] = 1;
      const i = p * 4;
      const dr = base[i] - tr, dg = base[i + 1] - tg, db = base[i + 2] - tb;
      if (dr * dr + dg * dg + db * db > thr2) continue;

      // 元の明るさを保ったまま 色相・彩度を差し替え（＝影はそのまま色だけ変わる）
      const r = base[i], g = base[i + 1], b = base[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const l = (mx + mn) / 510; // 0..1
      const rgb = hslToRgb(hs.h, hs.s, l);
      data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2];
      count++;

      const px = p % W, py = (p / W) | 0;
      if (px > 0) stack.push(p - 1);
      if (px < W - 1) stack.push(p + 1);
      if (py > 0) stack.push(p - W);
      if (py < H - 1) stack.push(p + W);
    }

    if (count === 0) { undoStack.pop(); return; } // 何も変わらなければ取り消し記録を破棄
    ctx.putImageData(work, 0, 0);
  }

  // ---- もどす ----
  function pushUndo() {
    undoStack.push(new Uint8ClampedArray(work.data));
    if (undoStack.length > 6) undoStack.shift();
  }
  function undo() {
    const prev = undoStack.pop();
    if (!prev) return;
    work.data.set(prev);
    ctx.putImageData(work, 0, 0);
  }

  function newPhoto() {
    base = null; work = null; undoStack = [];
    canvas.width = 0; canvas.height = 0;
    tools.hidden = true;
    startPanel.hidden = false;
  }

  function save() {
    if (!canvas.width) return null;
    return canvas.toDataURL("image/png");
  }

  // ---- 色変換ヘルパ ----
  function hexToHs(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const n = parseInt(hex, 16);
    let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h, s };
  }
  function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // ---- DOM 配線 ----
  function wire() {
    buildPalette();
    canvas.addEventListener("click", (e) => onTap(e.clientX, e.clientY));
    const cam = document.getElementById("magic-cam");
    const file = document.getElementById("magic-file");
    if (cam) cam.addEventListener("change", (e) => loadFile(e.target.files[0]));
    if (file) file.addEventListener("change", (e) => loadFile(e.target.files[0]));
    const undoBtn = document.getElementById("magic-undo");
    if (undoBtn) undoBtn.addEventListener("click", undo);
    const newBtn = document.getElementById("magic-new");
    if (newBtn) newBtn.addEventListener("click", newPhoto);
    const saveBtn = document.getElementById("magic-save");
    if (saveBtn) saveBtn.addEventListener("click", () => {
      const url = save();
      if (url && global.showShot) global.showShot(url);
    });
  }

  global.Magic = { wire, newPhoto };
})(window);
