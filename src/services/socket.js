let ws = null;
const subscribers = new Set();

export function connectSocket() {
  if (ws) return;

  ws = new WebSocket('wss://envico-backend.onrender.com');

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      for (const cb of subscribers) cb(msg);
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    ws = null;
    // reconnect after 3s
    setTimeout(connectSocket, 3000);
  };
}

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
