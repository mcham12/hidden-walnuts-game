const WebSocket = require('ws');

const API_BASE = 'https://hidden-walnuts-preview.mattmcarroll.workers.dev';

// Test environment rendering and multiplayer functionality
async function testEnvironmentAndMultiplayer() {
  console.log('🧪 Testing Environment Rendering and Multiplayer Functionality\n');

  // Test 1: Check API endpoints
  console.log('📡 Testing API endpoints...');
  
  try {
    // Test forest-objects endpoint
    const forestResponse = await fetch(`${API_BASE}/forest-objects`);
    if (forestResponse.ok) {
      const forestData = await forestResponse.json();
      console.log(`✅ /forest-objects: ${forestData.length} objects`);
    } else {
      console.log(`❌ /forest-objects failed: HTTP ${forestResponse.status}`);
    }

    // Test map-state endpoint
    const mapResponse = await fetch(`${API_BASE}/map-state`);
    if (mapResponse.ok) {
      const mapData = await mapResponse.json();
      console.log(`✅ /map-state: ${mapData.length} walnuts`);
    } else {
      console.log(`❌ /map-state failed: HTTP ${mapResponse.status}`);
    }

    // Test terrain-seed endpoint
    const terrainResponse = await fetch(`${API_BASE}/terrain-seed`);
    if (terrainResponse.ok) {
      const terrainData = await terrainResponse.json();
      console.log(`✅ /terrain-seed: ${terrainData.seed}`);
    } else {
      console.log(`❌ /terrain-seed failed: HTTP ${terrainResponse.status}`);
    }
  } catch (error) {
    console.error('❌ API endpoint test failed:', error.message);
  }

  console.log('\n🎮 Testing multiplayer WebSocket functionality...');

  // Test 2: Multiplayer WebSocket communication
  const players = [];
  const playerCount = 2;

  for (let i = 1; i <= playerCount; i++) {
    const squirrelId = `test-player-${i}-${Math.random().toString(36).substr(2, 9)}`;
    const token = `test-token-${i}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`\n👤 Creating Player ${i} (${squirrelId})`);
    
    const wsUrl = `wss://hidden-walnuts-preview.mattmcarroll.workers.dev/ws?squirrelId=${squirrelId}&token=${token}`;
    const ws = new WebSocket(wsUrl);
    
    players.push({ id: i, squirrelId, ws, position: { x: i * 10, y: 0, z: i * 5, rotationY: 0 } });

    ws.on('open', () => {
      console.log(`✅ Player ${i} WebSocket connected`);
      
      // Send initial position update
      const message = {
        type: 'player_update',
        position: players[i-1].position
      };
      ws.send(JSON.stringify(message));
      console.log(`📤 Player ${i} sent position:`, players[i-1].position);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        if (message.type === 'player_update' && message.squirrelId !== squirrelId) {
          console.log(`📨 Player ${i} received update from ${message.squirrelId}:`, message.position);
        } else if (message.type === 'ack') {
          // Reduced ack message logging to test optimization
          console.log(`🔇 Player ${i} received ack (should be reduced now)`);
        }
      } catch (error) {
        console.error(`❌ Player ${i} message parse error:`, error);
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ Player ${i} WebSocket error:`, error.message);
    });

    ws.on('close', () => {
      console.log(`🔌 Player ${i} WebSocket closed`);
    });

    // Wait a bit between connections
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test 3: Send position updates and verify broadcasting
  console.log('\n🔄 Testing position updates and broadcasting...');
  
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for connections

  // Simulate movement for each player
  for (let round = 1; round <= 3; round++) {
    console.log(`\n🎯 Movement Round ${round}:`);
    
    for (const player of players) {
      if (player.ws.readyState === WebSocket.OPEN) {
        // Update position
        player.position.x += Math.random() * 10 - 5;
        player.position.z += Math.random() * 10 - 5;
        player.position.rotationY = Math.random() * Math.PI * 2;
        
        const message = {
          type: 'player_update',
          position: player.position
        };
        
        player.ws.send(JSON.stringify(message));
        console.log(`📤 Player ${player.id} moved to (${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)})`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for updates to propagate
  }

  // Test 4: Verify optimized update frequency
  console.log('\n⚡ Testing optimized update frequency (reduced spam)...');
  
  let messageCount = 0;
  const testDuration = 5000; // 5 seconds
  
  players[0].ws.on('message', () => {
    messageCount++;
  });

  // Send rapid updates to test throttling
  const rapidUpdateInterval = setInterval(() => {
    if (players[0].ws.readyState === WebSocket.OPEN) {
      players[0].ws.send(JSON.stringify({
        type: 'player_update',
        position: { x: Math.random() * 100, y: 0, z: Math.random() * 100, rotationY: 0 }
      }));
    }
  }, 10); // Very frequent updates

  setTimeout(() => {
    clearInterval(rapidUpdateInterval);
    console.log(`📊 Message frequency test: ${messageCount} messages in ${testDuration}ms`);
    console.log(`📊 Average: ${(messageCount / (testDuration / 1000)).toFixed(1)} messages/second`);
    
    // Cleanup
    console.log('\n🧹 Cleaning up connections...');
    players.forEach(player => {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.close();
      }
    });
    
    console.log('\n✅ Environment and Multiplayer test completed!');
  }, testDuration);
}

// Run the test
testEnvironmentAndMultiplayer().catch(console.error); 