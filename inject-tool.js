const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/api/ws');

ws.on('open', () => {
  console.log('Connected');
  
  setTimeout(() => {
    const runId = 'test-tool-run';
    const payload = {
      type: 'event',
      event: 'agent',
      payload: {
        stream: 'tool',
        tool: 'test_tool',
        sessionKey: 'agent:new-agent-2:main',
        runId: runId,
        seq: 100,
        data: {
          phase: 'start',
          args: { query: 'testing tool cards' }
        }
      }
    };
    console.log('Injecting START tool event:', payload);
    ws.send(JSON.stringify(payload));

    setTimeout(() => {
        const endPayload = {
            type: 'event',
            event: 'agent',
            payload: {
              stream: 'tool',
              tool: 'test_tool',
              sessionKey: 'agent:new-agent-2:main',
              runId: runId,
              seq: 101,
              data: {
                phase: 'end',
                meta: { result: 'Success! Tool card is working.' }
              }
            }
          };
          console.log('Injecting END tool event');
          ws.send(JSON.stringify(endPayload));
          process.exit(0);
    }, 2000);
  }, 1000);
});

setTimeout(() => { process.exit(1); }, 10000);
