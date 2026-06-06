// 手話ミラー - 画面（ビュー）
import {
  STAGES, SIGNS, SCENARIOS,
  signById, signsByStage, stageById, scenarioById,
} from './data.js';
import { store } from './storage.js';
import { HandTracker, matchHandshape } from './handpose.js';
import { el, navTo, toast, celebrate, signCard, header, shuffle } from './ui.js';

// 練習中のカメラを画面遷移時に止めるための参照
let activeTracker = null;
export function cleanup() {
  if (activeTracker) { activeTracker.stop(); activeTracker = null; }
}

// ───────────────────────── ホーム ─────────────────────────
export function renderHome() {
  const total = SIGNS.length;
  const learned = store.learnedCount();
  const s = store.get();
  const due = store.dueSignIds().length;
  const pct = Math.round((learned / total) * 100);

  const ring = el('div.ring', {}, [
    el('svg', { viewBox: '0 0 120 120', html: `
      <circle cx="60" cy="60" r="52" fill="none" stroke="#eceef3" stroke-width="12"/>
      <circle cx="60" cy="60" r="52" fill="none" stroke="#22b8cf" stroke-width="12"
        stroke-linecap="round" stroke-dasharray="${326.7}" stroke-dashoffset="${326.7 * (1 - pct / 100)}"
        transform="rotate(-90 60 60)"/>` }),
    el('div.ring-label', {}, [
      el('div.ring-pct', {}, pct + '%'),
      el('div.ring-sub', {}, `${learned}/${total} 語`),
    ]),
  ]);

  const stats = el('div.stats', {}, [
    el('div.stat', {}, [el('div.stat-num', {}, s.streak + '日'), el('div.stat-cap', {}, '連続学習')]),
    el('div.stat', {}, [el('div.stat-num', {}, due), el('div.stat-cap', {}, '復習まち')]),
    el('div.stat', {}, [el('div.stat-num', {}, s.quizBest), el('div.stat-cap', {}, 'テスト最高')]),
  ]);

  const menu = el('div.home-menu', {}, [
    menuCard('📚', '学ぶ', '段階的にレッスン', '#4dabf7', () => navTo('#/learn')),
    menuCard('🔁', '復習', due ? `${due}語が復習どき` : '今日はなし', '#51cf66', () => navTo('#/review')),
    menuCard('📝', 'テスト', '理解度をチェック', '#fcc419', () => navTo('#/quiz')),
    menuCard('💬', '会話する', 'シミュレーション', '#ff6b6b', () => navTo('#/talk')),
  ]);

  return el('div.page', {}, [
    el('div.hero', {}, [
      el('div.hero-logo', {}, '🪞'),
      el('div', {}, [
        el('h1.hero-title', {}, '手話ミラー'),
        el('p.hero-sub', {}, 'カメラを鏡に、手話を体で覚えよう'),
      ]),
    ]),
    el('div.card.progress-card', {}, [ring, stats]),
    el('h2.section-title', {}, 'メニュー'),
    menu,
  ]);
}

function menuCard(icon, title, sub, color, onclick) {
  return el('button.menu-card', { onclick, style: `--accent:${color}` }, [
    el('div.menu-icon', {}, icon),
    el('div.menu-text', {}, [el('div.menu-title', {}, title), el('div.menu-sub', {}, sub)]),
    el('div.menu-arrow', {}, '›'),
  ]);
}

// ───────────────────────── 学ぶ（ステージ一覧） ─────────────────────────
export function renderLearn() {
  const cards = STAGES.map(stage => {
    const signs = signsByStage(stage.id);
    const done = signs.filter(s => store.isLearned(s.id)).length;
    return el('button.stage-card', {
      onclick: () => navTo('#/stage/' + stage.id), style: `--accent:${stage.color}`,
    }, [
      el('div.stage-icon', {}, stage.icon),
      el('div.stage-info', {}, [
        el('div.stage-title', {}, stage.title),
        el('div.stage-desc', {}, stage.desc),
        el('div.bar', {}, [el('div.bar-fill', { style: `width:${(done / signs.length) * 100}%` })]),
      ]),
      el('div.stage-count', {}, `${done}/${signs.length}`),
    ]);
  });
  return el('div.page', {}, [header('段階レッスン', '#/home'), el('div.stage-list', {}, cards)]);
}

