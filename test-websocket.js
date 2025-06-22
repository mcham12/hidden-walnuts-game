// Quick WebSocket test script
// Run with: node test-websocket.js

const WebSocket = require('ws');

const squirrelId = 'test-' + Math.random().toString(36).substr(2, 9);
const token = 'test-token-' + Math.random().toString(36).substr(2, 9);

console.log(`Testing WebSocket connection with squirrelId: ${squirrelId}`);

const wsUrl = `wss://hidden-walnuts-preview.mattmcarroll.workers.dev/ws?squirrelId=${squirrelId}&token=${token}`;
console.log(`Connecting to: ${wsUrl}`);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✅ WebSocket connection established');
  
  // Send a test message
  ws.send(JSON.stringify({ type: 'test', message: 'Hello from test script' }));
});

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString());
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Connection closed: ${code} ${reason}`);
  process.exit(0);
});

// Close after 5 seconds
setTimeout(() => {
  console.log('Closing connection...');
  ws.close();
}, 5000); 