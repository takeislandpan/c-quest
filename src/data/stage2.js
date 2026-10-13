// 第2面「ちからを 言葉に」 変数と型
// ゴーレムとボスの数値は design/stage2-boss-numbers.md（候補D・候補G）。ザコ①〜④の数値は仮。
// 台詞は story/stage2.md の初稿から。

const HEAD = '#include <stdio.h>\n#include "magic.h"\n\nint main(void) {\n';
const TAIL = '    return 0;\n}\n';
const body = (vars, spells) => HEAD + [...vars, '', ...spells].map(l => (l ? `    ${l}\n` : '\n')).join('') + TAIL;
const stats = (a, d, h, w = "'S'") => [`int attack = ${a};`, `int defense = ${d};`, `int hp = ${h};`, `char weapon = ${w};`];
const casts = n => Array(n).fill('printf("attack\\n");');

// この面では、強さをプログラムの変数から読む（合計 SP まで）
export const PLAYER2 = { sp: 30, mp: 10, guardMp: 0 };

export const STAGE2 = {
  id: 'stage2',
  title: '第2面 ちからを 言葉に',
  learn: '変数と型（int / double / char）',
  stats: PLAYER2,
  lichGauge: '■■■■■■■■□□',
  epilogue: [
    [null, '＊修練場の 奥の かべに、ふるい 文字が きざまれている。'],
    [null, '＊「ここで まなんだ者は、かならず 力を 正しく かぞえよ」'],
    ['あなた', '師匠、これ……。'],
    ['師匠', '……昔の話だ。'],
    ['師匠', 'さて。今のお前は、自分で決めた力でしか戦えん。だが戦いとは、相手の出方を聞いてから決めるものだ。'],
    ['師匠', '次は、相手の言葉を聞く魔法を教えてやろう。'],
  ],
  battles: [
    {
      id: 'slime', name: 'スライム', place: '修練場の門', sprite: 'assets/zako2_1_slime.png',
      enemy: { name: 'スライム', hp: 12, def: 2, atk: 3, attackName: 'たいあたり' },
      task: 'attack の空欄（___）に 数を書こう（合計 30 まで）',
      template: body(['int attack = ___;', 'int defense = 10;', 'int hp = 10;', "char weapon = 'S';"], casts(3)),
      before: [
        ['師匠', 'ここは昔の修練場だ。魔法使いはここで、自分の力を言葉にすることを覚えた。'],
        ['師匠', 'お前の中には SP という力がある。今のお前なら 30。それを attack、defense、hp の3つに分けて書く。'],
        ['師匠', 'int attack = 10; と書けば、「attack という名の箱に 10 を入れる」という意味だ。int は整数を入れる箱だ。'],
        ['師匠', '書く場所は main の中、printf より前。唱える前に、自分の力を決めておくのだ。'],
        ['師匠', '空欄に数を入れてみろ。3つの合計が 30 を超えたら、魔力が暴走するぞ。'],
      ],
      after: [
        ['あなた', '数字を書いただけで、強さが決まった。'],
        ['師匠', '箱の中身を変えれば、詠唱も変わる。それが変数だ。'],
      ],
      hints: ['___ を消して数を書く。defense と hp で 20 使っているから、attack は 10 まで。', 'int attack = 10; にしてみよう。'],
    },
    {
      id: 'goblin', name: 'ゴブリン', place: '武器庫あと', sprite: 'assets/zako2_2_goblin.png',
      enemy: { name: 'ゴブリン', hp: 20, def: 3, atk: 5, attackName: 'こんぼう' },
      task: '書いておいた詠唱を唱えてみよう',
      template: body(['int atack = 10;', 'int defense = 10;', 'int hp = 10;', "char weapon = 'S';"], casts(2)),
      before: [['師匠', '次はゴブリンだ。詠唱は書いておいた。唱えてみろ。']],
      afterLose: [
        ['あなた', '攻撃が 1 しか入らない……。'],
        ['師匠', '戦う前の表示を見たか。attack が 0 と出ていたはずだ。'],
        ['師匠', '箱の名前は、一文字違えば別の箱だ。魔導書が読むのは attack という名の箱だけ。atack という箱は、誰も見ておらん。'],
      ],
      after: [['師匠', '箱の名前は magic.h に書いてある通りに。迷ったら開け。']],
      hints: ['戦う前の表示で、attack はいくつになっていた？', '1行目の箱の名前を magic.h と見比べよう。', 'int atack を int attack に直す。'],
    },
    {
      id: 'koumori', name: 'コウモリ', place: '暗い回廊', sprite: 'assets/zako2_3_koumori.png',
      enemy: { name: 'コウモリ', hp: 10, def: 0, atk: 4, attackName: 'かみつき' },
      task: '武器を ちゃんと 持とう',
      template: body(stats(10, 10, 10, "'s'"), casts(1)),
      before: [
        ['師匠', '次は武器だ。char は一文字だけを入れる箱。文字は \' \' で囲む。'],
        ['師匠', 'S なら剣、B なら弓、M なら杖。どれも magic.h に書いてある。書いておいたぞ。'],
      ],
      afterLose: [
        ['あなた', 'ダメージが 0……素手で殴ってる？'],
        ['師匠', '\'s\' と \'S\' は別の文字だ。Cは大文字と小文字をきっちり分ける。魔導書に載っている武器は大文字だけだ。'],
      ],
      after: [
        ['あなた', '1文字で、剣になったり素手になったりするんですね。'],
        ['師匠', 'そうだ。だから一文字も気を抜くな。'],
      ],
      hints: ['戦う前の表示で、weapon は何と出ていた？', 'magic.h の武器の欄を見よう。剣は何という文字？', "char weapon = 'S'; にする。"],
    },
    {
      id: 'ningyo', name: '魔法人形', place: '人形の間', sprite: 'assets/zako2_4_ningyo.png',
      stats: { sp: 30, mp: 6 },
      enemy: { name: '魔法人形', hp: 15, def: 6, atk: 6, attackName: 'まりょくだん' },
      task: '杖の 2回の攻撃で 人形を たおそう',
      template: HEAD + [
        'double power = 7.5;   // 師匠が はかった おまえの 力',
        'int attack = power;',
        'int defense = 10;',
        'int hp = 12;',
        "char weapon = 'M';",
        '',
        ...casts(2),
      ].map(l => (l ? `    ${l}\n` : '\n')).join('') + TAIL,
      before: [
        ['師匠', 'この人形は硬い。剣ではほとんど通らん。防御を無視する杖、M を持て。杖は 1回に MP を 3 使う。今のお前の MP では2回だ。'],
        ['師匠', 'お前の力をはかってみた。7.5 だ。'],
        ['師匠', 'これまでの int の箱には整数しか入らん。小数を入れるなら double という箱を使う。だから double power = 7.5; と書いておいた。'],
        ['師匠', '// から行の終わりまでは、ただのメモ書きだ。魔導書は読み飛ばす。わしの書き込みだと思っておけ。'],
        ['師匠', 'int attack = power; は、power の中身を attack の箱に移すという意味だ。'],
        ['師匠', '7.5 が2回で 15。人形の体力とちょうど同じだ。……さあ、唱えてみろ。'],
      ],
      afterLose: [
        ['あなた', '7 しか入ってない！ 7.5 を入れたはずなのに。'],
        ['師匠', '戦う前の表示を見ろ。attack は 7 になっていたはずだ。'],
        ['師匠', 'attack は int の箱だ。int には整数しか入らん。double の 7.5 を int に移したとたん、.5 は切り捨てられる。'],
        ['師匠', 'どの箱に入れるかで、中身が変わる。箱の種類を「型」という。'],
      ],
      after: [
        ['師匠', 'int は整数、double は小数、char は一文字。'],
        ['あなた', '同じ 7.5 でも、入れる箱で 7 になるのか。'],
      ],
      hints: ['戦う前の表示で、attack はいくつになっていた？', 'int の箱に 7.5 を入れると、小数は切り捨てられて 7 になる。', 'int attack = 8; と書く。SP は合計 30 まで使えるので、まだ 1 余っている。'],
    },
    {
      id: 'golem', name: 'ゴーレム', place: '石の広間', sprite: 'assets/zako2_5_golem.png',
      enemy: {
        name: 'ゴーレム', hp: 36, def: 7, atk: 3, attackName: 'いしの こぶし',
        mp: { start: 5, max: 5, regen: 1, cost: 4, damage: 28, name: 'いわおとし', warnText: 'まりょくを ためこんでいる……' },
      },
      task: 'guard の 割合を 小さくして 岩を 受けとめよう',
      template: HEAD + [
        'int attack = 13;',
        'int defense = 5;',
        'int hp = 12;',
        "char weapon = 'S';",
        'double guard = 0.5;   // guard したときに 受ける ダメージの 割合',
        '',
        'printf("guard\\n");',
        ...casts(3),
      ].map(l => (l ? `    ${l}\n` : '\n')).join('') + TAIL,
      before: [
        ['師匠', 'ゴーレムだ。腹に魔力を溜めこんでいる。右の「MP」を見ろ、もう満ちている。最初の一撃で岩を落としてくるぞ。'],
        ['師匠', '岩落としは防御では止まらん。28 がそのまま来る。だから最初は guard だ。'],
        ['師匠', 'guard で受けるダメージは、guard という箱に書いた割合になる。0.5 なら半分だ。'],
        ['師匠', '割合は 0.5 のような小数だから、int ではなく double の箱に入れる。書いておいたぞ。唱えてみろ。'],
      ],
      afterLose: [
        ['あなた', 'guard したのに 14 も……。hp 12 じゃ耐えられない。'],
        ['師匠', '28 の半分は 14 だからな。guard の割合を小さくすれば、受けるダメージも減る。0.3 なら 28 × 0.3 = 8.4、切り捨てて 8 だ。'],
        ['師匠', 'ただし、割合を 0.1 下げるごとに SP を 1 使う。0.3 なら 2 だ。どこかを 2 減らして、合計を 30 に収めろ。'],
      ],
      after: [
        ['師匠', 'int は数を数える箱、double は割合や小数の箱。使い分けられれば一人前だ。'],
        ['あなた', '0.5 と 0.3 の違いで、生き残れるかどうかが変わるのか。'],
      ],
      hints: [
        'ログを見よう。1ターン目に いくつ ダメージを 受けた？',
        'guard を 0.3 にすると 28 × 0.3 = 8.4 → 8。そのかわり SP を 2 使う。',
        'double guard = 0.3; にして、defense を 5 から 3 に減らす。',
      ],
    },
    {
      id: 'boss2', name: 'ボス 番人の鎧', place: '修練場の奥', sprite: 'assets/boss2_yoroi.png', boss: true,
      stats: { sp: 30, mp: 11 },
      enemy: {
        name: '番人の鎧', hp: 40, def: 5, atk: 3, attackName: 'きりつけ',
        mp: { start: 5, max: 5, regen: 1, cost: 4, damage: 26, name: 'まりょく斬り', warnText: 'まりょくを みなぎらせている……' },
      },
      task: 'テンプレなし。変数も詠唱も 全部書こう',
      template: '',
      before: [
        ['師匠', '修練場の番人だ。ここからは手伝わん。変数も詠唱も、全部お前が書け。'],
        ['師匠', 'あいつも魔力を溜めて、満ちると大技を撃つ。防御を貫く 26 だ。いつ来るかは、あいつの MP を見ればわかる。'],
        ['師匠', '攻撃を上げて押しきろうとしても無駄だ。守るときは守れ。'],
      ],
      afterLose: [
        ['師匠', '……まったく、世話の焼ける。立てるか。'],
        ['師匠', 'ログを見ろ。大技が来たのは何ターン目だ？ そのとき guard していたか？ 割合はいくつだった？'],
      ],
      after: [
        ['あなた', '勝った……！ 自分で決めた力で。'],
        ['師匠', '上出来だ。……ふう。'],
      ],
      hints: [
        'ゴーレム戦のコードを思い出そう（地図から見返せる）。int の箱と double guard を両方書く。',
        'あいつの MP は最初から 5。4 以上あると大技なので 1ターン目に来る。そのあと毎ターン 1 ずつ溜まって、次は 4ターン目。',
        '例: attack 13, defense 3, hp 12, double guard = 0.3（SP 2）の剣で guard, attack, attack, attack。',
      ],
    },
  ],
};