// ───────────────────────── ステージ内の手話一覧 ─────────────────────────
export function renderStage(stageId) {
  const stage = stageById(stageId);
  if (!stage) return notFound();
  const signs = signsByStage(stageId);
  const items = signs.map(sign => el('button.sign-row', {
    onclick: () => navTo('#/sign/' + sign.id),
  }, [
    el('div.sign-row-emoji', {}, sign.emoji),
    el('div.sign-row-text', {}, [
      el('div.sign-row-word', {}, sign.word),
      el('div.sign-row-desc', {}, sign.motion),
    ]),
    store.isLearned(sign.id) ? el('div.badge-done', {}, '✓') : el('div.sign-row-arrow', {}, '›'),
  ]));
  return el('div.page', {}, [
    header(stage.title, '#/learn'),
    el('p.stage-lead', {}, '気になる言葉を選んで、見本を見ながらカメラで練習しよう。'),
    el('div.sign-list', {}, items),
  ]);
}

// ───────────────────────── 手話の練習（AR） ─────────────────────────
export function renderPractice(signId) {
  const sign = signById(signId);
  if (!sign) return notFound();
  const backPath = '#/stage/' + sign.stage;

  const video = el('video.cam-video', { playsinline: '', muted: '' });
  const canvas = el('canvas.cam-canvas');
  const meterFill = el('div.meter-fill');
  const meterPct = el('div.meter-pct', {}, '0%');
  const feedback = el('div.cam-feedback', {}, 'カメラを起動して、見本と同じ手の形をつくってみよう');
  const camStage = el('div.cam-stage.hidden', {}, [
    video, canvas,
    el('div.cam-hud', {}, [
      el('div.meter', {}, [el('div.meter-track', {}, [meterFill]), meterPct]),
      feedback,
    ]),
  ]);

  let holdMs = 0, lastT = 0, succeeded = false;
  const NEED_MS = 1100, PASS = 0.8;

  const onFrame = ({ fingerState, motion, hasHand }) => {
    const now = performance.now();
    const dt = lastT ? now - lastT : 0;
    lastT = now;
    if (succeeded) return;

    if (!hasHand || !fingerState) {
      meterFill.style.width = '0%'; meterPct.textContent = '0%';
      feedback.textContent = '手をカメラに見せてください ✋';
      holdMs = 0; return;
    }
    const { score, hints } = matchHandshape(fingerState, sign.handshape);
    const pct = Math.round(score * 100);
    meterFill.style.width = pct + '%';
    meterPct.textContent = pct + '%';
    meterFill.style.background = pct >= 80 ? '#51cf66' : pct >= 50 ? '#fcc419' : '#ff6b6b';

    if (score >= PASS) {
      holdMs += dt;
      const motionNote = sign.motion === '静止' ? '' : '　動きもつけてみよう！';
      feedback.textContent = `いいね！その形をキープ…${motionNote}`;
      if (holdMs >= NEED_MS) onSuccess();
    } else {
      holdMs = Math.max(0, holdMs - dt);
      feedback.textContent = hints.length ? '👉 ' + hints.slice(0, 2).join('・') : 'もう少し！';
    }
  };

  function onSuccess() {
    succeeded = true;
    store.recordResult(sign.id, true);
    feedback.textContent = '🎉 できました！';
    meterFill.style.width = '100%'; meterPct.textContent = '100%';
    celebrate();
    toast('「' + sign.word + '」を覚えました！', 'success');
    nextBtn.classList.remove('hidden');
    doneBtn.textContent = '✓ 覚えた';
    doneBtn.disabled = true;
  }

  async function startCamera() {
    if (!HandTracker.isSupported()) {
      toast('この環境ではカメラ認識を使えません。見本で覚えましょう。', 'info');
      return;
    }
    try {
      cleanup();
      activeTracker = new HandTracker();
      startBtn.classList.add('hidden');
      camStage.classList.remove('hidden');
      feedback.textContent = 'カメラを準備中…';
      await activeTracker.start(video, canvas, onFrame);
    } catch (e) {
      camStage.classList.add('hidden');
      startBtn.classList.remove('hidden');
      toast('カメラを開始できませんでした: ' + e.message, 'error');
    }
  }

  const startBtn = el('button.btn.btn-primary', { onclick: startCamera }, '📷 カメラで練習');
  const doneBtn = el('button.btn.btn-ghost', {
    onclick: () => {
      if (store.isLearned(sign.id)) return;
      store.recordResult(sign.id, true);
      toast('「' + sign.word + '」を覚えたリストに追加', 'success');
      doneBtn.textContent = '✓ 覚えた'; doneBtn.disabled = true;
      nextBtn.classList.remove('hidden');
    },
  }, store.isLearned(sign.id) ? '✓ 覚えた' : 'カメラなしで覚えた');
  if (store.isLearned(sign.id)) doneBtn.disabled = true;

  const next = nextSign(sign);
  const nextBtn = el('button.btn.btn-primary.hidden', {
    onclick: () => navTo(next ? '#/sign/' + next.id : backPath),
  }, next ? '次の手話へ →' : 'レッスンに戻る →');

  return el('div.page', {}, [
    header(sign.word, backPath),
    signCard(sign),
    camStage,
    el('div.practice-actions', {}, [startBtn, doneBtn, nextBtn]),
    el('p.practice-note', {}, 'カメラ画像は端末内だけで処理され、どこにも送信されません。'),
  ]);
}

