// 画面の流れ: 冒頭(PC) → 転生 → 地図 → コードを書く → (魔導書が開かない) → 戦闘 → 勝ち/負け
import { preloadCompiler, compileAndRun } from './compiler.js';
import { simulate, turnMessages, turnSummary, readStats, attackDamage } from './battle.js';
import { explain } from './errors.js';
import { highlightLine, highlight } from './highlight.js';
import { STAGE1, PLAYER } from './data/stage1.js';
import { STAGE2 } from './data/stage2.js';
import { newSave, loadSave, writeSave, battleRecord, recordAttempt, exportSave, importSave } from './save.js';

const stage = document.getElementById('stage');
const STAGES = [STAGE1, STAGE2];
const ALL = STAGES.flatMap((st, si) => st.battles.map(b => Object.assign(b, { stage: st, stageIndex: si })));
const findBattle = id => ALL.find(b => b.id === id);
const LICH_GARBLED = '師匠MP 縺ｾ縺?';
let save = null;
let compilerReady = false;
let compilerProgress = 0;
let magicH = '';

// ---------- 共通 ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fit() {
  const s = Math.min(innerWidth / 1280, innerHeight / 800);
  stage.style.transform = `scale(${s})`;
}
addEventListener('resize', fit);

function show(html) {
  stage.innerHTML = html;
  return stage.firstElementChild;
}

let saveTimer = null;
function persist(now = false) {
  clearTimeout(saveTimer);
  if (now) return writeSave(save);
  saveTimer = setTimeout(() => writeSave(save), 400);
}

function speakerHtml(who) {
  if (!who) return '';
  return `<span class="speaker ${who === 'あなた' ? 'you' : ''}">${esc(who)}「</span>`;
}
function lineHtml([who, text]) {
  return who ? `<p>${speakerHtml(who)}${esc(text)}<span class="speaker ${who === 'あなた' ? 'you' : ''}">」</span></p>` : `<p>${esc(text)}</p>`;
}

// メッセージ窓で台詞を1つずつ送る。クリック / Enter / Space で次へ。
function talk(msgEl, lines, onLine) {
  return new Promise(resolve => {
    if (!lines?.length) return resolve();
    let i = 0;
    const draw = () => {
      msgEl.innerHTML = lineHtml(lines[i]) + '<span class="more">▼</span>';
      onLine?.(i, lines[i]);
    };
    const next = () => {
      i++;
      if (i >= lines.length) { cleanup(); resolve(); } else draw();
    };
    const onKey = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } };
    const cleanup = () => { msgEl.removeEventListener('click', next); removeEventListener('keydown', onKey, true); msgEl.classList.remove('clickable'); };
    msgEl.classList.add('clickable');
    msgEl.addEventListener('click', next);
    addEventListener('keydown', onKey, true);
    draw();
  });
}

function setMsg(msgEl, lines) {
  msgEl.innerHTML = lines.map(l => `<p>${l}</p>`).join('');
}

function codeViewHtml(code, marks = {}) {
  // marks: { [行番号]: { cls, tag } }
  return code.split('\n').map((t, i) => {
    const n = i + 1, m = marks[n] ?? {};
    return `<div class="ln ${m.cls ?? ''}" data-line="${n}"><span class="no">${n}</span>${highlightLine(t) || ' '}${m.tag ? `<span class="tag">${esc(m.tag)}</span>` : ''}</div>`;
  }).join('');
}

function statusHtml(hp, mp, p = null, enemy = null) {
  // p があるとき（第2面から）: プログラムから読んだ強さも出す
  const hpmp = `HP <span class="num ${hp <= 5 ? 'low' : ''}" data-hp>${hp}</span>　MP <span class="num" data-mp>${mp}</span>`;
  return `<div class="win status" ${p ? 'style="width:440px"' : ''}>
    ${p ? `<span>あなた　${hpmp}</span>` : `<span>あなた</span><span>${hpmp}</span>`}
    ${p ? `<span>こうげき <span class="num">${p.atk}</span>　ぼうぎょ <span class="num">${p.def}</span>　ぶき <span class="${p.weapon.bare ? 'bad' : ''}">${esc(p.weapon.name)}${p.weapon.code ? `（'${p.weapon.code}'）` : ''}</span></span>
    ${enemy ? `<span class="sub">attack 1回：${esc(damageExplain(p, enemy))}</span>` : ''}` : ''}
  </div>`;
}

// 1回の attack で何ダメージになるかの説明（例: 7×1.5=10.5→10 −0 = 10）
function damageExplain(p, enemy) {
  const w = p.weapon;
  if (w.bare) return '素手なので 0';
  const exact = p.atk * w.mult, raw = Math.floor(exact);
  let s = w.mult === 1 ? `${p.atk}` : `${p.atk}×${w.mult}=${Math.round(exact * 100) / 100}${exact !== raw ? `→${raw}` : ''}`;
  if (w.ignoreDef) return `${s}（防御むし）　MP${w.cost}`;
  return `${s} −防御${enemy.def ?? 0} = ${attackDamage(p, enemy)}　MP${w.cost}`;
}

// 第2面からの「SP / MP」表示（書く前なので強さはまだ決まっていない）
function spStatusHtml(cfg) {
  return `<div class="win status">
    <span>あなた</span>
    <span>SP <span class="num">${cfg.sp}</span>　MP <span class="num">${cfg.mp}</span></span>
    <span class="sub">SP を attack / defense / hp に わける</span>
  </div>`;
}

// その戦闘での自分の強さ。第1面は固定、第2面からはプログラムの変数から読む
function playerFor(b, res) {
  if (b.stageIndex === 0) return { player: { ...PLAYER }, checks: [] };
  return readStats(res?.vars, b.stats ?? b.stage.stats);
}

