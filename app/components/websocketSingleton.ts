// websocketClient.ts

let socket: WebSocket | null = null;
let socketId: string | null = null;

let heartbeatInterval: any = null;
let lastPong = Date.now();

const listeners = new Set<(event: MessageEvent) => void>();

// ─────────────────────────────
// SUBSCRIBE API
// ─────────────────────────────
export const subscribeToSocket = (cb: (event: MessageEvent) => void) => {
  listeners.add(cb);

  return () => {
    listeners.delete(cb);
  };
};

// ─────────────────────────────
// HEARTBEAT
// ─────────────────────────────
const startHeartbeat = () => {
  if (!socket) return;

  clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    // Send ping
    socket.send(JSON.stringify({ event: "ping" }));
    console.log("💓 ping sent");

    // Timeout check
    if (Date.now() - lastPong > 30000) {
      console.warn("💀 Heartbeat timeout → closing socket");
      socket.close();
    }
  }, 15000);
};

// ─────────────────────────────
// CREATE / GET SOCKET
// ─────────────────────────────
export const getWebSocket = (token: string): { ws: WebSocket; id: string } => {
  if (socket) {
    return { ws: socket, id: socketId! };
  }

  const wsUrl = `wss://k4g7m4879h.execute-api.us-east-1.amazonaws.com/dev?token=${encodeURIComponent(
    token
  )}`;

  socket = new WebSocket(wsUrl);
  socketId = Math.random().toString(36).slice(2);

  console.log("Created WebSocket with id:", socketId);

  socket.addEventListener("open", () => {
    console.log("✅ WebSocket connected", socketId);
    lastPong = Date.now();
    startHeartbeat();
  });

  socket.addEventListener("message", (event) => {
    // 1️⃣ Handle heartbeat pong
    try {
      const payload = JSON.parse(event.data);

      if (payload.event === "pong") {
        console.log("💚 pong received");
        lastPong = Date.now();
      }
    } catch {}

    // 2️⃣ Broadcast to subscribers
    listeners.forEach((cb) => cb(event));
  });

  socket.addEventListener("close", (event) => {
    console.log("🔴 WebSocket closed", event.code, event.reason);
    clearInterval(heartbeatInterval);

    socket = null;
    socketId = null;
  });

  socket.addEventListener("error", (err) => {
    console.error("❌ WebSocket error", err);
  });

  return { ws: socket, id: socketId };
};

// ─────────────────────────────
// MANUAL CLOSE
// ─────────────────────────────
export const closeWebSocket = () => {
  if (socket) {
    socket.close();
  }
};
