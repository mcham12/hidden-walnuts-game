const WebSocket = require('ws');

console.log('🧪 Testing WebSocket Acknowledgment Optimization');

const ws = new WebSocket('wss://hidden-walnuts-preview.mattmcarroll.workers.dev/ws?squirrelId=test-ack-opt&token=test-token');
let ackCount = 0;
let updateCount = 0;

ws.on('open', () => {
  console.log('✅ Connected - sending player updates...');
  
  const updateInterval = setInterval(() => {
    ws.send(JSON.stringify({
      type: 'player_update', 
      position: {x: Math.random()*100, y: 0, z: Math.random()*100, rotationY: 0}
    }));
    updateCount++;
  }, 200); // Send every 200ms
  
  // Stop after 5 seconds
  setTimeout(() => {
    clearInterval(updateInterval);
    console.log(`\n📊 Test Results:`);
    console.log(`   Updates sent: ${updateCount}`);
    console.log(`   Acks received: ${ackCount}`);
    console.log(ackCount === 0 ? '✅ SUCCESS: No acknowledgment spam!' : '❌ ISSUE: Still receiving acks');
    ws.close();
  }, 5000);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    if (msg.type === 'ack') {
      ackCount++;
      console.log('⚠️  Received unexpected ack:', msg);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
}); 