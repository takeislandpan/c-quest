// 第2面「ちからを 言葉に」 変数と型
// ゴーレムとボスの数値は design/stage2-boss-numbers.md（候補D・候補G）。ザコ①〜④の数値は仮。
// 台詞は story/stage2.md の初稿から。

const HEAD = '#include <stdio.h>\n#include "magic.h"\n\nint main(void) {\n';
const TAIL = '    return 0;\n}\n';
const body = (vars, spells) => HEAD + [...vars, '', ...spells].map(l => (l ? `    ${l}\n` : '\n')).join('') + TAIL;
const stats = (a, d, h, w = "'S'") => [`int attack = ${a};`, `int defense = ${d};`, `int hp = ${h};`, `char weapon = ${w};`];
const casts = n => Array(n).fill('printf("attack\\n");');

// この面では、強さをプログラムの変数から読む（合計 SP まで）
export const PLAYER2 = { sp: 30, mp: 10 };

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
        ['師匠', 'お前の中には SP という力がある。この面では 30。それを attack、defense、hp の3つに分けて書く。'],
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
      stats: { sp: 30, mp: 4 },
      enemy: { name: '魔法人形', hp: 21, def: 0, atk: 6, attackName: 'まりょくだん' },
      task: '2回の攻撃で 人形を たおそう',
      template: HEAD + [
        ...stats(7, 11, 12),
        '',
        '// 剣は 1.5倍。power が 1回の 攻撃の つよさ',
        'double power = attack * 1.5;   // 7 × 1.5 = 10.5',
        '// 10.5 × 2回 = 21。ちょうど 倒せる……はず',
        '',
        ...casts(2),
      ].map(l => (l ? `    ${l}\n` : '\n')).join('') + TAIL,
      before: [
        ['師匠', 'この部屋は魔力が薄い。MP は 4、唱えられる attack は2回だけだ。'],
        ['師匠', 'double は小数も入る箱だ。剣は攻撃力を 1.5倍 にする。7 なら 10.5。2回で 21、ちょうど倒せる……はずだがな。'],
      ],
      afterLose: [
        ['あなた', '10 しか入ってない！ あと 1 だったのに。'],
        ['師匠', 'ダメージは整数だ。10.5 の .5 は切り捨てられる。'],
        ['師匠', 'double の箱なら 10.5 のまま入る。だが int に入れたとたん、小数は消える。どの箱に入れるか、それが「型」だ。'],
      ],
      after: [
        ['師匠', 'int は整数、double は小数、char は一文字。数の種類を、型という。'],
        ['あなた', '同じ 10.5 でも、入れる箱で結果が変わるのか。'],
      ],
      hints: ['戦う前の表示で、1回の攻撃のダメージはいくつ？', '7 × 1.5 = 10.5 は、ダメージにすると 10。切り捨てだ。', 'attack を 8 にする（どこかを 1 減らして合計 30 に）。8 × 1.5 = 12。'],
    },
    {
      id: 'golem', name: 'ゴーレム', place: '石の広間', sprite: 'assets/zako2_5_golem.png',
      enemy: { name: 'ゴーレム', hp: 42, def: 7, atk: 11, attackName: 'いしの こぶし' },
      task: 'SPの 分け方を 変えて 倒そう',
      template: body(stats(10, 10, 10), casts(5)),
      before: [
        ['師匠', '硬そうだな。とりあえず、力を均等に分けておいたぞ。'],
      ],
      afterLose: [
        ['あなた', 'あと少しで削りきれたのに、MPが尽きた……。'],
        ['師匠', '防御が 7 もあると、1回の攻撃から 7 引かれる。'],
        ['師匠', 'こいつの攻撃は、こちらの守りでほとんど止まっている。守りや体力を少し削ってでも、攻撃に回してみろ。'],
      ],
      after: [['師匠', '均等が一番とは限らん。相手を見て、箱の中身を決めるのだ。']],
      hints: ['ログを見よう。ゴーレムの残りHPは？ こちらの攻撃は1回いくつ？', '攻撃を 1 上げると 1.5倍で…… 11 × 1.5 = 16（切り捨て）、16 − 7 = 9。', 'attack を 11 にして、defense か hp を 1 減らす。'],
    },
    {
      id: 'boss2', name: 'ボス 番人の鎧', place: '修練場の奥', sprite: 'assets/boss2_yoroi.png', boss: true,
      stats: { sp: 30, mp: 11 },
      enemy: {
        name: '番人の鎧', hp: 42, def: 5, atk: 9, attackName: 'きりつけ',
        mp: { start: 1, max: 5, regen: 1, cost: 4, name: 'まりょく斬り', warnText: 'まりょくを みなぎらせている……' },
      },
      task: 'テンプレなし。変数も詠唱も 全部書こう',
      template: '',
      before: [
        ['師匠', '修練場の番人だ。ここからは手伝わん。変数も詠唱も、全部お前が書け。'],
        ['師匠', 'あいつも魔力を溜めて戦う。毎ターン 1 ずつ溜まり、4 溜まると大技が来る。ログの「てきMP」をよく見ておけ。'],
      ],
      afterLose: [
        ['師匠', '……まったく、世話の焼ける。立てるか。'],
        ['師匠', 'ログを見ろ。あいつの MP が 4 になったのは、何ターン目だ？'],
      ],
      after: [
        ['あなた', '勝った……！ 自分で決めた力で。'],
        ['師匠', '上出来だ。……ふう。'],
      ],
      hints: [
        'これまでの戦いのコードを思い出そう（地図から見返せる）。int attack = …; から書きはじめる。',
        '大技は 4ターン目と 8ターン目。均等（10/10/10）なら、4ターン目に guard を唱えると耐えられる。',
        '例: attack 11, defense 10, hp 9, weapon \'S\' で attack を5回。',
      ],
    },
  ],
};
