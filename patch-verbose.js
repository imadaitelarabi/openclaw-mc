const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/api/ws');

ws.on('open', () => {
  console.log('Connected');
  
  setTimeout(() => {
    const payload = {
      type: 'sessions.patch',
      sessionKey: 'agent:new-agent-2:main',
      verbose: 'on'
    };
    console.log('Patching verbosity to ON:', payload);
    ws.send(JSON.stringify(payload));
  }, 1000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', msg.type);
  if (msg.type === 'sessions.patch.ack') {
    console.log('Verbosity patched successfully.');
    process.exit(0);
  }
});

setTimeout(() => { process.exit(1); }, 5000);
