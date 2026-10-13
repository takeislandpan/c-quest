// プレイヤーのCコードをブラウザ内の clang でコンパイルし、実行する。
// 1回目: 仕掛けなしでコンパイル（エラー文をそのまま見せるため）
// 2回目: 仕掛けあり(-include magic_trace.h)でコンパイルして実行し、行番号を記録する
import { runWasm } from './wasi-mini.js';

const CLANG_URL = new URL('../node_modules/@yowasp/clang/gen/bundle.js', import.meta.url);
const HEADER_URLS = ['magic.h', 'magic_trace.h', 'stdlich.h'].map(n => [n, new URL(`./c/${n}`, import.meta.url)]);

let clangPromise = null;
let headers = null;

// 冒頭の画面などで早めに呼んで、裏で読み込んでおく
export function preloadCompiler(onProgress) {
  clangPromise ??= (async () => {
    const mod = await import(CLANG_URL.href);
    headers = Object.fromEntries(await Promise.all(HEADER_URLS.map(async ([n, u]) => [n, await (await fetch(u)).text()])));
    // 1回空打ちして本体（約105MB）を読み込ませる
    await mod.runClang(['clang', '--version'], {}, { stdout: null, stderr: null, fetchProgress: onProgress && (e => onProgress(e.doneLength, e.totalLength)) });
    return mod;
  })();
  return clangPromise;
}

async function clang(source, extraArgs) {
  const { runClang } = await preloadCompiler();
  let log = '';
  const opts = { stdout: b => { if (b) log += new TextDecoder().decode(b); }, stderr: b => { if (b) log += new TextDecoder().decode(b); } };
  const files = { 'main.c': source, 'magic.h': headers['magic.h'], 'stdlich.h': headers['stdlich.h'], 'magic_trace.h': headers['magic_trace.h'] };
  try {
    const out = await runClang(['clang', '-fno-color-diagnostics', '-I.', ...extraArgs, 'main.c', '-o', 'a.wasm'], files, opts);
    return { ok: true, wasm: out['a.wasm'], log };
  } catch (e) {
    return { ok: false, log };
  }
}

// エラー文を1件ずつに分ける: { line, col, kind: 'error'|'warning', message, text }
export function parseDiagnostics(log) {
  const items = [];
  for (const block of log.split(/\n(?=main\.c:\d+:\d+: )/)) {
    const m = block.match(/^main\.c:(\d+):(\d+): (fatal error|error|warning): (.*)/m);
    if (m) items.push({ line: +m[1], col: +m[2], kind: m[3] === 'warning' ? 'warning' : 'error', message: m[4], text: block.trim() });
  }
  return items;
}

// 戻り値: { ok:false, diagnostics } または { ok:true, warnings, outputLines:[{text,line}], allocs, exitCode }
export async function compileAndRun(source) {
  const check = await clang(source, []);
  const diagnostics = parseDiagnostics(check.log);
  if (!check.ok) {
    // リンクのエラー（main がない等）は main.c:行: の形にならないので、まとめて1件にする
    if (!diagnostics.some(d => d.kind === 'error')) {
      const first = check.log.split('\n').find(l => /error/.test(l)) ?? 'error';
      diagnostics.push({ line: null, col: null, kind: 'error', message: first.replace(/^.*?error:\s*/, ''), text: check.log.trim() });
    }
    return { ok: false, diagnostics };
  }

  const traced = await clang(source, ['-include', 'magic_trace.h']);
  if (!traced.ok) return { ok: false, diagnostics: parseDiagnostics(traced.log), internal: traced.log };

  let stdout = '', lineQueue = [];
  const outputLines = [];
  const allocs = new Map(); const events = [];
  const flush = () => {
    let i;
    while ((i = stdout.indexOf('\n')) >= 0) {
      outputLines.push({ text: stdout.slice(0, i), line: lineQueue.shift() ?? null });
      stdout = stdout.slice(i + 1);
    }
  };
  let errBuf = '';
  const exitCode = await runWasm(traced.wasm, {
    onStdout: t => { stdout += t; flush(); },
    onStderr: t => {
      errBuf += t; let i;
      while ((i = errBuf.indexOf('\n')) >= 0) {
        const l = errBuf.slice(0, i); errBuf = errBuf.slice(i + 1);
        if (!l.startsWith('\x01')) continue;
        const [kind, line, ptr] = l.slice(1).split(' ');
        if (kind === 'line') lineQueue.push(+line);
        else { events.push({ kind, line: +line, ptr }); if (kind === 'malloc') allocs.set(ptr, +line); else allocs.delete(ptr); }
      }
    },
  });
  if (stdout) { outputLines.push({ text: stdout, line: lineQueue.shift() ?? null, noNewline: true }); }
  return { ok: true, warnings: diagnostics, outputLines, leaks: [...allocs.values()], memEvents: events, exitCode };
}
