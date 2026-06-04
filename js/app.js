/**
 * 画面遷移と全体の組み立て
 */
(function () {
  "use strict";

  const screens = {
    home: document.getElementById("screen-home"),
    color: document.getElementById("screen-color"),
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
      card.addEventListener("click", () => startColoring(tpl));
      gallery.appendChild(card);
    });
  }

  function startColoring(tpl) {
    Coloring.loadTemplate(tpl);
    Coloring.setTool("fill");
    show("color");
  }

  // ---- ぬりえ画面 ----
  document.querySelectorAll('[data-action="back-home"]').forEach((b) =>
    b.addEventListener("click", () => show("home"))
  );

  document.querySelectorAll(".tool[data-tool]").forEach((b) =>
    b.addEventListener("click", () => Coloring.setTool(b.dataset.tool))
  );
  document.getElementById("btn-undo").addEventListener("click", () => Coloring.undo());
  document.getElementById("btn-clear").addEventListener("click", () => {
    if (confirm("ぜんぶ けしますか？")) Coloring.clearAll();
  });

  // help モーダル
  const helpModal = document.getElementById("modal-help");
  document.getElementById("btn-help").addEventListener("click", () => (helpModal.hidden = false));
  document.querySelectorAll('[data-action="close-help"]').forEach((b) =>
    b.addEventListener("click", () => (helpModal.hidden = true))
  );

  // ---- AR へ ----
  document.getElementById("btn-to-ar").addEventListener("click", async () => {
    try {
      const c = await Coloring.renderToCanvas(1024);
      const img = new Image();
      img.onload = async () => {
        show("ar");
        await AR.start(img);
      };
      img.src = c.toDataURL("image/png");
    } catch (e) {
      alert("えがきだしに しっぱいしました");
      console.error(e);
    }
  });

  document.querySelectorAll('[data-action="back-color"]').forEach((b) =>
    b.addEventListener("click", () => {
      AR.stop();
      show("color");
    })
  );

  document.getElementById("btn-ar-rotate").addEventListener("click", () => AR.rotate());
  document.getElementById("btn-ar-reset").addEventListener("click", () => AR.reset());

  // ---- さつえい ----
  const shotModal = document.getElementById("modal-shot");
  const shotPreview = document.getElementById("shot-preview");
  const shotDownload = document.getElementById("shot-download");
  const shotShare = document.getElementById("shot-share");

  document.getElementById("btn-capture").addEventListener("click", () => {
    const dataUrl = AR.capture();
    shotPreview.src = dataUrl;
    shotDownload.href = dataUrl;
    shotModal.hidden = false;

    // Web Share API（対応端末のみ）
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

  // ---- 起動 ----
  Coloring.buildPalette();
  buildGallery();
})();
