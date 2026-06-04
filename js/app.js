/**
 * 画面遷移と全体の組み立て
 *
 * 流れ: タイトル(キャラ選択) → AR ぬりえ(カメラ起動して、その場で塗る)
 */
(function () {
  "use strict";

  const screens = {
    home: document.getElementById("screen-home"),
    ar: document.getElementById("screen-ar"),
    magic: document.getElementById("screen-magic"),
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("is-active"));
    screens[name].classList.add("is-active");
    window.scrollTo(0, 0);
  }

  // ---- タイトル画面：ギャラリー ----
  function buildGallery() {
    const gallery = document.getElementById("template-gallery");
    gallery.innerHTML = "";
    NurieTemplates.list.forEach((tpl) => {
      const card = document.createElement("button");
      card.className = "gallery-card";
      card.setAttribute("role", "listitem");
      card.innerHTML = `
        <div class="gallery-thumb">${tpl.svg}</div>
        <span class="gallery-name">${tpl.emoji} ${tpl.name}</span>`;
      card.addEventListener("click", () => startAR(tpl));
      gallery.appendChild(card);
    });
  }

  async function startAR(tpl) {
    // iOS は「1タップ＝許可1つ」のため、このタップはカメラ起動に専念させる。
    // (傾きセンサーはカメラ確立後に、権限不要な端末でだけ自動で有効化される)
    Coloring.loadTemplate(tpl);
    Coloring.setTool("fill");
    const d = document.getElementById("ar-done"); if (d) d.hidden = true;
    show("ar");
    try {
      await AR.start();
    } catch (e) {
      console.error(e);
    }
  }

  // ---- 完成したときの お祝い ----
  const arFloat = document.getElementById("ar-float");
  const toast = document.getElementById("ar-toast");
  let toastTimer = null;
  document.addEventListener("nurie:complete", () => {
    // キャラの中心あたりで お祝いキラキラ
    const rect = document.getElementById("svg-stage").getBoundingClientRect();
    if (window.FX) window.FX.celebrate(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width / 2);
    // うれしくてジャンプ
    if (arFloat) {
      arFloat.classList.remove("celebrate");
      void arFloat.offsetWidth;
      arFloat.classList.add("celebrate");
      arFloat.addEventListener("animationend", () => arFloat.classList.remove("celebrate"), { once: true });
    }
    // トースト → 少し見せてから「つぎどうする？」パネル
    if (toast) {
      toast.hidden = false;
      void toast.offsetWidth;
      toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => { toast.hidden = true; }, 300);
      }, 1600);
    }
    setTimeout(() => { const d = document.getElementById("ar-done"); if (d) d.hidden = false; }, 900);
  });

  // ---- 手で塗る(MediaPipe) トグル ----
  const btnHands = document.getElementById("btn-hands");
  function resetHandsBtn() {
    btnHands.classList.remove("on");
    btnHands.textContent = "✋ 手";
    btnHands.disabled = false;
  }
  btnHands.addEventListener("click", async () => {
    if (!window.Hands) { alert("手の にんしきが よみこめませんでした"); return; }
    if (Hands.isActive()) { Hands.stop(); resetHandsBtn(); return; }
    btnHands.textContent = "⏳ よみこみ中";
    btnHands.disabled = true;
    try {
      await Hands.start();
      btnHands.classList.add("on");
      btnHands.textContent = "✋ ON";
    } catch (e) {
      console.error("hands start failed:", e);
      alert("手の にんしきを よみこめませんでした。\n（つうしん環境を かくにん）\nゆびで タッチして ぬってね。");
      resetHandsBtn();
    } finally {
      btnHands.disabled = false;
    }
  });

  // ---- 起動(まず画面を組み立てる。以降の配線で失敗してもギャラリーは出る) ----
  Coloring.buildPalette();
  buildGallery();

  // ---- もどる ----
  document.querySelectorAll('[data-action="back-home"]').forEach((b) =>
    b.addEventListener("click", () => {
      if (window.Hands && Hands.isActive()) { Hands.stop(); resetHandsBtn(); }
      AR.stop();
      show("home");
    })
  );

  // ---- ツール ----
  const eraseBtn = document.getElementById("btn-erase");
  eraseBtn.addEventListener("click", () => {
    // けす ⇄ ぬる をトグル
    const erasing = Coloring.state.tool === "erase";
    Coloring.setTool(erasing ? "fill" : "erase");
    eraseBtn.setAttribute("aria-pressed", String(!erasing));
  });
  document.getElementById("btn-undo").addEventListener("click", () => Coloring.undo());
  document.getElementById("btn-ar-rotate").addEventListener("click", () => AR.rotate());
  // やりなおし: 色を全部消して、位置も中央に戻す
  document.getElementById("btn-ar-reset").addEventListener("click", () => {
    Coloring.clearAll();
    AR.reset();
    hideDone();
  });

  // ---- 完成パネル ----
  const donePanel = document.getElementById("ar-done");
  function hideDone() { if (donePanel) donePanel.hidden = true; }
  document.getElementById("done-close").addEventListener("click", hideDone);
  document.getElementById("done-shot").addEventListener("click", () => {
    hideDone();
    document.getElementById("btn-capture").click();
  });
  document.getElementById("done-again").addEventListener("click", () => {
    Coloring.clearAll();
    AR.reset();
    hideDone();
  });
  document.getElementById("done-next").addEventListener("click", () => {
    hideDone();
    AR.stop();
    show("home");
  });

  // ---- help モーダル ----
  const helpModal = document.getElementById("modal-help");
  document.getElementById("btn-help").addEventListener("click", () => (helpModal.hidden = false));
  document.querySelectorAll('[data-action="close-help"]').forEach((b) =>
    b.addEventListener("click", () => (helpModal.hidden = true))
  );

  // ---- さつえい ----
  const shotModal = document.getElementById("modal-shot");
  const shotPreview = document.getElementById("shot-preview");
  const shotDownload = document.getElementById("shot-download");
  const shotShare = document.getElementById("shot-share");

  // 撮影/保存ダイアログ(AR・マジック 両モードで共用)
  function showShot(dataUrl) {
    if (!dataUrl) return;
    shotPreview.src = dataUrl;
    shotDownload.href = dataUrl;
    shotModal.hidden = false;
    if (navigator.canShare) {
      shotShare.hidden = false;
      shotShare.onclick = async () => {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], "ar-nurie.png", { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "すくわっと" });
          }
        } catch (e) {
          console.warn("share canceled", e);
        }
      };
    } else {
      shotShare.hidden = true;
    }
  }
  window.showShot = showShot;

  document.getElementById("btn-capture").addEventListener("click", async () => {
    try {
      showShot(await AR.capture());
    } catch (e) {
      alert("さつえいに しっぱいしました");
      console.error(e);
    }
  });
  document.querySelectorAll('[data-action="close-shot"]').forEach((b) =>
    b.addEventListener("click", () => (shotModal.hidden = true))
  );
})();
