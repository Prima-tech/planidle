const WebSocket = require('ws');
const fs = require('fs');

const PAGE_ID = '9441A12FC0435FE2164E6CFBB95B8410';
const ws = new WebSocket(`ws://localhost:9223/devtools/page/${PAGE_ID}`);
let msgId = 0;
const pending = new Map();

ws.on('message', d => {
  const m = JSON.parse(d);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});

const send = (method, params={}) => new Promise(res => {
  const id = ++msgId; pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});

ws.on('open', async () => {
  // Take screenshot
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
  fs.writeFileSync('C:/Temp/app-screen.jpg', Buffer.from(data, 'base64'));
  console.log('Screenshot saved to C:/Temp/app-screen.jpg');
  
  // Check current URL/route
  const { result: url } = await send('Runtime.evaluate', { expression: 'window.location.href' });
  console.log('URL:', url?.value);
  
  // Check app HTML structure
  const { result: html } = await send('Runtime.evaluate', { expression: 'document.body.innerHTML.substring(0, 500)' });
  console.log('Body snippet:', html?.value);
  
  process.exit(0);
});
