// 第1面「はじめの詠唱」 printf
// ザコ戦の数値は仮（ボスは design/sim/stage1_sim.py で確認済み）。
// 台詞は story/stage1.md の初稿から。

const HEAD = '#include <stdio.h>\n#include "magic.h"\n\nint main(void) {\n';
const TAIL = '    return 0;\n}\n';
const body = (...lines) => HEAD + lines.map(l => `    ${l}\n`).join('') + TAIL;

export const PLAYER = { hp: 15, mp: 10, atk: 4 };

export const STAGE1 = {
  id: 'stage1',
  title: '第1面 はじめの詠唱',
  learn: 'printf',
  // ボスを倒したあと（師匠MPを一瞬見せてから）
  lichGauge: '■■■■■■■■■□',
  epilogue: [
    [null, '＊むらに もどると、村人たちが あなたの詠唱を ふしぎそうに 見ている。'],
    ['村人', 'その呪文、ずいぶん古い書き方だねえ。ばあちゃんの昔話でしか聞いたことないよ。'],
    ['師匠', '（小さく）……昔話、か。'],
    ['師匠', '今のお前は、決まった言葉を順に唱えることしかできん。だが本物の魔法使いは、自分の力そのものを言葉で形にする。'],
    ['師匠', '森の向こうに、昔の修練場がある。次はそこだ。'],
  ],
  battles: [
    {
      id: 'kinoko', name: '歩きキノコ', place: '森の入口', sprite: 'assets/zako1_kinoko.png',
      enemy: { name: '歩きキノコ', hp: 4, atk: 1, attackName: 'たいあたり' },
      task: '空欄（______）に attack と書こう',
      template: body('printf("______\\n");'),
      before: [
        ['師匠', 'Cの詠唱はこう書く。まずは形だけ覚えればいい。'],
        ['師匠', '上の2行は魔法書を手元に開く合図だ。<stdio.h> は誰もが持っている標準の魔法書。だから < > で囲む。'],
        ['師匠', '"magic.h" はお前の手元にあるこの本。自分の持ち物は " " で囲む。'],
        ['師匠', 'int main(void) { が詠唱の始まり、最後の } が終わり。return 0; は締めの言葉だ。今はおまじないだと思っておけ。'],
        ['師匠', '肝心なのは真ん中。printf("……") の中に、魔導書に書かれた魔法を書き込めば、それが発動する。'],
        ['師匠', '詠唱には魔力（MP）を使う。attack は2。尽きたら唱えられん。'],
      ],
      after: [
        ['あなた', '本当に出た……！'],
        ['師匠', 'うむ。1行書けば1回唱える。それがCの詠唱だ。'],
      ],
      hints: ['______ を消して、attack と書く。', 'printf("attack\\n"); になっていれば正解だ。'],
    },
    {
      id: 'gaeru', name: '毒ガエル', place: '沼', sprite: 'assets/zako2_gaeru.png',
      enemy: { name: '毒ガエル', hp: 8, atk: 2, attackName: 'どくの したで こうげき' },
      task: '綴りを直して倒そう（magic.h で確認できる）',
      template: body('printf("atack\\n");', 'printf("attack\\n");'),
      before: [
        ['師匠', '次は毒ガエルだ。詠唱は書いておいた。まずはそのまま唱えてみろ。'],
      ],
      afterLose: [
        ['あなた', '1行目、何も起きなかった。MPだけ減ってる。'],
        ['師匠', '綴りが違う。魔法は一文字違えば別の言葉だ。しかも唱えた分の魔力は戻らん。'],
        ['師匠', '使える呪文はこの本、magic.h に全部書いてある。迷ったらいつでも開け。'],
      ],
      after: [
        ['あなた', 'さっき魔導書にあった guard って、何なんですか？'],
        ['師匠', '身を守る詠唱だ。唱えたターンだけ、受ける痛みが半分になる。魔力も1で済む。'],
        ['師匠', 'ただし、守っている間は攻撃できん。いつ守るか、それを考えるのも詠唱のうちだ。'],
      ],
      hints: ['ログを見よう。不発になったのは何ターン目？', 'magic.h を開いて、attack の綴りと見比べよう。', '1行目を printf("attack\\n"); に直す。'],
    },
    {
      id: 'bachi', name: '双子バチ', place: '花畑', sprite: 'assets/zako3_bachi.png',
      enemy: { name: '双子バチ', hp: 8, atk: 2, attackName: 'どくばり' },
      task: '呪文がくっつかないようにしよう',
      template: body('printf("attack");', 'printf("attack\\n");'),
      before: [
        ['師匠', '2回唱えれば倒せる相手だ。書いておいたぞ。'],
      ],
      afterLose: [
        ['あなた', '2回唱えたはずなのに、1つの変な言葉になってる。'],
        ['師匠', '\\n は「ここで息継ぎ」の印だ。息継ぎしないと、2つの呪文が1つにくっついて別物になる。'],
        ['師匠', '1行に1つの呪文。行の終わりには必ず \\n。覚えておけ。'],
      ],
      after: [['師匠', 'うむ。息継ぎを忘れるな。']],
      hints: ['ログの1ターン目、何と唱えている？', '1行目の attack のあとに \\n がない。', '1行目を printf("attack\\n"); にする。'],
    },
    {
      id: 'kame', name: '石甲羅ガメ', place: '岩場', sprite: 'assets/zako4_kame.png',
      enemy: { name: '石甲羅ガメ', hp: 8, atk: 2, attackName: 'かみつき' },
      task: '魔導書が開くようにしよう',
      template: body('printf("attack\\n")', 'printf("attack\\n");'),
      before: [['師匠', '硬そうなカメだな。まあ、唱えてみろ。']],
      afterError: [
        ['あなた', '戦う前に止まった！'],
        ['師匠', '命令の終わりには ;。これがないと、ページが次のページとくっついて本が開かん。'],
        ['師匠', '本が開かなければ、一言も唱えられんぞ。戦場に出る前に気づけて幸いだったと思え。'],
      ],
      after: [
        ['師匠', '……ふう。'],
        ['あなた', '師匠、今ため息つきました？'],
        ['師匠', '気のせいだ。'],
      ],
      hints: ['エラーに出ている行番号を見よう。', '行の終わりに ; が足りない行がある。', '1つ目の printf の行の最後に ; を足す。'],
    },
    {
      id: 'karasu', name: '盗っ人カラス', place: '古い祠', sprite: 'assets/zako5_karasu.png',
      enemy: { name: '盗っ人カラス', hp: 4, atk: 2, attackName: 'つつき' },
      task: '盗まれたページを取り戻そう',
      template: '#include "magic.h"\n\nint main(void) {\n    printf("attack\\n");\n    return 0;\n}\n',
      before: [['あなた', 'あっ、カラスが魔導書のページを！']],
      afterError: [
        ['師匠', 'printf という唱え方は、標準の魔法書 stdio.h に載っている。それを開かずに唱えようとしても無理だ。'],
        ['あなた', '最初の2行、おまじないじゃなかったんですね。'],
        ['師匠', 'おまじないでもある。だが、意味のないおまじないなど一つもない。'],
      ],
      after: [['師匠', 'ページは取り戻したな。']],
      hints: ['エラーは「printf を知らない」と言っている。', 'printf が載っている魔法書は stdio.h。', '1行目に #include <stdio.h> を書き戻す。'],
    },
    {
      id: 'boss', name: 'ボス ヌシイノシシ', place: '森の奥', sprite: 'assets/boss1.png', boss: true,
      enemy: {
        name: 'ヌシイノシシ', hp: 16, atk: 3, attackName: 'たいあたり',
        charge: { every: 3, damage: 10, name: 'とっしん', warnText: 'ちからを ためている……' },
      },
      task: 'テンプレなし。最初の1行から全部書こう',
      template: '',
      before: [
        ['師匠', 'ここからは手伝わん。最初の1行から、全部お前が書け。'],
        ['あなた', 'えっ'],
        ['師匠', '書いたものは全部見てきたはずだ。……それに、よく見ろ。あいつは突進の前に必ず力をためる。'],
      ],
      afterLose: [
        ['師匠', '……まったく、世話の焼ける。立てるか。'],
        ['師匠', 'ログを見ろ。何ターン目に、何を食らった？'],
      ],
      after: [
        ['あなた', '勝った……自分で書いた詠唱で。'],
        ['師匠', '上出来だ。……ふむ、少し疲れたな。'],
      ],
      hints: [
        'これまでの戦いで書いたコードを思い出そう（地図から見返せる）。',
        '突進は3ターン目。そのターンに guard を唱えると半分になる。',
        'attack, attack, guard, attack, attack の順に5行書く。',
      ],
    },
  ],
};
