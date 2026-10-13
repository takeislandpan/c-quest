// 戦闘の計算。画面とは切り離して、出力された呪文の列から1ターンずつの結果を作る。
// 決定事項: プレイヤーのn行目の出力とボスのn回目の行動を同じターンで処理（自分→敵の順）。
// 綴りミスは不発でMP消費。MPが足りないと詠唱失敗。全攻撃必中・運要素なし。
// 第2面から: 攻撃 = (int)(attack × 武器倍率) − 相手の防御（最低1）。杖は防御無視。
//            被ダメ = 相手の攻撃 − defense（最低1）。guard はそれを半分（切り捨て）。

export const SPELLS = {
  attack: { mp: 2 },
  guard: { mp: 1 },
};
// 不発（知らない言葉）でも唱えた分の魔力は減る
export const MISFIRE_MP = 2;

export const WEAPONS = {
  S: { name: '剣', mult: 1.5, cost: 2 },
  B: { name: '弓', mult: 1.2, cost: 2 },
  M: { name: '杖', mult: 1.0, cost: 3, ignoreDef: true },
};
const OVERLOAD_STUN = 3;
// guard（守ったターンに受けるダメージの割合）。書かなければ 0.5。0.1 下げるごとに SP 1（端数は切り上げ）。0.2 より下げられない
export const GUARD_DEFAULT = 0.5, GUARD_MIN = 0.2;
export const guardCost = g => (g < GUARD_DEFAULT ? Math.ceil((GUARD_DEFAULT - g) * 10 - 1e-9) : 0);

// SP の内訳（例: 13 + 5 + 12 + guard 0.3 の 2）
export const spBreakdown = p => `${p.atk} + ${p.def} + ${p.hp0 ?? p.hp}${guardCost(p.guard) ? ` + guard ${fmt(p.guard)} の ${guardCost(p.guard)}` : ''}`;

const fmt = x => String(Math.round(x * 1000) / 1000);
const charLabel = c => (c >= 33 && c <= 126 ? `'${String.fromCharCode(c)}'` : `文字コード ${c}`);

// 第2面から: プログラムの変数（最初の printf の時点）から自分の強さを決める。
// cfg: { sp, mp }。戻り値: { player, checks: [{ text, bad }] }
// 決定事項: ゲーム側は合計上限のみ検証。名前違い・書き忘れは 0 扱い。
// ルール違反は「必ず負け、ただし理由はログで分かる」。
export function readStats(vars, cfg) {
  const v = vars ?? { attack: 0, defense: 0, hp: 0, weapon: 0, guard: GUARD_DEFAULT };
  const checks = [];
  const stat = name => {
    const x = v[name];
    if (x < 0) { checks.push({ text: `${name} が マイナス（${x}）→ 0 として あつかう`, bad: true }); return 0; }
    if (x === 0) checks.push({ text: `${name} が 0（書きわすれ・つづりミス？）`, bad: true });
    return x;
  };
  const atk = stat('attack'), def = stat('defense'), hp = stat('hp');
  let guard = Number.isFinite(v.guard) ? v.guard : GUARD_DEFAULT;
  if (guard < GUARD_MIN) { checks.push({ text: `guard ${fmt(guard)} は 下げすぎ → ${GUARD_MIN} として あつかう`, bad: true }); guard = GUARD_MIN; }
  if (guard > 1) { checks.push({ text: `guard ${fmt(guard)} は 1 より 大きい → 1 として あつかう`, bad: true }); guard = 1; }
  const used = atk + def + hp + guardCost(guard);

  let weapon;
  const code = v.weapon, ch = String.fromCharCode(code);
  if (WEAPONS[ch]) weapon = { code: ch, ...WEAPONS[ch] };
  else {
    weapon = { code: null, name: '素手', mult: 0, cost: 2, bare: true };
    if (code === 0) checks.push({ text: 'weapon が よみとれない → 素手（ダメージ 0）', bad: true });
    else if (WEAPONS[ch.toUpperCase()]) checks.push({ text: `weapon の ${charLabel(code)} は 魔導書に ない武器（大文字の '${ch.toUpperCase()}'）→ 素手（ダメージ 0）`, bad: true });
    else checks.push({ text: `weapon の ${charLabel(code)} は 魔導書に ない武器 → 素手（ダメージ 0）`, bad: true });
  }

  const player = { hp, hp0: hp, mp: cfg.mp, atk, def, weapon, guard, sp: cfg.sp, used };
  if (used > cfg.sp) {
    checks.unshift({ text: `SP ${used} / ${cfg.sp}（${spBreakdown(player)}）：つかいすぎ！ 魔力暴走（HP 1、さいしょの ${OVERLOAD_STUN}ターン うごけない）`, bad: true });
    Object.assign(player, { hp: 1, stun: OVERLOAD_STUN, overload: true });
  }
  return { player, checks };
}