// 魔導書は面が進むとページ（章）が増える
function reachedStage() {
  let n = 0;
  STAGES.forEach((st, i) => { if (i > 0 && battleRecord(save, STAGES[i - 1].battles.at(-1).id).cleared) n = i; });
  return n;
}
function visibleMagic() {
  const cut = magicH.indexOf(`\n/* === 第${reachedStage() + 2}章`);
  return (cut >= 0 ? magicH.slice(0, cut) : magicH).replace(/\n$/, '');
}

function grimoire() {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  const lines = visibleMagic().split('\n');
  ov.innerHTML = `<div class="win">
    <div class="win-title"><span class="mono" style="color: var(--gold)">magic.h</span><span class="sub">よむだけ。コンパイラが読む本物の中身</span>
    <button class="btn quiet" style="margin-left:auto; min-height:36px" data-close>とじる</button></div>
    <div class="codeview" style="padding: 10px 0">${lines.map((t, i) => `<div class="ln ran"><span class="no">${i + 1}</span>${esc(t) || ' '}</div>`).join('')}</div>
  </div>`;
  const close = () => { ov.remove(); removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
  addEventListener('keydown', onKey, true);
  stage.appendChild(ov);
  ov.querySelector('[data-close]').focus();
}

function unlocked(b) { const i = ALL.indexOf(b); return i === 0 || battleRecord(save, ALL[i - 1].id).cleared; }

// ---------- ⓪ 冒頭: PCで Hello, World! ----------
function renderOpening() {
  const sample = `<span class="p">#include</span> <span class="s">&lt;stdlich.h&gt;</span>

<span class="k">int</span> main(<span class="k">void</span>) {
    printf(<span class="s">"Hello, World!\\n"</span>);
    <span class="k">return</span> 0;
}`;
  const root = show(`<div class="pc">
    <div class="bar">
      <span class="dotc" style="background:#ff5f57"></span><span class="dotc" style="background:#febc2e"></span><span class="dotc" style="background:#28c840"></span>
      <span class="tab">はじめてのC言語 ― 第1回</span>
      <span style="margin-left:auto" class="mono">23:48</span>
    </div>
    <div class="body">
      <article>
        <span style="font-size:13px; color:#6b7280">入門講座 ／ 第1回</span>
        <h1>まずは画面に文字を出してみよう</h1>
        <p>プログラミングの最初の一歩は、画面に「Hello, World!」と表示すること。右にお手本のコードを入れておきました。<b>Enter</b> を押して実行してみましょう。</p>
        <pre class="sample">${sample}</pre>
        <p>うまく動いたら、あなたはもうプログラマーです。</p>
        <span data-prep style="margin-top:auto; font-size:12px; color:#9aa0ad"></span>
      </article>
      <section>
        <div class="ed">
          <div class="name">hello.c<button class="runbtn" data-run>▶ 実行（Enter）</button></div>
          <div class="editor"><div class="gutter" data-gutter>1</div><div class="field"><pre class="hl" aria-hidden="true"></pre><textarea data-code spellcheck="false"></textarea></div></div>
        </div>
        <div class="term" data-term><div class="prompt">$ gcc hello.c -o hello &amp;&amp; ./hello</div><div class="prompt" data-hint>（Enter で実行）</div></div>
      </section>
    </div>
    <div class="flash" data-flash></div>
  </div>`);

  const ta = root.querySelector('[data-code]');
  const gutter = root.querySelector('[data-gutter]');
  const term = root.querySelector('[data-term]');
  const prep = root.querySelector('[data-prep]');
  // お手本は最初から入れておく（毎回打つと話に入れないため）
  ta.value = '#include <stdlich.h>\n\nint main(void) {\n    printf("Hello, World!\\n");\n    return 0;\n}\n';
  wireEditor(ta, gutter);
  root.querySelector('[data-run]').focus();

  const prepTimer = setInterval(() => {
    prep.textContent = compilerReady ? '' : `実行環境を準備しています… ${Math.round(compilerProgress * 100)}%`;
    if (compilerReady) clearInterval(prepTimer);
  }, 300);

  let running = false;
  const print = (html, cls = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; term.appendChild(d); term.scrollTop = term.scrollHeight; return d; };

  async function run() {
    if (running) return;
    running = true;
    root.querySelector('[data-hint]')?.remove();
    print('$ ./hello', 'prompt');
    const wait = compilerReady ? null : print('（準備中… しばらく待ってね）', 'prompt');
    const res = await compileAndRun(ta.value);
    wait?.remove();
    if (!res.ok) {
      print(esc(res.diagnostics.map(d => d.text).join('\n')), 'err');
      running = false; return;
    }
    for (const o of res.outputLines) print(esc(o.text));
    if (!res.outputLines.some(o => o.text === 'Hello, World!')) {
      print('（お手本と同じ「Hello, World!」を出してみよう）', 'prompt');
      running = false; return;
    }
    // 転生
    clearInterval(prepTimer);
    removeEventListener('keydown', onKey, true);
    ta.readOnly = true;
    await sleep(900);
    for (const g of ['Hello, Wor縺ｾ縺ｦ...', '縺薙・荳也阜縺ｸ', 'H̷e̸l̵l̶o̷,̴ ̸W̵o̷r̶l̸d̵.̷.̴.']) { print(esc(g), 'glitch'); await sleep(700); }
    root.querySelector('[data-flash]').classList.add('on');
    await sleep(2600);
    renderAwaken();
  }

  const onKey = e => {
    if (e.key !== 'Enter') return;
    // エディタ内の Enter は改行。Ctrl/⌘+Enter かエディタ外の Enter で実行
    if (document.activeElement === ta && !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); run();
  };
  addEventListener('keydown', onKey, true);
  root.querySelector('[data-run]').addEventListener('click', run);
  term.addEventListener('click', run);
}

// textarea の後ろに色つきのコードを重ねて表示する（文字は透明にして、カーソルと選択だけ textarea が出す）
function wireEditor(ta, gutter) {
  const hl = ta.parentElement.querySelector('.hl');
  const scroll = () => {
    gutter.scrollTop = ta.scrollTop;
    hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft;
  };
  const sync = () => {
    const n = ta.value.split('\n').length;
    gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
    // 最後が改行のとき pre は最終行の高さを持たないので1文字足す
    hl.innerHTML = highlight(ta.value) + '\n ';
    scroll();
  };
  ta.addEventListener('input', sync);
  ta.addEventListener('scroll', scroll);
  ta.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: t } = ta;
      ta.setRangeText('    ', s, t, 'end'); sync();
    }
  });
  sync();
}

