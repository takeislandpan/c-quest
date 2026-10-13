// 戦闘の計算。画面とは切り離して、出力された呪文の列から1ターンずつの結果を作る。
// 決定事項: プレイヤーのn行目の出力とボスのn回目の行動を同じターンで処理（自分→敵の順）。
// 綴りミスは不発でMP消費。MPが足りないと詠唱失敗。全攻撃必中・運要素なし。

export const SPELLS = {
  attack: { mp: 2 },
  guard: { mp: 1 },
};
// 不発（知らない言葉）でも唱えた分の魔力は減る
export const MISFIRE_MP = 2;

// player: { hp, mp, atk }
// enemy:  { name, hp, atk, charge?: { every, damage, warnText, text } }
// outputs: [{ text, line }]  プログラムが出力した行（1行=1ターン）
export function simulate(outputs, player, enemy) {
  let hp = player.hp, mp = player.mp, ehp = enemy.hp;
  const turns = [];
  let result = null;

  for (let i = 0; ; i++) {
    const t = i + 1;
    const out = outputs[i];
    if (!out) { result = { kind: 'lose', reason: 'out-of-spells', turn: t - 1 }; break; }

    const turn = { turn: t, line: out.line, spell: out.text, hpBefore: hp, mpBefore: mp, ehpBefore: ehp, events: [] };
    let guarding = false;
    const known = SPELLS[out.text];
    const cost = known ? known.mp : MISFIRE_MP;

    if (out.text === '') {
      turn.events.push({ who: 'you', kind: 'empty' });
    } else if (mp < cost) {
      turn.events.push({ who: 'you', kind: 'no-mp', need: cost });
    } else if (!known) {
      mp -= cost;
      turn.events.push({ who: 'you', kind: 'misfire', mp: cost, glued: /\b(attack|guard)\w*(attack|guard)/.test(out.text) || /^(attack|guard){2,}$/.test(out.text) });
    } else if (out.text === 'attack') {
      mp -= cost; ehp = Math.max(0, ehp - player.atk);
      turn.events.push({ who: 'you', kind: 'attack', damage: player.atk, mp: cost });
    } else if (out.text === 'guard') {
      mp -= cost; guarding = true;
      turn.events.push({ who: 'you', kind: 'guard', mp: cost });
    }

    if (ehp <= 0) {
      turn.events.push({ who: 'enemy', kind: 'defeated' });
      Object.assign(turn, { hp, mp, ehp });
      turns.push(turn);
      result = { kind: 'win', turn: t };
      break;
    }

    const c = enemy.charge;
    const charging = c && t % c.every === 0;
    const raw = charging ? c.damage : enemy.atk;
    const dmg = guarding ? Math.floor(raw / 2) : raw;
    hp = Math.max(0, hp - dmg);
    turn.events.push({ who: 'enemy', kind: charging ? 'charge' : 'hit', raw, damage: dmg, guarded: guarding });
    if (c && !charging && (t + 1) % c.every === 0) turn.events.push({ who: 'enemy', kind: 'warn' });

    Object.assign(turn, { hp, mp, ehp });
    turns.push(turn);
    if (hp <= 0) { result = { kind: 'lose', reason: 'hp', turn: t }; break; }
    if (t > 200) { result = { kind: 'lose', reason: 'too-long', turn: t }; break; }
  }
  return { turns, result };
}

// 1ターン分のメッセージ（ドラクエ風の文）
export function turnMessages(turn, enemy) {
  const msgs = [];
  for (const e of turn.events) {
    if (e.who === 'you') {
      if (e.kind === 'attack') msgs.push(`＊あなたの attack！`, `＊${enemy.name}に ${e.damage}の ダメージ！`);
      if (e.kind === 'guard') msgs.push(`＊あなたは みを まもっている！`);
      if (e.kind === 'misfire') msgs.push(`＊あなたは 「${turn.spell}」と となえた！`, e.glued ? `＊じゅもんが くっついて ふはつに おわった……` : `＊しかし じゅもんは ふはつに おわった……`);
      if (e.kind === 'no-mp') msgs.push(`＊あなたは 「${turn.spell}」と となえた！`, `＊しかし まりょくが たりない！`);
      if (e.kind === 'empty') msgs.push(`＊あなたは なにも となえなかった。`);
    } else {
      if (e.kind === 'defeated') msgs.push(`＊${enemy.name}を たおした！`);
      if (e.kind === 'hit') msgs.push(`＊${enemy.name}の ${enemy.attackName ?? 'こうげき'}！`, damageMsg(e));
      if (e.kind === 'charge') msgs.push(`＊${enemy.name}の ${enemy.charge.name}！`, damageMsg(e));
      if (e.kind === 'warn') msgs.push(`＊${enemy.name}は ${enemy.charge.warnText}`);
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
      if (e.kind === 'attack') you = `attack ${e.damage}`;
      if (e.kind === 'guard') you = 'guard';
      if (e.kind === 'misfire') you = `${turn.spell} ふはつ`;
      if (e.kind === 'no-mp') you = `${turn.spell} MP不足`;
      if (e.kind === 'empty') you = '（なし）';
    } else {
      if (e.kind === 'hit') foe = `${enemy.attackName ?? 'こうげき'} ${e.damage}`;
      if (e.kind === 'charge') foe = `${enemy.charge.name} ${e.guarded ? `${e.raw}→${e.damage}` : e.damage}`;
      if (e.kind === 'warn') foe += ' ／ ちからを ためている';
      if (e.kind === 'defeated') foe = 'たおれた';
    }
  }
  return { you, foe, bad: turn.events.some(e => e.kind === 'misfire' || e.kind === 'no-mp') };
}
