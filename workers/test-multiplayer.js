// Multiplayer WebSocket test script
// Tests broadcasting between two simulated players

const WebSocket = require('ws');

const player1Id = 'player1-' + Math.random().toString(36).substr(2, 9);
const player1Token = 'token1-' + Math.random().toString(36).substr(2, 9);
const player2Id = 'player2-' + Math.random().toString(36).substr(2, 9);
const player2Token = 'token2-' + Math.random().toString(36).substr(2, 9);

console.log('🎮 Starting multiplayer test...');
console.log(`Player 1: ${player1Id}`);
console.log(`Player 2: ${player2Id}`);

// Connect Player 1
const ws1Url = `wss://hidden-walnuts-preview.mattmcarroll.workers.dev/ws?squirrelId=${player1Id}&token=${player1Token}`;
const ws1 = new WebSocket(ws1Url);

ws1.on('open', () => {
  console.log('✅ Player 1 connected');
  
  // Connect Player 2 after Player 1 is connected
  setTimeout(() => {
    const ws2Url = `wss://hidden-walnuts-preview.mattmcarroll.workers.dev/ws?squirrelId=${player2Id}&token=${player2Token}`;
    const ws2 = new WebSocket(ws2Url);
    
    ws2.on('open', () => {
      console.log('✅ Player 2 connected');
      
      // Send player update from Player 1
      setTimeout(() => {
        console.log('📤 Player 1 sending position update...');
        ws1.send(JSON.stringify({
          type: 'player_update',
          position: { x: 10, y: 0, z: 15, rotationY: 1.5 }
        }));
      }, 500);
      
      // Send player update from Player 2
      setTimeout(() => {
        console.log('📤 Player 2 sending position update...');
        ws2.send(JSON.stringify({
          type: 'player_update',
          position: { x: -5, y: 2, z: 8, rotationY: 0.8 }
        }));
      }, 1000);
    });
    
    ws2.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'player_update') {
        console.log(`📨 Player 2 received update from ${message.squirrelId}:`, message.position);
      } else {
        console.log('📨 Player 2 received:', message);
      }
    });
    
    ws2.on('error', (error) => {
      console.error('❌ Player 2 error:', error);
    });
    
    ws2.on('close', () => {
      console.log('🔌 Player 2 disconnected');
    });
  }, 1000);
});

ws1.on('message', (data) => {
  const message = JSON.parse(data.toString());
  if (message.type === 'player_update') {
    console.log(`📨 Player 1 received update from ${message.squirrelId}:`, message.position);
  } else {
    console.log('📨 Player 1 received:', message);
  }
});

ws1.on('error', (error) => {
  console.error('❌ Player 1 error:', error);
});

ws1.on('close', () => {
  console.log('�� Player 1 disconnected');
});

// Close connections after 5 seconds
setTimeout(() => {
  console.log('🏁 Test complete, closing connections...');
  process.exit(0);
}, 5000);
