// 学習の進捗を localStorage に保存する。
// - learned: 覚えた手話ごとの習熟データ（間隔反復＝SRS用）
// - streak:  連続学習日数
// - quizBest: テストの最高正答数
// - talkCleared: クリアした会話シナリオ

const KEY = 'shuwa-mirror-progress-v1';

const DEFAULT = {
  learned: {},      // { [signId]: { level, due, reps, lastResult } }
  streak: 0,
  lastStudy: null,  // 'YYYY-MM-DD'
  quizBest: 0,
  talkCleared: {},  // { [scenarioId]: true }
};

// SRS の復習間隔（日）。レベルが上がるほど間隔が広がる。
const INTERVALS = [0, 1, 3, 7, 16, 35];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    return { ...structuredClone(DEFAULT), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT);
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function addDays(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const store = {
  get: load,

  // 学習した日として連続日数を更新
  touchStreak() {
    const s = load();
    const today = todayStr();
    if (s.lastStudy === today) return s.streak;
    const yesterday = addDays(-1);
    s.streak = s.lastStudy === yesterday ? s.streak + 1 : 1;
    s.lastStudy = today;
    save(s);
    return s.streak;
  },

  // 手話を「できた／できなかった」で記録し、SRSの次回復習日を決める
  recordResult(signId, correct) {
    const s = load();
    const cur = s.learned[signId] || { level: 0, reps: 0, due: todayStr() };
    if (correct) {
      cur.level = Math.min(cur.level + 1, INTERVALS.length - 1);
    } else {
      cur.level = Math.max(cur.level - 1, 1); // 一度学べば1から
    }
    cur.reps += 1;
    cur.lastResult = correct;
    cur.due = addDays(INTERVALS[cur.level]);
    s.learned[signId] = cur;
    save(s);
    this.touchStreak();
    return cur;
  },

  isLearned(signId) {
    return !!load().learned[signId];
  },

  // 今日が復習日にきている手話ID一覧
  dueSignIds() {
    const s = load();
    const today = todayStr();
    return Object.entries(s.learned)
      .filter(([, v]) => v.due <= today)
      .map(([id]) => id);
  },

  learnedCount() {
    return Object.keys(load().learned).length;
  },

  recordQuiz(score) {
    const s = load();
    if (score > s.quizBest) { s.quizBest = score; save(s); }
    this.touchStreak();
    return s.quizBest;
  },

  clearScenario(scenarioId) {
    const s = load();
    s.talkCleared[scenarioId] = true;
    save(s);
    this.touchStreak();
  },

  isScenarioCleared(scenarioId) {
    return !!load().talkCleared[scenarioId];
  },

  reset() {
    localStorage.removeItem(KEY);
  },
};
