/* ゲームが裏で読み込む仕掛け（プレイヤーには見せない）。
 * printf / malloc / free を「何行目で使ったか」を報告する版に入れ替える。
 * 第2面から: 最初の printf の時点で attack / defense / hp / weapon の値を報告する。
 * プレイヤーが main の中で同じ名前の変数を書いていればそちらが読まれ、
 * 書いていなければ（綴りミス・書き忘れ）下の 0 が読まれる。 */
#include <stdio.h>
#include <stdlib.h>
int attack, defense, hp;
char weapon;
static int __magic_vars_sent;
static inline void __magic_vars(long a, long d, long h, int w) {
  if (__magic_vars_sent) return;
  __magic_vars_sent = 1;
  fprintf(stderr, "\001vars %ld %ld %ld %d\n", a, d, h, w);
}
static inline void __magic_line(int line) { fprintf(stderr, "\001line %d\n", line); }
static inline void *__magic_malloc(size_t n, int line) { void *p = malloc(n); fprintf(stderr, "\001malloc %d %lu\n", line, (unsigned long)p); return p; }
static inline void __magic_free(void *p, int line) { fprintf(stderr, "\001free %d %lu\n", line, (unsigned long)p); free(p); }
#define printf(...) (__magic_vars((long)(attack), (long)(defense), (long)(hp), (int)(weapon)), __magic_line(__LINE__), printf(__VA_ARGS__))
#define malloc(n) __magic_malloc((n), __LINE__)
#define free(p) __magic_free((p), __LINE__)
