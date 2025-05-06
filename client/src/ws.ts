import { updateWalnutPosition } from './main';
import { showRehiddenNotification } from './ui';

let localSquirrelId: string;
let showDebugMessages = false;

export function connectToWebSocket(squirrelId: string) {
  localSquirrelId = squirrelId;
  const socket = new WebSocket(`ws://localhost:8787/join?squirrelId=${squirrelId}`);
  
  socket.onopen = () => {
    console.log('WebSocket connection established');
  };
  
  socket.onclose = () => {
    console.log('WebSocket connection closed');
    // Attempt to reconnect after 5 seconds
    setTimeout(() => connectToWebSocket(squirrelId), 5000);
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      // Debug message display
      if (showDebugMessages) {
        console.log('Received message:', message);
      }
      
      switch (message.type) {
        case 'init':
          console.log('Connection initialized with session ID:', message.sessionId);
          if (message.mapState) {
            // Handle map state update
            console.log('Received initial map state:', message.mapState);
          }
          break;
          
        case 'heartbeat':
          // Silently handle heartbeat
          break;
          
        case 'walnut-rehidden':
          const { walnutId, location } = message.data;
          if (walnutId && location) {
            updateWalnutPosition(walnutId, location);
            if (message.data.squirrelId !== getLocalSquirrelId()) {
              showRehiddenNotification(walnutId);
            }
          }
          break;
          
        default:
          if (showDebugMessages) {
            console.log('Unhandled message type:', message.type);
          }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  return socket;
}

export function getLocalSquirrelId() {
  return localSquirrelId;
}

export function setDebugMessages(enabled: boolean) {
  showDebugMessages = enabled;
} 