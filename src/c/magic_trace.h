/* ゲームが裏で読み込む仕掛け（プレイヤーには見せない）。
 * printf / malloc / free を「何行目で使ったか」を報告する版に入れ替える。 */
#include <stdio.h>
#include <stdlib.h>
static inline void __magic_line(int line) { fprintf(stderr, "\001line %d\n", line); }
static inline void *__magic_malloc(size_t n, int line) { void *p = malloc(n); fprintf(stderr, "\001malloc %d %lu\n", line, (unsigned long)p); return p; }
static inline void __magic_free(void *p, int line) { fprintf(stderr, "\001free %d %lu\n", line, (unsigned long)p); free(p); }
#define printf(...) (__magic_line(__LINE__), printf(__VA_ARGS__))
#define malloc(n) __magic_malloc((n), __LINE__)
#define free(p) __magic_free((p), __LINE__)