// ---------- ⓪-2 目覚め: はじめから / 冒険の書を読み込む ----------
// ブラウザのデータが消えたときも、冒険の書を読み込めば冒頭の話を飛ばして続きから遊べる
function renderAwaken() {
  const root = show(`<div class="screen fadein" style="flex-direction:column; align-items:center; justify-content:center; gap:24px">
    <p style="margin:0; font-size:20px; line-height:1.8; text-align:center">＊……どこかで 古い本の ページが めくれる 音がする。</p>
    <nav class="win cmds" aria-label="はじめかた" style="width:360px">
      <button class="cmd" data-new>はじめから</button>
      <button class="cmd" data-load>冒険の書を 魔導書に よみこむ</button>
    </nav>
    <p class="sub" data-note style="margin:0; min-height:1.6em; text-align:center"></p>
    <input type="file" accept="application/json,.json" data-file hidden>
  </div>`);
  const file = root.querySelector('[data-file]');
  const note = root.querySelector('[data-note]');
  root.querySelector('[data-new]').addEventListener('click', renderPrologue);
  root.querySelector('[data-load]').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    try {
      save = await importSave(file.files[0]);
      save.openingDone = true;
      await persist(true);
      renderMap();
    } catch (e) {
      note.textContent = `＊${e.message}。 もういちど えらんでね。`;
      file.value = '';
    }
  });
  root.querySelector('[data-new]').focus();
}

// ---------- ⓪-3 転生して師匠に会う ----------
async function renderPrologue() {
  const root = show(`<div class="screen fadein" style="flex-direction:column">
    <div class="scene" style="background:#0a0f22">
      <img class="sprite" data-lich src="assets/master_lich.png" alt="師匠リッチ" style="opacity:0; transition: opacity 1.4s">
      <span class="sub" data-place>森の中・夜</span>
    </div>
    <div class="win msg" style="height:170px; flex-grow:0" data-msg></div>
  </div>`);
  const lich = root.querySelector('[data-lich]');
  const lines = [
    [null, '＊……ここは どこだ？'],
    [null, '＊みしらぬ 森。 空には 見たことのない色の 月が ふたつ。'],
    [null, '＊あしもとに ふるい 本と めがねが おちている。'],
    [null, '＊本の 表紙には かすれた文字で 「magic.h」。'],
    [null, '＊あなたは 本を ひらいた。'],
    ['師匠', '……ようやく、誰かが開いてくれたか。'],
    ['あなた', 'ゆ、幽霊!?'],
    ['師匠', '幽霊とは失礼な。まあ似たようなものだがな。わしはこの魔導書に残った、昔の持ち主の残り香のようなものだ。'],
    ['師匠', 'わしの名はリッチ。……師匠とでも呼べ。'],
    ['あなた', '……Hello, World って打っただけなのに。'],
    ['師匠', 'ほう、その言葉を知っているのか。それはCの、一番最初の詠唱だ。'],
    ['師匠', 'この本に書かれているのは「C」という魔法言語。今ではもう誰も使わん、古い言葉だ。'],
    ['あなた', 'このめがねは……？'],
    ['師匠', '……さあな。拾っておけ。'],
    ['師匠', 'ちょうどいい。森の魔物が村に下りてきている。詠唱の基本、教えてやろう。'],
  ];
  await talk(root.querySelector('[data-msg]'), lines, i => { if (i === 5) lich.style.opacity = 1; });
  save.openingDone = true;
  await persist(true);
  renderMap(STAGE1.battles[0].id);
}

