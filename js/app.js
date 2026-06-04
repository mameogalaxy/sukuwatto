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
    show("ar");
    try {
      await AR.start();
    } catch (e) {
      console.error(e);
    }
  }

  // ---- 起動(まず画面を組み立てる。以降の配線で失敗してもギャラリーは出る) ----
  Coloring.buildPalette();
  buildGallery();

  // ---- もどる ----
  document.querySelectorAll('[data-action="back-home"]').forEach((b) =>
    b.addEventListener("click", () => {
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
  document.getElementById("btn-ar-reset").addEventListener("click", () => AR.reset());

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

  document.getElementById("btn-capture").addEventListener("click", async () => {
    let dataUrl;
    try {
      dataUrl = await AR.capture();
    } catch (e) {
      alert("さつえいに しっぱいしました");
      console.error(e);
      return;
    }
    shotPreview.src = dataUrl;
    shotDownload.href = dataUrl;
    shotModal.hidden = false;

    // Web Share API(対応端末のみ)
    if (navigator.canShare) {
      shotShare.hidden = false;
      shotShare.onclick = async () => {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], "ar-nurie.png", { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "AR ぬりえ" });
          }
        } catch (e) {
          console.warn("share canceled", e);
        }
      };
    } else {
      shotShare.hidden = true;
    }
  });
  document.querySelectorAll('[data-action="close-shot"]').forEach((b) =>
    b.addEventListener("click", () => (shotModal.hidden = true))
  );
})();
