import { updateWalnutPosition } from './main';
import { showRehiddenNotification } from './ui';

let localSquirrelId: string;
let showDebugMessages = false;

export function connectToWebSocket(squirrelId: string) {
  localSquirrelId = squirrelId;
  const socket = new WebSocket(`ws://localhost:8787/join?squirrelId=${squirrelId}`);
  
  socket.onopen = () => {
    console.log('[WS] Connection established');
  };
  
  socket.onclose = () => {
    console.log('[WS] Connection closed');
    // Attempt to reconnect after 5 seconds
    setTimeout(() => connectToWebSocket(squirrelId), 5000);
  };
  
  socket.onerror = (error) => {
    console.error('[WS ERROR]', error);
  };
  
  socket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (!parsed || typeof parsed !== "object") {
        console.warn("[WS WARNING] Ignored non-object message:", parsed);
        return;
      }

      const { type, walnut, squirrelId } = parsed;

      switch (type) {
        case "init":
          console.log("[WS INIT] Assigned squirrelId:", squirrelId);
          if (parsed.mapState) {
            console.log("[WS INIT] Received map state with", parsed.mapState.length, "walnuts");
          }
          break;

        case "heartbeat":
          console.log("[WS HEARTBEAT] Alive from server");
          break;

        case "walnut-rehidden": {
          if (!walnut || !walnut.id || !walnut.location) {
            console.warn("[WS WARNING] Invalid walnut-rehidden message:", walnut);
            return;
          }
          const { id, location } = walnut;
          updateWalnutPosition(id, location);
          if (squirrelId !== getLocalSquirrelId()) {
            showRehiddenNotification(id);
          }
          break;
        }

        default:
          console.warn("[WS UNKNOWN TYPE]", type, parsed);
      }
    } catch (err) {
      console.error("[WS ERROR] Failed to parse message:", event.data, err);
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