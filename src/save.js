// セーブデータ。ブラウザ内(IndexedDB)に自動保存し、「冒険の書」ファイルとして書き出し・読み込みできる。
// 決定事項: サーバーなし。学習ログに 試行回数・ヒント回数・エラー種類・試行ごとのコード変化量 を記録。

const DB_NAME = 'c-quest', STORE = 'save', KEY = 'slot1';
const FORMAT = 'c-quest-boukennosho';

export function newSave() {
  return {
    format: FORMAT, version: 1,
    createdAt: new Date().toISOString(), updatedAt: null,
    openingDone: false,
    battles: {},        // id -> { cleared, clearedCode, code, hintsUsed, attempts: [...] }
  };
}

export function battleRecord(save, id) {
  return (save.battles[id] ??= { cleared: false, clearedCode: null, code: null, hintsUsed: 0, attempts: [] });
}

// 1回の挑戦を記録する。result: 'win' | 'lose' | 'error'
export function recordAttempt(save, id, { code, result, errorKinds = [], turns = null, reason = null }) {
  const rec = battleRecord(save, id);
  const prev = rec.attempts.at(-1)?.code ?? null;
  rec.attempts.push({
    at: new Date().toISOString(), code, result, errorKinds, turns, reason,
    changedLines: prev === null ? null : changedLines(prev, code),
  });
  if (result === 'win' && !rec.cleared) { rec.cleared = true; rec.clearedCode = code; }
}

// 前回の挑戦から変えた行数（行ごとの単純な差分）
export function changedLines(a, b) {
  const x = a.split('\n'), y = b.split('\n');
  // 最長共通部分列で「変わっていない行」を数える
  const dp = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  return Math.max(x.length, y.length) - dp[0][0];
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSave() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }   // シークレットウィンドウなどで使えない場合
}

export async function writeSave(save) {
  save.updatedAt = new Date().toISOString();
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(structuredClone(save), KEY);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch { return false; }
}

export function exportSave(save) {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  a.href = URL.createObjectURL(blob);
  a.download = `boukennosho-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importSave(file) {
  const data = JSON.parse(await file.text());
  if (data?.format !== FORMAT || typeof data.battles !== 'object') throw new Error('冒険の書ではないファイルです');
  return data;
}