function nextSign(sign) {
  const list = signsByStage(sign.stage);
  const i = list.findIndex(s => s.id === sign.id);
  return list[i + 1] || null;
}

// ───────────────────────── 復習（SRS） ─────────────────────────
export function renderReview() {
  const ids = store.dueSignIds();
  if (ids.length === 0) {
    return el('div.page', {}, [
      header('復習', '#/home'),
      emptyState('🌱', '今日の復習はありません', 'レッスンで新しい手話を覚えると、忘れたころに復習として出てきます。',
        '学びに行く', '#/learn'),
    ]);
  }
  const queue = shuffle(ids.map(signById));
  const wrap = el('div.page', {}, [header('復習', '#/home')]);
  const slot = el('div', {});
  wrap.append(slot);
  let idx = 0;

  function showCard() {
    slot.replaceChildren();
    if (idx >= queue.length) {
      slot.append(emptyState('🎉', '復習おつかれさま！', `${queue.length}語を復習しました。`, 'ホームへ', '#/home'));
      return;
    }
    const sign = queue[idx];
    const answer = el('div.review-answer.hidden', {}, [signCard(sign)]);
    const reveal = el('button.btn.btn-ghost', {
      onclick: () => { answer.classList.remove('hidden'); reveal.classList.add('hidden'); judge.classList.remove('hidden'); },
    }, '答え（見本）を見る');
    const judge = el('div.judge-row.hidden', {}, [
      el('button.btn.btn-danger', { onclick: () => grade(false) }, '思い出せなかった'),
      el('button.btn.btn-success', { onclick: () => grade(true) }, 'できた'),
    ]);
    function grade(ok) {
      store.recordResult(sign.id, ok);
      idx++; showCard();
    }
    slot.append(el('div.card.review-card', {}, [
      el('div.review-progress', {}, `${idx + 1} / ${queue.length}`),
      el('div.review-prompt', {}, [el('div.review-emoji', {}, sign.emoji), el('div.review-word', {}, sign.word)]),
      el('p.review-q', {}, 'この手話の動きを思い出せますか？'),
      reveal, answer, judge,
    ]));
  }
  showCard();
  return wrap;
}

// ───────────────────────── テスト ─────────────────────────
export function renderQuiz() {
  const pool = SIGNS.filter(s => store.isLearned(s.id));
  const source = pool.length >= 4 ? pool : SIGNS;
  const questions = shuffle(source).slice(0, Math.min(5, source.length));
  if (questions.length < 4) {
    return el('div.page', {}, [
      header('テスト', '#/home'),
      emptyState('📝', 'もう少し手話を覚えてから', 'テストには4語以上の学習が必要です。まずはレッスンへ。', '学びに行く', '#/learn'),
    ]);
  }
  const wrap = el('div.page', {}, [header('テスト', '#/home')]);
  const slot = el('div', {});
  wrap.append(slot);
  let idx = 0, score = 0;

  function showQ() {
    slot.replaceChildren();
    if (idx >= questions.length) {
      store.recordQuiz(score);
      celebrate();
      slot.append(emptyState('🏁', `${score} / ${questions.length} 正解！`,
        score === questions.length ? 'パーフェクト！すばらしい！' : 'この調子で続けよう。',
        'ホームへ', '#/home'));
      return;
    }
    const q = questions[idx];
    const distractors = shuffle(SIGNS.filter(s => s.id !== q.id)).slice(0, 3);
    const choices = shuffle([q, ...distractors]);
    const choiceBtns = choices.map(c => el('button.quiz-choice', {
      onclick: () => answer(c, choiceBtns, q),
    }, c.word));
    slot.append(el('div.card.quiz-card', {}, [
      el('div.quiz-progress', {}, `第${idx + 1}問 / ${questions.length}　　得点 ${score}`),
      el('div.quiz-visual', {}, [el('div.quiz-emoji', {}, q.emoji)]),
      el('p.quiz-desc', {}, q.description),
      el('p.quiz-q', {}, 'この手話を表す言葉は？'),
      el('div.quiz-choices', {}, choiceBtns),
    ]));
  }
  function answer(chosen, btns, q) {
    const correct = chosen.id === q.id;
    btns.forEach(b => {
      b.disabled = true;
      if (b.textContent === q.word) b.classList.add('correct');
      else if (b.textContent === chosen.word) b.classList.add('wrong');
    });
    if (correct) score++;
    store.recordResult(q.id, correct);
    setTimeout(() => { idx++; showQ(); }, 950);
  }
  showQ();
  return wrap;
}