export function attackDamage(player, enemy) {
  const w = player.weapon;
  if (w?.bare) return 0;
  const raw = Math.floor(player.atk * (w?.mult ?? 1));
  return w?.ignoreDef ? raw : Math.max(1, raw - (enemy.def ?? 0));
}

// player: { hp, mp, atk, def?, weapon?, stun? }
// enemy:  { name, hp, atk, def?, charge?: { every, damage, name, warnText },
//           mp?: { start, max, regen, cost, name, warnText } }
// outputs: [{ text, line }]  プログラムが出力した行（1行=1ターン）
export function simulate(outputs, player, enemy) {
  let hp = player.hp, mp = player.mp, ehp = enemy.hp, emp = enemy.mp?.start ?? null;
  const def = player.def ?? 0;
  const atkCost = player.weapon?.cost ?? SPELLS.attack.mp;
  const turns = [];
  let result = null;

  if (hp <= 0) return { turns, result: { kind: 'lose', reason: 'no-hp', turn: 0 } };

  for (let i = 0; ; i++) {
    const t = i + 1;
    const out = outputs[i];
    if (!out) { result = { kind: 'lose', reason: 'out-of-spells', turn: t - 1 }; break; }

    const turn = { turn: t, line: out.line, spell: out.text, hpBefore: hp, mpBefore: mp, ehpBefore: ehp, empBefore: emp, events: [] };
    let guarding = false;
    const known = SPELLS[out.text];
    const cost = out.text === 'attack' ? atkCost : known ? known.mp : MISFIRE_MP;

    if (t <= (player.stun ?? 0)) {
      turn.events.push({ who: 'you', kind: 'stunned' });
    } else if (out.text === '') {
      turn.events.push({ who: 'you', kind: 'empty' });
    } else if (mp < cost) {
      turn.events.push({ who: 'you', kind: 'no-mp', need: cost });
    } else if (!known) {
      mp -= cost;
      turn.events.push({ who: 'you', kind: 'misfire', mp: cost, glued: /\b(attack|guard)\w*(attack|guard)/.test(out.text) || /^(attack|guard){2,}$/.test(out.text) });
    } else if (out.text === 'attack') {
      mp -= cost;
      const dmg = attackDamage(player, enemy);
      ehp = Math.max(0, ehp - dmg);
      turn.events.push({ who: 'you', kind: 'attack', damage: dmg, mp: cost, bare: !!player.weapon?.bare, weapon: player.weapon?.name });
    } else if (out.text === 'guard') {
      mp -= cost; guarding = true;
      turn.events.push({ who: 'you', kind: 'guard', mp: cost });
    }

    if (ehp <= 0) {
      turn.events.push({ who: 'enemy', kind: 'defeated' });
      Object.assign(turn, { hp, mp, ehp, emp });
      turns.push(turn);
      result = { kind: 'win', turn: t };
      break;
    }

    // 敵の行動
    let kind = 'hit', raw = enemy.atk, pierce = false;
    const c = enemy.charge, m = enemy.mp;
    if (m) {
      // m.damage があれば防御を貫く決まったダメージ、なければ攻撃力の2倍
      if (emp >= m.cost) { kind = 'strong'; raw = m.damage ?? enemy.atk * 2; pierce = m.damage != null; emp -= m.cost; }
      emp = Math.min(m.max, emp + m.regen);
    } else if (c && t % c.every === 0) { kind = 'charge'; raw = c.damage; }
    const base = pierce ? raw : Math.max(1, raw - def);
    // guard はダメージ × 割合の切り捨て（int に入れるのと同じ）
    const dmg = guarding ? Math.floor(base * (player.guard ?? GUARD_DEFAULT)) : base;
    hp = Math.max(0, hp - dmg);
    turn.events.push({ who: 'enemy', kind, raw: base, damage: dmg, guarded: guarding });
    if (c && !m && kind !== 'charge' && (t + 1) % c.every === 0) turn.events.push({ who: 'enemy', kind: 'warn' });
    if (m && emp >= m.cost) turn.events.push({ who: 'enemy', kind: 'warn' });

    Object.assign(turn, { hp, mp, ehp, emp });
    turns.push(turn);
    if (hp <= 0) { result = { kind: 'lose', reason: 'hp', turn: t }; break; }
    if (t > 200) { result = { kind: 'lose', reason: 'too-long', turn: t }; break; }
  }
  return { turns, result };
}

