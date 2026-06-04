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

  const SVGNS = "http://www.w3.org/2000/svg";

  // ---- なぞり塗り(長押し＆ドラッグ)の状態 ----
  const pointers = new Set();
  let painting = false;
  let lockRegion = null; // 指: 1ストロークで塗る領域を固定(はみ出し防止)
  let handLock = null;   // 手: いま塗っている領域
  let handOff = 0;       // 手が領域から外れたフレーム数
  let aimCand = null;    // 指パッチン: 選択切替の候補
  let aimCnt = 0;        // 候補が続いたフレーム数(安定化)
  const fillAnims = new WeakMap(); // region -> 実行中アニメのトークン
  let gradSeq = 0;

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

    // 🎨 すきな色をえらぶ(カラーピッカー)
    const picker = document.createElement("label");
    picker.className = "swatch swatch-custom";
    picker.setAttribute("aria-label", "すきな いろ");
    const input = document.createElement("input");
    input.type = "color";
    input.value = "#22c1ff";
    input.className = "swatch-color-input";
    picker.appendChild(input);
    const apply = () => {
      picker.style.background = input.value;
      picker.classList.add("chosen");
      selectSwatch(picker, input.value);
    };
    input.addEventListener("input", apply);
    input.addEventListener("change", apply);
    paletteEl.appendChild(picker);
  }

  // いま塗る色を決める
  function resolveColor() {
    return state.tool === "erase" ? "#ffffff" : state.color;
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

  // 手モードが ON か
  function handActive() {
    return !!(global.Hands && global.Hands.isActive && global.Hands.isActive());
  }

  // 指でなぞって塗る。1本指=ぬる / 2本指=AR操作(ar.js)なので塗らない。
  // ★ 手モードON: タップ=「塗る場所の選択」(光るだけ)。パッチンで塗る。
  // ★ 手モードOFF: タップ=その場で塗る(はみ出し防止つき)。
  function bindPainting() {
    stage.onpointerdown = (e) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) { painting = false; return; }
      if (handActive()) { selectAt(e.clientX, e.clientY); return; }
      painting = true;
      lockRegion = null;
      strokePaint(e.clientX, e.clientY);
    };
    stage.onpointermove = (e) => {
      if (handActive() || !painting || pointers.size > 1) return;
      strokePaint(e.clientX, e.clientY);
    };
  }

  // タップした パーツを「選択」(まだ塗らない)
  function selectAt(x, y) {
    const el = regionAt(x, y);
    if (el) setHighlight(el);
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
      applyColor(el, x, y, "burst");
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
        applyColor(el, x, y, "soak");
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

  // パッチン！ タップで選んだ(光っている)パーツを 魔法みたいに塗る
  function snapPaint() {
    const r = state.aimRegion;
    if (!r) return;
    const b = r.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    applyColor(r, cx, cy, "magic");
    // 選択は残す(色を変えて もう一度パッチンも可。別の所は タップで選び直す)
  }

  function currentSolid(region) {
    return region.dataset.solid || region.getAttribute("fill") || "#ffffff";
  }

  function getDefs() {
    const svg = stage.querySelector("svg");
    let defs = svg.querySelector("defs.paint-defs");
    if (!defs) {
      defs = document.createElementNS(SVGNS, "defs");
      defs.setAttribute("class", "paint-defs");
      svg.insertBefore(defs, svg.firstChild);
    }
    return defs;
  }

  function setSolid(region, color) {
    fillAnims.set(region, {}); // 実行中アニメを無効化
    region.setAttribute("fill", color);
    region.dataset.solid = color;
  }

  // 下から上へ ジュワッと満ちていく(SVG縦グラデを実アニメーション)
  function animateFill(region, fromColor, toColor) {
    const defs = getDefs();
    const id = "pf" + (++gradSeq);
    const grad = document.createElementNS(SVGNS, "linearGradient");
    grad.setAttribute("id", id);
    grad.setAttribute("x1", "0"); grad.setAttribute("y1", "1"); // 下
    grad.setAttribute("x2", "0"); grad.setAttribute("y2", "0"); // 上
    const stops = [];
    for (let i = 0; i < 4; i++) {
      const st = document.createElementNS(SVGNS, "stop");
      grad.appendChild(st); stops.push(st);
    }
    defs.appendChild(grad);
    region.setAttribute("fill", "url(#" + id + ")");

    const token = {};
    fillAnims.set(region, token);
    const soft = 0.22, dur = 720, t0 = performance.now();
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const set = (st, off, col) => { st.setAttribute("offset", off); st.setAttribute("stop-color", col); };

    function frame(now) {
      if (fillAnims.get(region) !== token) { grad.remove(); return; } // 取り消された
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 2); // ease-out
      const b = -soft + e * (1 + 2 * soft); // 波面の高さ
      set(stops[0], 0, toColor);
      set(stops[1], clamp(b), toColor);
      set(stops[2], clamp(b + soft), fromColor);
      set(stops[3], 1, fromColor);
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        region.setAttribute("fill", toColor);
        region.dataset.solid = toColor;
        grad.remove();
        fillAnims.delete(region);
      }
    }
    requestAnimationFrame(frame);
  }

  // fx: "burst"(指タップ) / "magic"(指パッチン) / "soak"(やわらか) / null
  function applyColor(region, px, py, fx) {
    const target = resolveColor();
    const from = currentSolid(region);
    if (from.toLowerCase() === target.toLowerCase()) return;

    if (state.tool === "erase") {
      setSolid(region, target); // 消すのは すぐ
    } else {
      animateFill(region, from, target); // 下から上へ ジュワッ
    }
    // ぷにっと反応
    region.classList.remove("just-painted");
    void region.getBoundingClientRect();
    region.classList.add("just-painted");
    state.history.push({ region, from, to: target });

    // エフェクト
    if (state.tool !== "erase" && global.FX) {
      const r = region.getBoundingClientRect();
      const sx = px != null ? px : r.left + r.width / 2;
      const sy = py != null ? py : r.top + r.height / 2;
      if (fx === "magic") global.FX.magic(sx, sy, target);
      else if (fx === "soak") global.FX.soak(sx, sy, target);
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
    setSolid(last.region, last.from);
    if ((last.from || "#ffffff").toLowerCase() === "#ffffff") state.painted.delete(last.region);
    else state.painted.add(last.region);
    checkComplete();
    updateUndoState();
  }

  function clearAll() {
    if (!state.template) return;
    stage.querySelectorAll(".region").forEach((region) => {
      const from = currentSolid(region);
      if (from.toLowerCase() !== "#ffffff") {
        state.history.push({ region, from, to: "#ffffff" });
      }
      setSolid(region, "#ffffff");
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
