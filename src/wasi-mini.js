// プレイヤーのプログラム（WebAssembly）を動かすための最小限の WASI。
// printf / malloc / free / exit に必要な分だけ用意する。
export class ProcExit extends Error {
  constructor(code) { super(`exit ${code}`); this.code = code; }
}

export function createWasi({ onStdout, onStderr }) {
  let memory = null;
  const dec = new TextDecoder();
  const view = () => new DataView(memory.buffer);
  const bytes = () => new Uint8Array(memory.buffer);
  const ok = 0, EBADF = 8, ENOSYS = 52;

  const imports = {
    fd_write(fd, iovs, iovsLen, nwrittenPtr) {
      const v = view(); let total = 0; let text = '';
      for (let i = 0; i < iovsLen; i++) {
        const ptr = v.getUint32(iovs + i * 8, true), len = v.getUint32(iovs + i * 8 + 4, true);
        text += dec.decode(bytes().subarray(ptr, ptr + len), { stream: true }); total += len;
      }
      if (fd === 1) onStdout(text); else if (fd === 2) onStderr(text); else return EBADF;
      v.setUint32(nwrittenPtr, total, true); return ok;
    },
    fd_close: () => ok,
    fd_seek: () => ENOSYS,
    fd_read: () => ENOSYS,
    fd_fdstat_get(fd, statPtr) { const v = view(); v.setUint8(statPtr, 2); for (let i = 1; i < 24; i++) v.setUint8(statPtr + i, 0); return fd <= 2 ? ok : EBADF; },
    fd_prestat_get: () => EBADF,
    fd_prestat_dir_name: () => EBADF,
    environ_sizes_get(cPtr, sPtr) { view().setUint32(cPtr, 0, true); view().setUint32(sPtr, 0, true); return ok; },
    environ_get: () => ok,
    args_sizes_get(cPtr, sPtr) { view().setUint32(cPtr, 0, true); view().setUint32(sPtr, 0, true); return ok; },
    args_get: () => ok,
    clock_time_get(id, prec, outPtr) { view().setBigUint64(outPtr, BigInt(Math.round(performance.now() * 1e6)), true); return ok; },
    random_get(ptr, len) { crypto.getRandomValues(bytes().subarray(ptr, ptr + len)); return ok; },
    proc_exit(code) { throw new ProcExit(code); },
    sched_yield: () => ok,
  };
  return {
    imports: new Proxy(imports, { get: (t, k) => t[k] ?? (() => ENOSYS) }),
    setMemory(m) { memory = m; },
  };
}

export async function runWasm(wasmBytes, { onStdout, onStderr }) {
  const wasi = createWasi({ onStdout, onStderr });
  const { instance } = await WebAssembly.instantiate(wasmBytes, { wasi_snapshot_preview1: wasi.imports });
  wasi.setMemory(instance.exports.memory);
  try { instance.exports._start(); return 0; }
  catch (e) { if (e instanceof ProcExit) return e.code; throw e; }
}