// ---------- ⑥ 地図 ----------
function renderMap(selectedId) {
  const firstOpen = ALL.find(b => unlocked(b) && !battleRecord(save, b.id).cleared) ?? ALL.at(-1);
  let sel = selectedId ?? firstOpen.id;
  const st = findBattle(sel).stage, si = STAGES.indexOf(st);
  const stageOpen = i => i >= 0 && i < STAGES.length && unlocked(STAGES[i].battles[0]);
  const root = show(`<div class="screen" style="flex-direction:column">
    <div class="row" style="align-items:stretch">
      <div class="win grow" style="padding:12px 18px; display:flex; align-items:center; gap:16px">
        <button class="btn quiet" data-stage="${si - 1}" ${stageOpen(si - 1) ? '' : 'disabled style="visibility:hidden"'} aria-label="まえの面">◀</button>
        <span style="font-size:22px; color:var(--gold)">${esc(st.title)}</span>
        <span class="sub" style="font-size:14px">まなぶこと：${esc(st.learn)}</span>
        <button class="btn quiet" data-stage="${si + 1}" style="margin-left:auto; ${stageOpen(si + 1) ? '' : 'visibility:hidden'}" ${stageOpen(si + 1) ? '' : 'disabled'} aria-label="つぎの面">▶</button>
      </div>
      <div class="lichmp">${LICH_GARBLED}</div>
    </div>
    <div class="row grow" style="min-height:0">
      <nav class="win battle-list" aria-label="戦闘の一覧" style="width:440px; flex-shrink:0; padding:14px 10px; display:flex; flex-direction:column; gap:2px">
        ${st.battles.map(b => {
          const rec = battleRecord(save, b.id);
          return `<button class="item" data-id="${b.id}" ${unlocked(b) ? '' : 'disabled'}>
            <span style="width:18px; color:var(--green)">${rec.cleared ? '✓' : '・'}</span>
            <span class="grow">${esc(b.name)}</span><span class="sub">${esc(b.place)}</span></button>`;
        }).join('')}
        <div style="margin-top:auto; display:flex; gap:8px; padding:8px">
          <button class="btn quiet" data-export>冒険の書に 書き出す</button>
          <button class="btn quiet" data-import>読み込む</button>
          <input type="file" accept="application/json,.json" data-file hidden>
        </div>
      </nav>
      <div class="col grow" data-detail></div>
    </div>
  </div>`);

  const detail = root.querySelector('[data-detail]');
  const items = [...root.querySelectorAll('.item')];
  const select = id => {
    sel = id;
    items.forEach(it => it.classList.toggle('sel', it.dataset.id === id));
    detail.innerHTML = detailHtml(findBattle(id));
    detail.querySelector('[data-go]')?.addEventListener('click', () => renderCode(id));
    detail.querySelector('[data-cleared]')?.addEventListener('click', () => showCodeOverlay('クリアした コード', battleRecord(save, id).clearedCode));
    detail.querySelector('[data-history]')?.addEventListener('click', () => showHistory(id));
  };
  // マウスは1回目で選んで2回目で入る。キーボードは移動で選び Enter で入る。
  let pointer = false;
  items.forEach(it => {
    it.addEventListener('pointerdown', () => { pointer = true; });
    it.addEventListener('click', () => { pointer = false; sel === it.dataset.id ? renderCode(sel) : select(it.dataset.id); });
    it.addEventListener('focus', () => { if (!pointer) select(it.dataset.id); });
  });
  root.querySelectorAll('[data-stage]').forEach(btn => btn.addEventListener('click', () => {
    const next = STAGES[+btn.dataset.stage];
    renderMap((next.battles.find(b => unlocked(b) && !battleRecord(save, b.id).cleared) ?? next.battles[0]).id);
  }));
  root.querySelector('[data-export]').addEventListener('click', () => exportSave(save));
  const file = root.querySelector('[data-file]');
  root.querySelector('[data-import]').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    try { save = await importSave(file.files[0]); await persist(true); renderMap(); }
    catch (e) { alert(e.message); }
  });
  select(sel);
  root.querySelector(`.item[data-id="${sel}"]`)?.focus({ preventScroll: true });
}

function detailHtml(b) {
  const rec = battleRecord(save, b.id);
  const errs = [...new Set(rec.attempts.flatMap(a => a.errorKinds))];
  const changes = rec.attempts.map(a => a.changedLines).filter(x => x !== null);
  const maxC = Math.max(1, ...changes);
  return `<div class="win" style="padding:14px 18px; display:flex; flex-direction:column; gap:10px">
      <div class="row" style="align-items:center">
        <img src="${b.sprite}" alt="" style="width:96px; height:96px; image-rendering:pixelated">
        <div class="col" style="gap:4px">
          <span style="font-size:20px">${esc(b.name)}</span>
          <span class="sub">${esc(b.task)}</span>
        </div>
      </div>
      <div class="row">
        <button class="btn" data-go>${rec.cleared ? 'もういちど たたかう' : 'たたかう'}</button>
        ${rec.cleared ? '<button class="btn quiet" data-cleared>クリアした コードを みる</button>' : ''}
        ${rec.attempts.length ? '<button class="btn quiet" data-history>りれき（しっぱいも ふくむ）</button>' : ''}
      </div>
    </div>
    <div class="win grow" style="padding:14px 18px; display:flex; flex-direction:column; gap:12px">
      <span style="font-size:18px; color:var(--gold)">がくしゅう ログ</span>
      <div class="row">
        <div class="chip" style="flex:1">ちょうせん <span class="mono" style="font-size:20px">${rec.attempts.length}</span> かい</div>
        <div class="chip" style="flex:1">ヒント <span class="mono" style="font-size:20px">${rec.hintsUsed}</span> かい</div>
      </div>
      <span class="sub">でた エラーの しゅるい</span>
      <div class="row" style="flex-wrap:wrap; gap:8px">${errs.length ? errs.map(k => `<span class="chip err">${esc(ERROR_LABEL[k] ?? k)}</span>`).join('') : '<span class="sub">なし</span>'}</div>
      <span class="sub">ちょうせんごとの コードの へんか（へんこう行数）</span>
      <div class="bars">${changes.length ? changes.map(c => `<div title="${c}行" style="height:${Math.max(4, 56 * c / maxC)}px"></div>`).join('') : '<span class="sub">まだ ない</span>'}</div>
    </div>`;
}

const ERROR_LABEL = {
  blank: 'くうらん', 'char-quote': "' ' と \" \"", overload: 'SP つかいすぎ', bare: 'すで（ぶき なし）', 'zero-stat': '箱が よめない（0）',
  semicolon: '; ぬけ', include: '#include わすれ', 'header-missing': 'まどうしょの なまえ', unterminated: '" とじわすれ',
  brace: '{ } とじわすれ', paren: '( ) とじわすれ', undeclared: 'しらない ことば', main: 'main が ない', escape: '\\ の むき',
  other: 'そのほか', misfire: 'つづりミス（ふはつ）', glued: '\\n わすれ', 'no-mp': 'まりょくぎれ',
};

