// Cのコードに色をつける（1行ずつ。エディタと、戦闘・エラー画面のコード表示で使う）
const KEYWORDS = new Set(['int', 'void', 'char', 'double', 'float', 'long', 'short', 'unsigned', 'signed', 'const', 'static',
  'return', 'if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default', 'break', 'continue',
  'struct', 'typedef', 'enum', 'sizeof', 'NULL']);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const span = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;

export function highlightLine(line) {
  // #include などの行: 命令とファイル名を分けて色づけ
  const pp = line.match(/^(\s*)(#\s*\w+)(.*)$/);
  if (pp) {
    const rest = pp[3].replace(/^(\s*)(<[^>]*>?|"[^"]*"?)(.*)$/, (_, sp, file, tail) => `${esc(sp)}${span('hl-str', file)}${highlightLine(tail)}`);
    return esc(pp[1]) + span('hl-pp', pp[2]) + (rest === pp[3] ? highlightLine(pp[3]) : rest);
  }
  let out = '';
  const re = /(\/\*.*?(\*\/|$)|\/\/.*$)|("(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)/g;
  let last = 0, m;
  while ((m = re.exec(line))) {
    out += esc(line.slice(last, m.index));
    if (m[1]) out += span('hl-com', m[0]);
    else if (m[3]) out += `<span class="hl-str">${esc(m[0]).replace(/\\[nt0\\'"]/g, x => `<span class="hl-esc">${x}</span>`)}</span>`;
    else if (m[4]) out += span('hl-num', m[0]);
    else if (KEYWORDS.has(m[0])) out += span('hl-kw', m[0]);
    else if (/^(printf|scanf|malloc|free|puts|main)$/.test(m[0])) out += span('hl-fn', m[0]);
    else out += esc(m[0]);
    last = re.lastIndex;
  }
  return out + esc(line.slice(last));
}

export function highlight(code) {
  return code.split('\n').map(highlightLine).join('\n');
}