const strongName = enemy => enemy.mp?.name ?? enemy.charge?.name;
const warnText = enemy => enemy.mp?.warnText ?? enemy.charge?.warnText;

// 1ターン分のメッセージ（ドラクエ風の文）
export function turnMessages(turn, enemy) {
  const msgs = [];
  for (const e of turn.events) {
    if (e.who === 'you') {
      if (e.kind === 'attack') {
        if (e.bare) msgs.push('＊あなたは すでで なぐりかかった！', '＊しかし ダメージを あたえられない！');
        else msgs.push(`＊あなたの attack！${e.weapon ? `（${e.weapon}）` : ''}`, `＊${enemy.name}に ${e.damage}の ダメージ！`);
      }
      if (e.kind === 'guard') msgs.push(`＊あなたは みを まもっている！`);
      if (e.kind === 'misfire') msgs.push(`＊あなたは 「${turn.spell}」と となえた！`, e.glued ? `＊じゅもんが くっついて ふはつに おわった……` : `＊しかし じゅもんは ふはつに おわった……`);
      if (e.kind === 'no-mp') msgs.push(`＊あなたは 「${turn.spell}」と となえた！`, `＊しかし まりょくが たりない！`);
      if (e.kind === 'empty') msgs.push(`＊あなたは なにも となえなかった。`);
      if (e.kind === 'stunned') msgs.push(`＊まりょくが ぼうそうしていて うごけない！`);
    } else {
      if (e.kind === 'defeated') msgs.push(`＊${enemy.name}を たおした！`);
      if (e.kind === 'hit') msgs.push(`＊${enemy.name}の ${enemy.attackName ?? 'こうげき'}！`, damageMsg(e));
      if (e.kind === 'charge' || e.kind === 'strong') msgs.push(`＊${enemy.name}の ${strongName(enemy)}！`, damageMsg(e));
      if (e.kind === 'warn') msgs.push(`＊${enemy.name}は ${warnText(enemy)}`);
    }
  }
  return msgs;
}

function damageMsg(e) {
  return e.guarded ? `＊みを まもって ${e.damage}の ダメージに おさえた！` : `＊あなたは ${e.damage}の ダメージを うけた！`;
}

// ログ表の1行（短い形）
export function turnSummary(turn, enemy) {
  let you = '', foe = '';
  for (const e of turn.events) {
    if (e.who === 'you') {
      if (e.kind === 'attack') you = e.bare ? 'attack 素手 0' : `attack ${e.damage}`;
      if (e.kind === 'guard') you = 'guard';
      if (e.kind === 'misfire') you = `${turn.spell} ふはつ`;
      if (e.kind === 'no-mp') you = `${turn.spell} MP不足`;
      if (e.kind === 'empty') you = '（なし）';
      if (e.kind === 'stunned') you = '魔力暴走';
    } else {
      if (e.kind === 'hit') foe = `${enemy.attackName ?? 'こうげき'} ${e.damage}`;
      if (e.kind === 'charge' || e.kind === 'strong') foe = `${strongName(enemy)} ${e.guarded ? `${e.raw}→${e.damage}` : e.damage}`;
      if (e.kind === 'warn' && enemy.charge) foe += ' ／ ちからを ためている';
      if (e.kind === 'defeated') foe = 'たおれた';
    }
  }
  return { you, foe, bad: turn.events.some(e => e.kind === 'misfire' || e.kind === 'no-mp' || e.kind === 'stunned' || e.bare) };
}