function showCodeOverlay(title, code) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="win"><div class="win-title"><span>${esc(title)}</span>
    <button class="btn quiet" style="margin-left:auto; min-height:36px" data-close>とじる</button></div>
    <div class="codeview">${codeViewHtml(code ?? '', Object.fromEntries((code ?? '').split('\n').map((_, i) => [i + 1, { cls: 'ran' }])))}</div></div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) ov.remove(); });
  stage.appendChild(ov);
  ov.querySelector('[data-close]').focus();
}

function showHistory(id) {
  const rec = battleRecord(save, id);
  const ov = document.createElement('div');
  ov.className = 'overlay';
  const label = { win: 'かち', lose: 'まけ', error: '魔導書が開かない' };
  ov.innerHTML = `<div class="win"><div class="win-title"><span>りれき</span>
    <button class="btn quiet" style="margin-left:auto; min-height:36px" data-close>とじる</button></div>
    <div style="display:flex; min-height:0; flex-grow:1">
      <div style="width:260px; border-right:2px solid var(--text); overflow:auto; padding:8px 0">
        ${rec.attempts.map((a, i) => `<button class="cmd" style="width:100%; font-size:16px" data-i="${i}">${i + 1}かいめ ${label[a.result]}</button>`).join('')}
      </div>
      <div class="codeview grow" data-code></div>
    </div></div>`;
  const view = ov.querySelector('[data-code]');
  const pick = i => { const c = rec.attempts[i].code; view.innerHTML = codeViewHtml(c, Object.fromEntries(c.split('\n').map((_, k) => [k + 1, { cls: 'ran' }]))); };
  ov.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => pick(+b.dataset.i)));
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) ov.remove(); });
  stage.appendChild(ov);
  pick(rec.attempts.length - 1);
}

// ---------- ① コードを書く ----------
function renderCode(id, { intro = true } = {}) {
  const b = findBattle(id);
  const rec = battleRecord(save, id);
  // テンプレートを作り直したあとは、古いテンプレートから書きかけたコードではなく新しいテンプレートを出す
  const code = rec.code != null && rec.base === b.template ? rec.code : b.template;
  const hExcerpt = visibleMagic().split('\n');
  const root = show(`<div class="screen">
    <section class="col" style="width:540px; flex-shrink:0">
      <div class="win grow" style="display:flex; flex-direction:column; background:var(--code-bg); overflow:hidden; min-height:0">
        <div class="win-title"><span class="mono" style="font-size:15px">${esc(id)}.c</span>
          <span class="sub">ちょうせん ${rec.attempts.length + 1}かいめ</span></div>
        <div class="editor"><div class="gutter" data-gutter></div><div class="field"><pre class="hl" aria-hidden="true"></pre><textarea data-code spellcheck="false" placeholder="ここに 詠唱を かく（Ctrl+Enter で えいしょう）"></textarea></div></div>
      </div>
      <div class="win" style="height:250px; flex-shrink:0; display:flex; flex-direction:column; background:var(--code-bg); overflow:hidden">
        <div class="win-title"><span class="mono" style="font-size:15px; color:var(--gold)">magic.h</span><span class="sub">よむだけ</span>
          <button class="btn quiet" style="margin-left:auto; min-height:32px; font-size:13px" data-grim>おおきく ひらく</button></div>
        <div class="codeview" data-hexcerpt style="font-size:14px; line-height:26px">${hExcerpt.map((t, i) => `<div class="ln" style="color:#8e9ab0"><span class="no">${i + 1}</span>${esc(t) || ' '}</div>`).join('')}</div>
      </div>
    </section>
    <section class="col grow">
      <div class="row" style="align-items:stretch">
        ${b.stageIndex === 0 ? statusHtml(PLAYER.hp, PLAYER.mp) : spStatusHtml(b.stats ?? b.stage.stats)}
        <div class="grow"></div>
        <div class="lichmp">${LICH_GARBLED}</div>
      </div>
      <div class="scene">
        <img class="sprite" src="${b.sprite}" alt="${esc(b.enemy.name)}">
        <span class="sub" style="font-size:14px">${esc(b.enemy.name)}</span>
      </div>
      <div class="row" style="height:200px; flex-shrink:0">
        <nav class="win cmds" aria-label="コマンド">
          <button class="cmd" data-cast>えいしょう</button>
          <button class="cmd" data-hint>ヒント</button>
          <button class="cmd" data-grim>まどうしょ</button>
          <button class="cmd" data-map>ちず</button>
        </nav>
        <div class="win msg" data-msg></div>
      </div>
    </section>
  </div>`);

  const ta = root.querySelector('[data-code]');
  const msg = root.querySelector('[data-msg]');
  // いまの面の章が見えるように、魔導書の抜き書きをその章まで送っておく
  const hx = root.querySelector('[data-hexcerpt]');
  const chapter = hExcerpt.findIndex(t => t.startsWith(`/* === 第${b.stageIndex + 1}章`));
  if (chapter > 0) hx.scrollTop = chapter * 26;
  ta.value = code;
  wireEditor(ta, root.querySelector('[data-gutter]'));
  ta.addEventListener('input', () => { rec.code = ta.value; rec.base = b.template; persist(); });

  const showTask = () => setMsg(msg, [`＊${esc(b.task)}`, '<span class="sub">かけたら えいしょう（Ctrl+Enter）</span>']);
  let busy = false;
  const cast = async () => {
    if (busy) return;
    busy = true;
    rec.code = ta.value; rec.base = b.template; persist();
    setMsg(msg, ['＊あなたは 魔導書を ひらいた……', compilerReady ? '' : '<span class="sub">（じゅんび中… しばらく まってね）</span>']);
    const res = await compileAndRun(ta.value);
    busy = false;
    if (!res.ok) renderCheck(b, ta.value, res.diagnostics);
    else renderBattle(b, ta.value, res);
  };
  root.querySelector('[data-cast]').addEventListener('click', cast);
  root.querySelectorAll('[data-grim]').forEach(el => el.addEventListener('click', grimoire));
  root.querySelector('[data-map]').addEventListener('click', () => renderMap(id));
  root.querySelector('[data-hint]').addEventListener('click', () => {
    const i = Math.min(rec.hintsUsed, b.hints.length - 1);
    if (rec.hintsUsed < b.hints.length) { rec.hintsUsed++; persist(); }
    setMsg(msg, [`<span class="speaker">師匠「</span>${esc(b.hints[i])}<span class="speaker">」</span>`, `<span class="sub">ヒント ${i + 1} / ${b.hints.length}</span>`]);
  });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); cast(); } });

  if (intro && rec.attempts.length === 0 && b.before) {
    talk(msg, b.before).then(() => { showTask(); ta.focus(); });
  } else { showTask(); ta.focus(); }
}

