const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/api/ws');

ws.on('open', () => {
  console.log('Connected');
  
  // Wait for initial messages
  setTimeout(() => {
    const payload = {
      type: 'sessions.list'
    };
    console.log('Sending:', payload);
    ws.send(JSON.stringify(payload));
  }, 1000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', msg);
  if (msg.type === 'sessions') {
    console.log('Sessions:', JSON.stringify(msg.data, null, 2));
  }
});

ws.on('close', () => console.log('Closed'));
ws.on('error', (err) => console.error('Error:', err));