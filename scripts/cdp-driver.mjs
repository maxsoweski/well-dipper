// Minimal Chrome DevTools Protocol driver — stands in for the chrome-devtools MCP server, which
// failed to connect this session. Node 24 has native WebSocket, so this needs no dependencies.
const PORT = 9223;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((p) => p.type === 'page' && p.url.endsWith('/well-dipper/'));
if (!page) { console.error('game page not found'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { error: String(r.result.exceptionDetails.exception?.description).slice(0, 300) };
  return r.result?.result?.value;
}
export async function key(k, code, keyCode) {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, text: type === 'keyDown' && k.length === 1 ? k : undefined });
    await sleep(25);
  }
  await sleep(150);
}
export async function click(x, y) {
  for (const type of ['mousePressed', 'mouseReleased']) { await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(35); }
  await sleep(180);
}
export async function shot(path) {
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78 });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(path, Buffer.from(r.result.data, 'base64'));
  return path;
}
export { sleep, ws };
