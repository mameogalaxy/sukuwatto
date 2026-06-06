// 手話ミラー - エントリーポイント（ハッシュルーター）
import {
  renderHome, renderLearn, renderStage, renderPractice,
  renderReview, renderQuiz, renderTalkList, renderTalk, cleanup,
} from './views.js';
import { navTo } from './ui.js';

const app = document.getElementById('app');

// ルート定義: パスのパターン → 描画関数
const routes = [
  { re: /^\/home$/,            view: () => renderHome() },
  { re: /^\/learn$/,           view: () => renderLearn() },
  { re: /^\/stage\/(\w+)$/,    view: m => renderStage(m[1]) },
  { re: /^\/sign\/(\w+)$/,     view: m => renderPractice(m[1]) },
  { re: /^\/review$/,          view: () => renderReview() },
  { re: /^\/quiz$/,            view: () => renderQuiz() },
  { re: /^\/talk$/,            view: () => renderTalkList() },
  { re: /^\/talk\/([\w-]+)$/,  view: m => renderTalk(m[1]) },
];

// 下部ナビの定義
const NAV = [
  { path: '#/home',  icon: '🏠', label: 'ホーム' },
  { path: '#/learn', icon: '📚', label: '学ぶ' },
  { path: '#/review',icon: '🔁', label: '復習' },
  { path: '#/quiz',  icon: '📝', label: 'テスト' },
  { path: '#/talk',  icon: '💬', label: '会話' },
];

function renderNav(activePath) {
  const nav = document.getElementById('nav');
  nav.replaceChildren();
  for (const item of NAV) {
    const active = activePath.startsWith(item.path.slice(1)) ||
      (item.path === '#/learn' && (activePath.startsWith('/stage') || activePath.startsWith('/sign')));
    const btn = document.createElement('button');
    btn.className = 'nav-btn' + (active ? ' active' : '');
    btn.innerHTML = `<span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span>`;
    btn.addEventListener('click', () => navTo(item.path));
    nav.append(btn);
  }
}

function router() {
  cleanup(); // 前の画面のカメラを停止
  let path = location.hash.slice(1);
  if (!path) { navTo('#/home'); return; }

  const route = routes.find(r => r.re.test(path));
  const match = route ? path.match(route.re) : null;
  const node = route ? route.view(match) : renderHome();

  app.replaceChildren(node);
  app.scrollTop = 0;
  window.scrollTo(0, 0);
  renderNav(path);
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
// モジュールは defer 相当で読まれるため、即時にも一度実行
router();