// ---------- ② 魔導書が開かない ----------
function renderCheck(b, code, diagnostics) {
  const rec = battleRecord(save, b.id);
  const firstError = !rec.attempts.some(a => a.result === 'error');
  const errors = diagnostics.filter(d => d.kind === 'error');
  const shown = errors.length ? errors : diagnostics;
  const kinds = [...new Set(shown.map(d => explain(d).kind))];
  recordAttempt(save, b.id, { code, result: 'error', errorKinds: kinds });
  persist(true);

  const marks = Object.fromEntries(shown.filter(d => d.line).map(d => [d.line, { cls: 'err', tag: '← ここ' }]));
  const root = show(`<div class="screen">
    <section class="col" style="width:540px; flex-shrink:0">
      <div class="win grow" style="display:flex; flex-direction:column; background:var(--code-bg); overflow:hidden; min-height:0">
        <div class="win-title"><span class="mono" style="font-size:15px">${esc(b.id)}.c</span><span class="sub">まだ 戦場には でていない</span></div>
        <div class="codeview">${codeViewHtml(code, marks)}</div>
      </div>
    </section>
    <section class="col grow">
      <div class="win" style="padding:14px 18px"><span style="font-size:22px; color:var(--red)">＊魔導書が ひらかない！</span></div>
      <div class="col grow" style="overflow:auto">
        ${shown.map(d => { const x = explain(d); return `<div class="errbox">
          <span class="jp">${d.line ? `${d.line}行目：` : ''}${esc(x.title)}</span>
          <span>${esc(x.note)}</span>
          <pre>${esc(d.text)}</pre></div>`; }).join('')}
      </div>
      <div class="row" style="height:200px; flex-shrink:0">
        <nav class="win cmds"><button class="cmd" data-back>かきなおす</button><button class="cmd" data-grim>まどうしょ</button></nav>
        <div class="win msg" data-msg></div>
      </div>
    </section>
  </div>`);
  root.querySelector('[data-back]').addEventListener('click', () => renderCode(b.id, { intro: false }));
  root.querySelector('[data-grim]').addEventListener('click', grimoire);
  const msg = root.querySelector('[data-msg]');
  const lines = firstError && b.afterError ? b.afterError : [['師匠', '本が開かなければ、一言も唱えられん。英語の一文と、行の番号をよく見ろ。']];
  talk(msg, lines).then(() => setMsg(msg, ['＊なおしたら もういちど えいしょう']));
}

// ---------- ③ 戦闘 ----------
function logHead(enemy) {
  return `<div class="r head ${enemy.mp ? 'r6' : ''}"><span>T</span><span>あなた</span><span>${esc(enemy.name)}</span><span>HP</span><span>MP</span>${enemy.mp ? '<span>てきMP</span>' : ''}</div>`;
}
function logRow(t, enemy, cls = '') {
  const s = turnSummary(t, enemy);
  return `<div class="r ${enemy.mp ? 'r6' : ''} ${cls}"><span>${t.turn}</span><span class="${s.bad ? 'bad' : ''}">${esc(s.you)}</span><span>${esc(s.foe)}</span><span>${t.hp}</span><span>${t.mp}</span>${enemy.mp ? `<span>${t.emp}</span>` : ''}</div>`;
}

