// コンパイルエラー（英語原文）に、日本語の一言解説をつける。
// 決定事項: 英語原文＋日本語一言。コンパイルエラー＝「魔導書が開かない」。

const RULES = [
  { kind: 'semicolon', test: /expected ';'/, title: 'ページが くっついている', note: '命令の終わりの ; を忘れていないか？' },
  { kind: 'include', test: /undeclared (library )?function 'printf'|implicit declaration of function 'printf'/, title: '魔法書を 持っていない', note: '#include <stdio.h> を忘れていないか？' },
  { kind: 'header-missing', test: /'(.+)' file not found/, title: 'そんな 魔法書は ない', note: m => `${m[1]} という名前の魔法書は見つからない。綴りを確かめよう。` },
  { kind: 'unterminated', test: /missing terminating '?"'? character|unterminated string/, title: '封が 閉じていない', note: '" の閉じ忘れがないか？' },
  { kind: 'brace', test: /expected '\}'|extraneous closing brace/, title: '封が 閉じていない', note: '{ と } の数が合っているか？' },
  { kind: 'paren', test: /expected '\)'/, title: '封が 閉じていない', note: '( と ) の数が合っているか？' },
  { kind: 'blank', test: /use of undeclared identifier '_+'/, title: '空欄が のこっている', note: '___ のところに 数や言葉を 書こう。' },
  { kind: 'char-quote', test: /initializing 'char' with an expression of type 'char ?\[\d+\]'|incompatible pointer to integer conversion.*'char'/, title: '1文字の箱に 文字列', note: "char には 1文字だけ。' '（シングルクォート）で囲む。\"S\" ではなく 'S'。" },
  { kind: 'undeclared', test: /use of undeclared identifier '(.+)'/, title: '知らない 言葉', note: m => /^(attack|defense|hp|weapon)$/.test(m[1]) ? `${m[1]} という箱が まだ作られていない。箱を作るときは int ${m[1]} = 10; のように 型から書く。` : `${m[1]} という言葉は、まだどこにも書かれていない。綴りを確かめよう。` },
  { kind: 'main', test: /undefined symbol: main|undefined reference to [`']main/, title: '詠唱の 始まりが ない', note: 'int main(void) { … } を書いたか？' },
  { kind: 'escape', test: /unknown escape sequence/, title: 'あやしい 記号', note: '\\n の向きは合っているか？（/ ではなく \\）' },
];

export function explain(diag) {
  for (const r of RULES) {
    const m = diag.message.match(r.test) || diag.text.match(r.test);
    if (m) return { kind: r.kind, title: r.title, note: typeof r.note === 'function' ? r.note(m) : r.note };
  }
  return { kind: 'other', title: '魔導書が 開かない', note: '英語のメッセージと、示された行をよく見てみよう。' };
}
