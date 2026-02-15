const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const token = "82d697166880aa472750b615bddeb334b819fef6d721e03b";
const ws = new WebSocket('ws://127.0.0.1:18789', {
    headers: { 'Origin': 'http://localhost:3001' }
});

ws.on('open', () => {
  console.log('Connected');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    console.log('Authenticating...');
    ws.send(JSON.stringify({
      type: 'req',
      id: uuidv4(),
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: 'openclaw-control-ui', version: '1.0', platform: 'node', mode: 'ui' },
        role: 'operator',
        scopes: ['operator.admin'],
        auth: { token }
      }
    }));
  } else if (msg.type === 'res' && msg.ok) {
    console.log('Auth success / Request success');
    
    // If this was the auth response (we can guess), try chat
    // Actually better to wait for auth success but let's just fire it after a delay
  } else if (msg.type === 'event') {
    console.log('EVENT:', msg.event, JSON.stringify(msg.payload).substring(0, 100));
  } else {
    console.log('MSG:', JSON.stringify(msg));
  }
});

setTimeout(() => {
    console.log('Sending chat...');
    ws.send(JSON.stringify({
        type: 'req',
        id: uuidv4(),
        method: 'chat.send',
        params: {
            sessionKey: 'agent:main:main',
            message: 'Hello from Test Script',
            deliver: true
        }
    }));
}, 2000);
