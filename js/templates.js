/**
 * ぬりえテンプレート集
 *
 * 各テンプレートは SVG 文字列。塗れる領域には class="region" を付け、
 * タップするとそこに色が入る（flood ではなく領域そのものを塗りつぶす方式）。
 * 線画は stroke で表現し、白い region に色が乗っても線が残るようにしている。
 *
 * viewBox は 0 0 400 400 に統一。
 */
(function (global) {
  "use strict";

  // 共通の線スタイル。各 region に付与する。
  const L = 'stroke="#2a2540" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';

  const templates = [
    {
      id: "slime",
      name: "すらいむ",
      emoji: "🟢",
      svg: `
        <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
          <!-- かげ -->
          <ellipse class="region" data-name="kage" cx="200" cy="350" rx="120" ry="26" fill="#ffffff" ${L}/>
          <!-- からだ -->
          <path class="region" data-name="body" ${L} fill="#ffffff"
            d="M200 70
               C285 70 330 150 330 230
               C330 320 280 345 200 345
               C120 345 70 320 70 230
               C70 150 115 70 200 70 Z"/>
          <!-- ほっぺ -->
          <circle class="region" data-name="cheekL" cx="135" cy="240" r="20" fill="#ffffff" ${L}/>
          <circle class="region" data-name="cheekR" cx="265" cy="240" r="20" fill="#ffffff" ${L}/>
          <!-- め -->
          <circle data-name="eyeL" cx="160" cy="205" r="13" fill="#2a2540"/>
          <circle data-name="eyeR" cx="240" cy="205" r="13" fill="#2a2540"/>
          <circle cx="156" cy="200" r="4" fill="#ffffff"/>
          <circle cx="236" cy="200" r="4" fill="#ffffff"/>
          <!-- くち -->
          <path d="M185 235 Q200 250 215 235" fill="none" ${L}/>
          <!-- ランタンチャーム -->
          <path class="region" data-name="charm" ${L} fill="#ffffff"
            d="M255 285 q20 5 30 30 q5 14 -10 20 q-22 8 -30 -14 q-6 -22 10 -36 Z"/>
          <!-- ほし -->
          <path class="region" data-name="star1" ${L} fill="#ffffff"
            d="M110 110 l8 18 l20 2 l-15 14 l5 20 l-18 -10 l-18 10 l5 -20 l-15 -14 l20 -2 Z"/>
          <path class="region" data-name="star2" ${L} fill="#ffffff"
            d="M305 130 l6 13 l14 2 l-11 10 l4 14 l-13 -7 l-13 7 l4 -14 l-11 -10 l14 -2 Z"/>
        </svg>`,
    },

    {
      id: "pumpkin",
      name: "かぼちゃまじょ",
      emoji: "🎃",
      svg: `
        <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
          <ellipse class="region" data-name="kage" cx="200" cy="360" rx="120" ry="22" fill="#ffffff" ${L}/>
          <!-- マント -->
          <path class="region" data-name="cloak" ${L} fill="#ffffff"
            d="M120 250 C100 320 110 350 130 360 L270 360 C290 350 300 320 280 250
               C250 300 150 300 120 250 Z"/>
          <!-- かぼちゃの あたま -->
          <path class="region" data-name="pumpkin" ${L} fill="#ffffff"
            d="M200 150
               C150 150 120 185 120 225
               C120 270 155 295 200 295
               C245 295 280 270 280 225
               C280 185 250 150 200 150 Z"/>
          <!-- かぼちゃの すじ -->
          <path d="M170 162 C158 200 158 250 175 288" fill="none" ${L}/>
          <path d="M230 162 C242 200 242 250 225 288" fill="none" ${L}/>
          <!-- ぼうし -->
          <path class="region" data-name="hat" ${L} fill="#ffffff"
            d="M150 165 C160 110 200 70 250 60 C235 95 235 130 250 165 Z"/>
          <path class="region" data-name="hatBrim" ${L} fill="#ffffff"
            d="M110 165 C150 145 250 145 300 168 C250 190 150 190 110 165 Z"/>
          <!-- め -->
          <path class="region" data-name="eyeL" ${L} fill="#ffffff"
            d="M165 215 l24 -10 l0 22 Z"/>
          <path class="region" data-name="eyeR" ${L} fill="#ffffff"
            d="M235 215 l-24 -10 l0 22 Z"/>
          <!-- くち -->
          <path class="region" data-name="mouth" ${L} fill="#ffffff"
            d="M165 250 l14 12 l10 -10 l11 12 l10 -12 l11 10 l14 -12
               C215 285 185 285 165 250 Z"/>
          <!-- マフラー -->
          <path class="region" data-name="scarf" ${L} fill="#ffffff"
            d="M130 285 C170 320 230 320 270 285 C270 310 250 320 250 320
               C220 335 180 335 150 320 C150 320 130 310 130 285 Z"/>
          <path class="region" data-name="scarfEnd" ${L} fill="#ffffff"
            d="M255 312 C290 320 300 345 295 360 L270 355 C268 335 258 322 255 312 Z"/>
          <!-- ポーション -->
          <path class="region" data-name="potion" ${L} fill="#ffffff"
            d="M186 330 l0 -12 l8 0 l0 12 c12 6 12 26 -4 28 c-16 2 -16 -22 -4 -28 Z"/>
          <!-- ほし -->
          <path class="region" data-name="star" ${L} fill="#ffffff"
            d="M315 110 l6 13 l14 2 l-11 10 l4 14 l-13 -7 l-13 7 l4 -14 l-11 -10 l14 -2 Z"/>
        </svg>`,
    },

    {
      id: "ghost",
      name: "おばけ",
      emoji: "👻",
      svg: `
        <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
          <ellipse class="region" data-name="kage" cx="200" cy="360" rx="100" ry="20" fill="#ffffff" ${L}/>
          <!-- からだ -->
          <path class="region" data-name="body" ${L} fill="#ffffff"
            d="M200 60
               C130 60 95 120 95 200
               L95 330
               q20 -25 40 0 q20 25 40 0 q20 -25 40 0 q20 25 40 0 q20 -25 40 0
               L305 200
               C305 120 270 60 200 60 Z"/>
          <!-- ほっぺ -->
          <circle class="region" data-name="cheekL" cx="140" cy="210" r="16" fill="#ffffff" ${L}/>
          <circle class="region" data-name="cheekR" cx="260" cy="210" r="16" fill="#ffffff" ${L}/>
          <!-- め -->
          <ellipse data-name="eyeL" cx="165" cy="180" rx="14" ry="18" fill="#2a2540"/>
          <ellipse data-name="eyeR" cx="235" cy="180" rx="14" ry="18" fill="#2a2540"/>
          <circle cx="160" cy="173" r="5" fill="#ffffff"/>
          <circle cx="230" cy="173" r="5" fill="#ffffff"/>
          <!-- くち -->
          <path class="region" data-name="mouth" ${L} fill="#ffffff"
            d="M180 215 C185 245 215 245 220 215 C210 230 190 230 180 215 Z"/>
          <!-- ほし -->
          <path class="region" data-name="star1" ${L} fill="#ffffff"
            d="M320 130 l6 13 l14 2 l-11 10 l4 14 l-13 -7 l-13 7 l4 -14 l-11 -10 l14 -2 Z"/>
          <path class="region" data-name="star2" ${L} fill="#ffffff"
            d="M70 160 l6 13 l14 2 l-11 10 l4 14 l-13 -7 l-13 7 l4 -14 l-11 -10 l14 -2 Z"/>
        </svg>`,
    },

    {
      id: "star",
      name: "おほしさま",
      emoji: "⭐",
      svg: `
        <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
          <ellipse class="region" data-name="kage" cx="200" cy="360" rx="90" ry="18" fill="#ffffff" ${L}/>
          <!-- ほし本体 -->
          <path class="region" data-name="star" ${L} fill="#ffffff"
            d="M200 60
               l38 78 l86 10 l-63 60 l16 86 l-77 -42 l-77 42 l16 -86 l-63 -60 l86 -10 Z"/>
          <!-- ほっぺ -->
          <circle class="region" data-name="cheekL" cx="160" cy="205" r="15" fill="#ffffff" ${L}/>
          <circle class="region" data-name="cheekR" cx="240" cy="205" r="15" fill="#ffffff" ${L}/>
          <!-- め -->
          <circle data-name="eyeL" cx="178" cy="180" r="11" fill="#2a2540"/>
          <circle data-name="eyeR" cx="222" cy="180" r="11" fill="#2a2540"/>
          <circle cx="175" cy="176" r="3.5" fill="#ffffff"/>
          <circle cx="219" cy="176" r="3.5" fill="#ffffff"/>
          <!-- くち -->
          <path d="M188 200 Q200 214 212 200" fill="none" ${L}/>
          <!-- まわりの ちいさい ほし -->
          <path class="region" data-name="mini1" ${L} fill="#ffffff"
            d="M70 110 l5 11 l12 1 l-9 8 l3 12 l-11 -6 l-11 6 l3 -12 l-9 -8 l12 -1 Z"/>
          <path class="region" data-name="mini2" ${L} fill="#ffffff"
            d="M330 120 l5 11 l12 1 l-9 8 l3 12 l-11 -6 l-11 6 l3 -12 l-9 -8 l12 -1 Z"/>
        </svg>`,
    },
  ];

  // 塗りパレット（こども向けに あかるい いろ）
  const palette = [
    "#ff5d73", "#ff8f4c", "#ffd23f", "#7bd66b",
    "#3fb8af", "#5aa9ff", "#9b6dff", "#ff8fcf",
    "#a6764a", "#ffffff", "#c9d1d9", "#2a2540",
  ];

  global.NurieTemplates = { list: templates, palette };
})(window);
