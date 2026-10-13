# Cの魔導書（第1面 試作）

C言語を書いて戦うドラクエ風の学習ゲーム。ブラウザだけで動く（サーバー不要）。

## 遊ぶ
https://takeislandpan.github.io/c-quest/ （PCのブラウザ向け）

main に push すると GitHub Actions が GitHub Pages に公開する（.github/workflows/pages.yml）。

## 手元で動かす
1. Node.js を入れる
2. `npm install`（Cコンパイラ @yowasp/clang 約105MBを取ってくる）
3. `npm start`（python3 で このフォルダを配信）
4. ブラウザで http://localhost:8765/ を開く

※ ファイルを直接ダブルクリックで開くと動かない（コンパイラの読み込みにWebサーバーが要る）。

## 入っているもの
- 冒頭: 入門ページで `#include <stdlich.h>` の Hello, World! を打って実行 → 転生 → 師匠と出会う
- 第1面: 歩きキノコ → 毒ガエル → 双子バチ → 石甲羅ガメ → 盗っ人カラス → ボス ヌシイノシシ
- コードを書く → 魔導書が開かない（英語原文＋日本語） → 戦闘（実行中の行が光る・1ターン1行のログ） → 勝ち／負け（ログで振り返り・段階ヒント）
- 地図: 学習ログ（挑戦回数・ヒント回数・エラーの種類・コードの変化量）、クリアしたコード、りれき
- セーブ: ブラウザ内に自動保存、「冒険の書」ファイルの書き出し・読み込み

## ファイル
- `src/main.js` 画面と流れ
- `src/battle.js` 戦闘の計算（ダメージ・MP・不発・ガード・突進）
- `src/data/stage1.js` 第1面の敵・テンプレ・台詞・ヒント（ザコの数値は仮）
- `src/compiler.js` ブラウザ内 clang でコンパイル・実行（仕掛けなし→仕掛けありの2回）
- `src/c/magic.h` プレイヤーが読む魔導書（本物） / `magic_trace.h` 裏で読み込む記録用の仕掛け / `stdlich.h` 冒頭用
- `src/errors.js` エラーの日本語一言 / `src/save.js` セーブ / `src/wasi-mini.js` プログラム実行用の最小WASI
- `screenshots/` 動作確認の画面
