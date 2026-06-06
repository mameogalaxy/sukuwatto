// 手話ミラー - UIの共通ヘルパー

// 簡易DOM生成: el('div.card', { onclick }, [子要素...] または 文字列)
export function el(spec, props = {}, children = []) {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== null && v !== undefined) {
      node.setAttribute(k, v);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

// ハッシュルーターでの画面遷移
export const navTo = path => { location.hash = path; };

// 一時的な通知
export function toast(message, type = 'info') {
  const t = el(`div.toast.toast-${type}`, {}, message);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2200);
}

// お祝い演出（軽量な紙吹雪）
export function celebrate() {
  const colors = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#9775fa', '#22b8cf'];
  for (let i = 0; i < 28; i++) {
    const p = el('div.confetti');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.3 + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.append(p);
    setTimeout(() => p.remove(), 1600);
  }
}

// 見本の手話カード（絵文字・説明・動き・ヒント）
export function signCard(sign, opts = {}) {
  return el('div.signcard', {}, [
    el('div.signcard-visual', {}, [
      el('div.signcard-emoji', {}, sign.emoji),
      opts.showWord !== false ? el('div.signcard-word', {}, sign.word) : null,
    ]),
    el('div.signcard-body', {}, [
      el('div.signcard-row', {}, [
        el('span.signcard-label', {}, '動作'),
        el('span', {}, sign.description),
      ]),
      el('div.signcard-row', {}, [
        el('span.signcard-label', {}, '動き'),
        el('span', {}, sign.motion),
      ]),
      el('div.signcard-tip', {}, [el('span', {}, '💡 '), sign.tip]),
    ]),
  ]);
}

// 画面ヘッダー（戻るボタン付き）
export function header(title, backPath) {
  return el('div.page-header', {}, [
    backPath ? el('button.back-btn', { onclick: () => navTo(backPath) }, '‹') : null,
    el('h1.page-title', {}, title),
  ]);
}

// 配列をシャッフル
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
