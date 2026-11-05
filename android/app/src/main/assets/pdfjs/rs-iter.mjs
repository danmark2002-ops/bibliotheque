// Moteurs web avant Chrome 124 : un flux (ReadableStream) ne se parcourt pas avec « for await », dont pdf.js se sert.
if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
  const values = function (o) {
    const r = this.getReader(), keep = !!(o && o.preventCancel);
    return {
      next: () => r.read().then((x) => { if (x.done) { try { r.releaseLock(); } catch (e) { } } return x; }),
      return: (v) => { const p = keep ? Promise.resolve() : r.cancel(v).catch(() => {}); return p.then(() => { try { r.releaseLock(); } catch (e) { } return { done: true, value: v }; }); },
      [Symbol.asyncIterator]() { return this; },
    };
  };
  Object.defineProperty(ReadableStream.prototype, 'values', { value: values, writable: true, configurable: true });
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, { value: values, writable: true, configurable: true });
}
