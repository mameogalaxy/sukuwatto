/**
 * ぬりえ機能
 *
 * SVG の region をタップすると、いま選んでいる色で塗る。
 * - fill ツール: 選択色で塗る
 * - erase ツール: 白(#ffffff)に戻す
 * 履歴を持っていて「もどす」で1手ずつ取り消せる。
 */
(function (global) {
  "use strict";

  const stage = document.getElementById("svg-stage");
  const paletteEl = document.getElementById("palette");

  const state = {
    template: null,
    color: "#ff5d73",
    tool: "fill", // "fill" | "erase"
    history: [], // {region, from, to}
    painted: new Set(), // ユーザーが塗った領域(完成判定用)
    total: 0, // 塗れる領域の数
    completed: false,
    aimRegion: null, // 指パッチン: いま選択中(光っている)パーツ
  };

  // ---- なぞり塗り(長押し＆ドラッグ)の状態 ----
  const pointers = new Set();
  let painting = false;
  let lockRegion = null; // 指: 1ストロークで塗る領域を固定(はみ出し防止)
  let handLock = null;   // 手: いま塗っている領域
  let handOff = 0;       // 手が領域から外れたフレーム数
  let aimCand = null;    // 指パッチン: 選択切替の候補
  let aimCnt = 0;        // 候補が続いたフレーム数(安定化)

  // ---- パレット生成 ----
  function buildPalette() {
    paletteEl.innerHTML = "";
    const selectSwatch = (sw, value) => {
      state.color = value;
      setTool("fill"); // 色を選んだら自動で「ぬる」モードに
      paletteEl.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("is-selected", s === sw));
    };

    global.NurieTemplates.palette.forEach((c, i) => {
      const sw = document.createElement("button");
      sw.className = "swatch";
      sw.style.background = c;
      sw.dataset.color = c;
      sw.setAttribute("role", "option");
      sw.setAttribute("aria-label", "いろ " + (i + 1));
      if (c === state.color) sw.classList.add("is-selected");
      sw.addEventListener("click", () => selectSwatch(sw, c));
      paletteEl.appendChild(sw);
    });

    // 🌈 にじいろブラシ(塗るたびに色がかわる魔法の筆)
    const rainbow = document.createElement("button");
    rainbow.className = "swatch swatch-rainbow";
    rainbow.dataset.color = "rainbow";
    rainbow.setAttribute("role", "option");
    rainbow.setAttribute("aria-label", "にじいろ");
    rainbow.addEventListener("click", () => selectSwatch(rainbow, "rainbow"));
    paletteEl.appendChild(rainbow);
  }

  // いま塗る色を決める(にじいろ ならランダムな鮮やか色)
  function resolveColor() {
    if (state.tool === "erase") return "#ffffff";
    if (state.color === "rainbow") return "hsl(" + Math.floor(Math.random() * 360) + ", 85%, 62%)";
    return state.color;
  }

  // ---- テンプレート読み込み ----
  function loadTemplate(tpl) {
    state.template = tpl;
    state.history = [];
    state.painted = new Set();
    state.completed = false;
    stage.innerHTML = tpl.svg;
    const svg = stage.querySelector("svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const regions = svg.querySelectorAll(".region");
    regions.forEach((region) => region.classList.add("colorable"));
    state.total = regions.length;

    bindPainting();
    lockRegion = null; handLock = null; handOff = 0; state.aimRegion = null;
    if (global.FX) global.FX.clear();
    updateUndoState();
  }

  // 指でなぞって塗る。1本指=ぬる / 2本指=AR操作(ar.js)なので塗らない。
  // ★ はみ出し防止: 1ストロークでは「最初に触れた領域」だけを塗る。
  function bindPainting() {
    stage.onpointerdown = (e) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) { painting = false; return; }
      painting = true;
      lockRegion = null; // 新しいストローク開始
      strokePaint(e.clientX, e.clientY);
    };
    stage.onpointermove = (e) => {
      if (!painting || pointers.size > 1) return;
      strokePaint(e.clientX, e.clientY);
    };
  }
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) { painting = false; lockRegion = null; }
  }
  window.addEventListener("pointerup", endPointer);
  window.addEventListener("pointercancel", endPointer);

  function regionAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return (el && el.classList && el.classList.contains("colorable")) ? el : null;
  }

  // 指: 1ストローク = 最初に触れた領域のみ塗る（ずれても隣に飛び火しない）
  function strokePaint(x, y) {
    const el = regionAt(x, y);
    if (!el) return;
    if (lockRegion === null) {
      lockRegion = el;
      applyColor(el, x, y);
    }
    // lockRegion と同じ/別 いずれも、ここでは追加で塗らない
  }

  // 手(指先)で塗る: 最初に触れたパーツにロック。手をキャラから外すと解除。
  function handPaint(x, y) {
    const el = regionAt(x, y);
    if (el) {
      handOff = 0;
      if (handLock === null) {
        handLock = el;
        applyColor(el, x, y, true);
      }
      // 別領域に ずれても 塗らない（はみ出し防止）
    } else if (++handOff > 4) {
      handLock = null; // キャラから手が外れたら 次の領域を塗れる
    }
  }

  // ---- 指パッチン方式: 指先の近くのパーツを「選択(光らせる)」→ パッチンで塗る ----
  function nearestRegion(x, y) {
    if (!stage.querySelector("svg")) return null;
    let best = null, bestD = Infinity;
    stage.querySelectorAll(".colorable").forEach((r) => {
      const b = r.getBoundingClientRect();
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bestD) { bestD = d; best = r; }
    });
    return best;
  }

  function setHighlight(r) {
    if (r === state.aimRegion) return;
    if (state.aimRegion) state.aimRegion.classList.remove("aim");
    state.aimRegion = r;
    if (r) r.classList.add("aim");
  }

  // 選択は「一度ついたら塗るまで固定」。未選択のときだけ、安定した最寄りを選ぶ。
  function aimAt(x, y) {
    if (state.aimRegion) return state.aimRegion; // ロック中は動かさない(他は選べない)
    const r = nearestRegion(x, y);
    if (r === aimCand) {
      if (++aimCnt >= 3) { setHighlight(r); aimCand = null; aimCnt = 0; }
    } else {
      aimCand = r; aimCnt = 1;
    }
    return state.aimRegion;
  }

  function clearAim() {
    setHighlight(null);
    aimCand = null; aimCnt = 0;
  }

  // パッチン！ 選択中のパーツを 魔法みたいに塗る → 塗ったら選択解除(次を選べる)
  function snapPaint() {
    const r = state.aimRegion;
    if (!r) return;
    const b = r.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    applyColor(r, cx, cy, true);
    if (global.FX) global.FX.magic(cx, cy, resolveColor());
    setHighlight(null); // 固定を解除 → つぎのパーツを えらべる
    aimCand = null; aimCnt = 0;
  }

  function applyColor(region, px, py, soft) {
    const target = resolveColor();
    const from = region.getAttribute("fill") || "#ffffff";
    if (from.toLowerCase() === target.toLowerCase()) return;
    // じわっと染み込む（消すときは すぐ）
    if (state.tool === "erase") region.classList.remove("soak");
    else region.classList.add("soak");
    region.setAttribute("fill", target);
    // ぷにっと反応（クラスを付け直してアニメを再生）
    region.classList.remove("just-painted");
    void region.getBoundingClientRect(); // reflow を強制
    region.classList.add("just-painted");
    state.history.push({ region, from, to: target });

    // 塗った場所から エフェクト（手はやわらかく、指タップははじける）
    if (state.tool !== "erase" && global.FX) {
      const r = region.getBoundingClientRect();
      const sx = px != null ? px : r.left + r.width / 2;
      const sy = py != null ? py : r.top + r.height / 2;
      if (soft) global.FX.soak(sx, sy, target);
      else global.FX.burst(sx, sy, target);
    }

    // 完成判定
    if (state.tool === "erase") state.painted.delete(region);
    else state.painted.add(region);
    checkComplete();

    updateUndoState();
  }

  function checkComplete() {
    if (state.completed) {
      if (state.painted.size < state.total) state.completed = false; // 消したら解除
      return;
    }
    if (state.total > 0 && state.painted.size >= state.total) {
      state.completed = true;
      document.dispatchEvent(new CustomEvent("nurie:complete"));
    }
  }

  function undo() {
    const last = state.history.pop();
    if (!last) return;
    last.region.setAttribute("fill", last.from);
    if ((last.from || "#ffffff").toLowerCase() === "#ffffff") state.painted.delete(last.region);
    else state.painted.add(last.region);
    checkComplete();
    updateUndoState();
  }

  function clearAll() {
    if (!state.template) return;
    stage.querySelectorAll(".region").forEach((region) => {
      const from = region.getAttribute("fill") || "#ffffff";
      if (from.toLowerCase() !== "#ffffff") {
        state.history.push({ region, from, to: "#ffffff" });
        region.setAttribute("fill", "#ffffff");
      }
    });
    state.painted.clear();
    state.completed = false;
    updateUndoState();
  }

  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll(".tool[data-tool]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.tool === tool));
    });
  }

  function updateUndoState() {
    const undoBtn = document.getElementById("btn-undo");
    if (undoBtn) undoBtn.disabled = state.history.length === 0;
  }

  /**
   * いまの状態をふくむ SVG を、指定サイズの透過 PNG として返す（Promise<canvas>）。
   * AR や 保存で使う。
   */
  function renderToCanvas(size = 1024) {
    return new Promise((resolve, reject) => {
      const svg = stage.querySelector("svg");
      if (!svg) return reject(new Error("テンプレートがありません"));
      const clone = svg.cloneNode(true);
      clone.setAttribute("width", size);
      clone.setAttribute("height", size);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const xml = new XMLSerializer().serializeToString(clone);
      const svg64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(img, 0, 0, size, size);
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = svg64;
    });
  }

  global.Coloring = {
    state,
    buildPalette,
    loadTemplate,
    undo,
    clearAll,
    setTool,
    renderToCanvas,
    handPaint,
    aimAt,
    clearAim,
    snapPaint,
  };
})(window);
