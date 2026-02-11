// websocketClient.ts

let socket: WebSocket | null = null;
let socketId: string | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let lastPong = Date.now();

const HEARTBEAT_INTERVAL = 25000; 
const HEARTBEAT_TIMEOUT = 60000; 

// 1️⃣ EXPORT THIS: Allow the component to tell us when a pong arrives
export const handleHeartbeatAck = () => {
  lastPong = Date.now();
  // console.log("💓 Heartbeat acknowledged"); 
};

export const getWebSocket = (token: string): { ws: WebSocket; id: string } => {
  if (socket) {
    // 2️⃣ ADD THIS: If reusing an open socket, ensure heartbeat is running
    if (socket.readyState === WebSocket.OPEN) {
      startHeartbeat();
    }
    return { ws: socket, id: socketId! };
  }

  const wsUrl = `wss://k4g7m4879h.execute-api.us-east-1.amazonaws.com/dev?token=${encodeURIComponent(token)}`;

  socket = new WebSocket(wsUrl);
  socketId = Math.random().toString(36).slice(2);

  console.log("Created WebSocket with id:", socketId);

  socket.onopen = () => {
    console.log("WebSocket connected, id:", socketId);
    startHeartbeat();
  };

  // ❌ DELETE socket.onmessage from here. 
  // It is useless because the UI component overwrites it immediately.

  socket.onclose = () => {
    console.log("WebSocket closed");
    stopHeartbeat();
    socket = null;
    socketId = null;
  };

  socket.onerror = (err) => {
    console.error("WebSocket error", err);
  };

  return { ws: socket, id: socketId };
};

function startHeartbeat() {
  stopHeartbeat(); // Clear any existing timer first
  lastPong = Date.now(); // Reset timer to avoid immediate timeout on reconnect

  heartbeatInterval = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
console.log("Sending Ping to Server...");
    if (Date.now() - lastPong > HEARTBEAT_TIMEOUT) {
      console.warn("Heartbeat timeout. Closing socket...");
      socket.close();
      return;
    }

    // console.log("💓 Sending Ping...");
    socket.send(JSON.stringify({ event: "ping", data: { ts: Date.now() } }));
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}