function renderBattle(b, code, res) {
  const { player, checks } = playerFor(b, res);
  const { turns, result } = simulate(res.outputLines, player, b.enemy);
  const enemy = b.enemy;
  const root = show(`<div class="screen">
    <section class="col" style="width:540px; flex-shrink:0">
      <div class="win" style="max-height:330px; flex-shrink:0; display:flex; flex-direction:column; background:var(--code-bg); overflow:hidden">
        <div class="win-title"><span class="mono" style="font-size:15px">${esc(b.id)}.c</span><span class="sub">じっこう中の行が ひかる</span></div>
        <div class="codeview" data-code></div>
      </div>
      <div class="win log">
        <div class="win-title"><span>せんとうログ</span><span class="sub">1ターン 1行</span></div>
        ${logHead(enemy)}
        <div class="rows" data-rows></div>
      </div>
    </section>
    <section class="col grow">
      <div class="row" style="align-items:flex-start">
        ${statusHtml(player.hp, player.mp, b.stageIndex > 0 ? player : null, enemy)}
        <div class="grow"></div>
        <div class="lichmp" data-lich>${LICH_GARBLED}</div>
      </div>
      <div class="scene">
        <span style="font-size:18px" data-turnlabel>せんとう かいし</span>
        <img class="sprite" data-sprite src="${b.sprite}" alt="${esc(enemy.name)}">
        <div class="row" style="align-items:center; gap:8px; font-size:14px">
          <span>${esc(enemy.name)}</span>
          <div class="hpbar"><div data-ehpbar style="width:100%"></div></div>
          <span class="mono" data-ehp>${enemy.hp}/${enemy.hp}</span>
          ${enemy.mp ? `<span class="mono" style="margin-left:8px">MP <span data-emp>${enemy.mp.start}</span>/${enemy.mp.max}</span>` : ''}
        </div>
      </div>
      <div class="row" style="height:200px; flex-shrink:0">
        <nav class="win cmds" aria-label="さいせい" data-nav>
          <button class="cmd" data-next>つぎのターン</button>
          <button class="cmd" data-auto>じどう</button>
          <button class="cmd" data-end>けっかまで</button>
        </nav>
        <div class="win msg" data-msg></div>
      </div>
    </section>
  </div>`);

  const $ = s => root.querySelector(s);
  const msg = $('[data-msg]'), rows = $('[data-rows]'), codeEl = $('[data-code]'), sprite = $('[data-sprite]');
  const outputLines = new Set(res.outputLines.map(o => o.line));
  const drawCode = cur => {
    const marks = {};
    turns.forEach((t, i) => { if (t.line && i < cur) marks[t.line] = { cls: 'ran', tag: `T${t.turn}` }; });
    if (cur > 0 && turns[cur - 1]?.line) marks[turns[cur - 1].line] = { cls: 'cur', tag: `T${turns[cur - 1].turn}` };
    for (const l of outputLines) if (!marks[l]) marks[l] = {};
    codeEl.innerHTML = codeViewHtml(code, marks);
    codeEl.querySelector('.cur')?.scrollIntoView({ block: 'nearest' });
  };
  drawCode(0);
  // 第2面から: 読み取った強さの問題を、戦う前に見せる
  const opening = [`＊${esc(enemy.name)}が あらわれた！`];
  if (b.stageIndex > 0) opening.push(...(checks.length ? checks.map(c => `<span class="bad">＊${esc(c.text)}</span>`) : ['＊ちからは ただしく よみとれた。']));
  setMsg(msg, opening);

  let shown = 0, auto = null, finished = false;
  const step = () => {
    if (finished) return;
    if (shown >= turns.length) return finish();
    const t = turns[shown++];
    rows.querySelector('.cur')?.classList.remove('cur');
    rows.insertAdjacentHTML('beforeend', logRow(t, enemy, 'cur'));
    const row = rows.lastElementChild;
    row.scrollIntoView({ block: 'nearest' });
    drawCode(shown);
    $('[data-turnlabel]').textContent = `ターン ${t.turn}`;
    root.querySelector('[data-hp]').textContent = t.hp;
    root.querySelector('[data-hp]').classList.toggle('low', t.hp <= 5);
    root.querySelector('[data-mp]').textContent = t.mp;
    $('[data-ehp]').textContent = `${t.ehp}/${enemy.hp}`;
    $('[data-ehpbar]').style.width = `${100 * t.ehp / enemy.hp}%`;
    if (enemy.mp) $('[data-emp]').textContent = t.emp;
    if (t.ehp < t.ehpBefore) { sprite.classList.remove('hit'); void sprite.offsetWidth; sprite.classList.add('hit'); }
    if (t.hp < t.hpBefore) { const sc = root.querySelector('.scene'); sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake'); }
    if (t.ehp === 0) sprite.classList.add('gone');
    setMsg(msg, turnMessages(t, enemy).map(esc));
    if (shown >= turns.length) { stopAuto(); setTimeout(finish, 1400); }
  };
  const stopAuto = () => { clearInterval(auto); auto = null; };
  $('[data-next]').addEventListener('click', () => { stopAuto(); step(); });
  $('[data-auto]').addEventListener('click', () => { if (auto) return; step(); auto = setInterval(step, 1300); });
  $('[data-end]').addEventListener('click', () => { stopAuto(); while (shown < turns.length) step(); });
  $('[data-next]').focus();

  async function finish() {
    if (finished) return;
    finished = true; stopAuto();
    const rec = battleRecord(save, b.id);
    const firstLose = !rec.attempts.some(a => a.result === 'lose');
    const kinds = [...new Set([
      ...(player.overload ? ['overload'] : []),
      ...(player.weapon?.bare ? ['bare'] : []),
      ...(b.stageIndex > 0 && checks.some(c => / が 0/.test(c.text)) ? ['zero-stat'] : []),
      ...turns.flatMap(t => t.events.flatMap(e => e.kind === 'misfire' ? [e.glued ? 'glued' : 'misfire'] : e.kind === 'no-mp' ? ['no-mp'] : [])),
    ])];
    recordAttempt(save, b.id, { code, result: result.kind, errorKinds: kinds, turns: turns.length, reason: result.reason ?? null });
    await persist(true);
    $('[data-nav]').innerHTML = '';
    if (result.kind === 'win') {
      await sleep(400);
      setMsg(msg, [`＊${esc(enemy.name)}を やっつけた！`]);
      await sleep(1000);
      await talk(msg, b.after);
      if (b.boss) await bossClear(root, b.stage);
      const next = ALL[ALL.indexOf(b) + 1];
      $('[data-nav]').innerHTML = `${next ? '<button class="cmd" data-nextb>つぎへ すすむ</button>' : ''}<button class="cmd" data-map>ちず</button>`;
      setMsg(msg, [b.boss ? `＊${esc(b.stage.title.split(' ')[0])} クリア！` : '＊しょうり！']);
      root.querySelector('[data-nextb]')?.addEventListener('click', () => renderCode(next.id));
      root.querySelector('[data-map]').addEventListener('click', () => renderMap(next?.id ?? b.id));
      (root.querySelector('[data-nextb]') ?? root.querySelector('[data-map]')).focus();
    } else {
      await sleep(500);
      setMsg(msg, result.reason === 'out-of-spells'
        ? [`＊詠唱が つきた。 ${esc(enemy.name)}は まだ たっている……`, '＊あなたは ちからつきた。']
        : result.reason === 'no-hp' ? ['＊hp が 0 では たっていられない！', '＊あなたは ちからつきた。']
        : ['＊あなたは ちからつきた。']);
      await sleep(1600);
      renderDefeat(b, code, turns, result, firstLose, player, checks);
    }
  }
}

async function bossClear(root, st) {
  const lich = root.querySelector('[data-lich]');
  root.querySelector('[data-msg]').innerHTML = '';
  await sleep(300);
  lich.textContent = `師匠MP ${st.lichGauge}`;
  lich.classList.add('revealed');
  await sleep(1600);
  lich.textContent = LICH_GARBLED;
  lich.classList.remove('revealed');
  const nextStage = STAGES[STAGES.indexOf(st) + 1];
  await talk(root.querySelector('[data-msg]'), [
    ...st.epilogue,
    ...(nextStage ? [] : [[null, `＊（第${STAGES.length + 1}面は まだ つくっている とちゅうです）`]]),
  ]);
}

// ---------- ④ 負け → ログで振り返り ----------
function renderDefeat(b, code, turns, result, firstLose, player, checks) {
  const enemy = b.enemy;
  const rec = battleRecord(save, b.id);
  const marks = {};
  turns.forEach(t => { if (t.line) marks[t.line] = { cls: turnSummary(t, enemy).bad ? 'err' : 'ran', tag: `T${t.turn}` }; });
  const root = show(`<div class="screen">
    <section class="col" style="width:540px; flex-shrink:0">
      <div class="win" style="max-height:330px; flex-shrink:0; display:flex; flex-direction:column; background:var(--code-bg); overflow:hidden">
        <div class="win-title"><span class="mono" style="font-size:15px">${esc(b.id)}.c</span><span class="sub">T = そのターンに 唱えた行</span></div>
        <div class="codeview">${codeViewHtml(code, marks)}</div>
      </div>
      <div class="win log">
        <div class="win-title"><span>せんとうログ</span><span class="sub">どこで まけた？</span></div>
        ${logHead(enemy)}
        <div class="rows">${checks.map(c => `<div class="r note"><span></span><span class="bad">${esc(c.text)}</span></div>`).join('')}
        ${turns.map(t => logRow(t, enemy, t === turns.at(-1) ? 'cur' : '')).join('')}
        ${result.reason === 'out-of-spells' ? `<div class="r note"><span>${turns.length + 1}</span><span class="bad">詠唱が つきた</span></div>` : ''}</div>
      </div>
    </section>
    <section class="col grow">
      <div class="row" style="align-items:flex-start">${statusHtml(player.hp, player.mp, b.stageIndex > 0 ? player : null, enemy)}<div class="grow"></div><div class="lichmp">${LICH_GARBLED}</div></div>
      <div class="scene" style="background:#0d1226">
        <img class="sprite" src="assets/master_lich.png" alt="師匠リッチ" style="width:240px; height:240px">
        <span class="sub">あわい光が あなたを つつみ、HPと MPが もどった</span>
      </div>
      <div class="row" style="height:200px; flex-shrink:0">
        <nav class="win cmds"><button class="cmd" data-back>かきなおす</button><button class="cmd" data-hint>ヒント</button><button class="cmd" data-grim>まどうしょ</button><button class="cmd" data-map>ちず</button></nav>
        <div class="win msg" data-msg></div>
      </div>
    </section>
  </div>`);
  const msg = root.querySelector('[data-msg]');
  root.querySelector('[data-back]').addEventListener('click', () => renderCode(b.id, { intro: false }));
  root.querySelector('[data-grim]').addEventListener('click', grimoire);
  root.querySelector('[data-map]').addEventListener('click', () => renderMap(b.id));
  root.querySelector('[data-hint]').addEventListener('click', () => {
    const i = Math.min(rec.hintsUsed, b.hints.length - 1);
    if (rec.hintsUsed < b.hints.length) { rec.hintsUsed++; persist(); }
    setMsg(msg, [`<span class="speaker">師匠「</span>${esc(b.hints[i])}<span class="speaker">」</span>`, `<span class="sub">ヒント ${i + 1} / ${b.hints.length}</span>`]);
  });
  const lines = firstLose && b.afterLose ? b.afterLose : [['師匠', '……まったく、世話の焼ける。立てるか。'], ['師匠', 'ログを見ろ。何ターン目に、何が起きた？']];
  talk(msg, lines).then(() => { setMsg(msg, ['＊なおしたら もういちど えいしょう']); root.querySelector('[data-back]').focus(); });
}

// ---------- はじまり ----------
async function boot() {
  fit();
  magicH = await (await fetch('src/c/magic.h')).text();
  save = (await loadSave()) ?? newSave();
  // コンパイラ（約27MB）は最初に裏で読み込みはじめる
  preloadCompiler((done, total) => { compilerProgress = total ? done / total : 0; })
    .then(() => { compilerReady = true; })
    .catch(e => console.error('compiler load failed', e));
  if (!save.openingDone) renderOpening();
  else renderMap();
}
boot();
