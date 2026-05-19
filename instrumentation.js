/**
 * Next 构建/启动早期注入 Node 18 缺失的 Web API（File/Blob）
 */
export async function register() {
  if (typeof globalThis.File === 'undefined') {
    const { Blob, File } = await import('node:buffer');
    globalThis.File = File;
    globalThis.Blob = Blob;
  }
}