// ───────────────────────── 会話シミュレーション ─────────────────────────
export function renderTalkList() {
  const cards = SCENARIOS.map(sc => el('button.talk-card', {
    onclick: () => navTo('#/talk/' + sc.id),
  }, [
    el('div.talk-icon', {}, sc.icon),
    el('div.talk-info', {}, [
      el('div.talk-title', {}, sc.title),
      el('div.talk-desc', {}, sc.intro),
      el('div.talk-level', {}, 'レベル ' + sc.level),
    ]),
    store.isScenarioCleared(sc.id) ? el('div.badge-done', {}, '✓') : el('div.talk-arrow', {}, '›'),
  ]));
  return el('div.page', {}, [
    header('会話シミュレーション', '#/home'),
    el('p.stage-lead', {}, '相手の手話を読み取り、正しい返事を選んで会話を進めよう。'),
    el('div.talk-list', {}, cards),
  ]);
}

export function renderTalk(scenarioId) {
  const sc = scenarioById(scenarioId);
  if (!sc) return notFound();
  const wrap = el('div.page', {}, [header(sc.title, '#/talk')]);
  const log = el('div.chat-log', {});
  const slot = el('div.chat-input', {});
  wrap.append(el('p.stage-lead', {}, sc.intro), log, slot);
  let turn = 0;

  function bubble(side, content) {
    return el(`div.bubble.bubble-${side}`, {}, content);
  }

  function showTurn() {
    slot.replaceChildren();
    if (turn >= sc.turns.length) {
      store.clearScenario(sc.id);
      celebrate();
      log.append(bubble('partner', [el('div.bubble-emoji', {}, '👏'), '会話クリア！おつかれさま！']));
      slot.append(el('button.btn.btn-primary', { onclick: () => navTo('#/talk') }, '会話一覧へ戻る'));
      log.scrollTop = log.scrollHeight;
      return;
    }
    const t = sc.turns[turn];
    const partner = signById(t.partner);
    log.append(bubble('partner', [
      el('div.bubble-emoji', {}, partner.emoji),
      el('div.bubble-sign', {}, partner.word),
      el('div.bubble-hint', {}, partner.motion),
    ]));
    log.append(el('div.chat-q', {}, t.text));
    const choiceBtns = t.choices.map(cid => {
      const c = signById(cid);
      return el('button.chat-choice', { onclick: () => choose(cid, t, choiceBtns) }, [
        el('span.chat-choice-emoji', {}, c.emoji), c.word,
      ]);
    });
    slot.append(el('div.chat-choices', {}, choiceBtns));
    log.scrollTop = log.scrollHeight;
  }

  function choose(cid, t, btns) {
    const c = signById(cid);
    if (cid === t.answer) {
      log.append(bubble('me', [el('div.bubble-emoji', {}, c.emoji), el('div.bubble-sign', {}, c.word)]));
      store.recordResult(cid, true);
      turn++;
      setTimeout(showTurn, 350);
    } else {
      const btn = btns.find(b => b.textContent.includes(c.word));
      btn?.classList.add('shake', 'wrong');
      toast('もう一度、相手の手話をよく見て！', 'error');
      setTimeout(() => btn?.classList.remove('shake'), 500);
    }
  }
  showTurn();
  return wrap;
}

// ───────────────────────── 共通の小物 ─────────────────────────
function emptyState(emoji, title, body, btnText, btnPath) {
  return el('div.empty', {}, [
    el('div.empty-emoji', {}, emoji),
    el('h2.empty-title', {}, title),
    el('p.empty-body', {}, body),
    btnText ? el('button.btn.btn-primary', { onclick: () => navTo(btnPath) }, btnText) : null,
  ]);
}

function notFound() {
  return el('div.page', {}, [header('見つかりません', '#/home'),
    emptyState('🤔', 'ページが見つかりません', '', 'ホームへ', '#/home')]);
}
