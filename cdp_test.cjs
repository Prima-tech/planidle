const WebSocket = require('ws');

const PAGE_ID = '9441A12FC0435FE2164E6CFBB95B8410';
const ws = new WebSocket(`ws://localhost:9223/devtools/page/${PAGE_ID}`);
let msgId = 0;
const pending = new Map();
const logs = [];

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
    logs.push(`[${msg.params.type}] ${text}`);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    logs.push(`[EXC] ${msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text}`);
  }
});

const send = (method, params={}) => new Promise(res => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});

ws.on('open', async () => {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:4200' });
  await new Promise(r => setTimeout(r, 9000));

  const { result: r1 } = await send('Runtime.evaluate', { expression: 'document.title' });
  console.log('Title:', r1?.value);
  
  const { result: r2 } = await send('Runtime.evaluate', { expression: 'document.querySelector("canvas") ? "canvas found" : "no canvas"' });
  console.log('Canvas:', r2?.value);

  console.log('\n=== Console (first 60) ===');
  logs.slice(0, 60).forEach(l => console.log(l));
  console.log('Total logs:', logs.length);
  
  process.exit(0);
});
ws.on('error', e => { console.error('WS error:', e.message); process.exit(1); });
