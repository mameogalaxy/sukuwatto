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
  };

  // ---- パレット生成 ----
  function buildPalette() {
    paletteEl.innerHTML = "";
    global.NurieTemplates.palette.forEach((c, i) => {
      const sw = document.createElement("button");
      sw.className = "swatch";
      sw.style.background = c;
      sw.dataset.color = c;
      sw.setAttribute("role", "option");
      sw.setAttribute("aria-label", "いろ " + (i + 1));
      if (c === state.color) sw.classList.add("is-selected");
      sw.addEventListener("click", () => {
        state.color = c;
        // 色を選んだら自動で「ぬる」モードに戻す
        setTool("fill");
        paletteEl
          .querySelectorAll(".swatch")
          .forEach((s) => s.classList.toggle("is-selected", s === sw));
      });
      paletteEl.appendChild(sw);
    });
  }

  // ---- テンプレート読み込み ----
  function loadTemplate(tpl) {
    state.template = tpl;
    state.history = [];
    stage.innerHTML = tpl.svg;
    const svg = stage.querySelector("svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    svg.querySelectorAll(".region").forEach((region) => {
      region.classList.add("colorable");
      const paint = (e) => {
        e.preventDefault();
        // 2本指で動かした直後の指離しで起きる click は塗りとして扱わない
        if (global.AR && global.AR.suppressTap && global.AR.suppressTap()) return;
        applyColor(region);
      };
      region.addEventListener("click", paint);
    });
    updateUndoState();
  }

  function applyColor(region) {
    const target = state.tool === "erase" ? "#ffffff" : state.color;
    const from = region.getAttribute("fill") || "#ffffff";
    if (from.toLowerCase() === target.toLowerCase()) return;
    region.setAttribute("fill", target);
    // ぷにっと反応（クラスを付け直してアニメを再生）
    region.classList.remove("just-painted");
    void region.getBoundingClientRect(); // reflow を強制
    region.classList.add("just-painted");
    state.history.push({ region, from, to: target });
    updateUndoState();
  }

  function undo() {
    const last = state.history.pop();
    if (!last) return;
    last.region.setAttribute("fill", last.from);
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
  };
})(window);
