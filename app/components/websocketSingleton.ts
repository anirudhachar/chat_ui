let socket: WebSocket | null = null;
let socketId: string | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let lastPong = Date.now();

const HEARTBEAT_INTERVAL = 25000; // 25s
const HEARTBEAT_TIMEOUT = 60000; // 60s

export const getWebSocket = (token: string): { ws: WebSocket; id: string } => {
  if (socket) {
    console.log("WebSocket already exists, id:", socketId);
    return { ws: socket, id: socketId! };
  }

  const wsUrl = `wss://k4g7m4879h.execute-api.us-east-1.amazonaws.com/dev?token=${encodeURIComponent(
    token
  )}`;

  socket = new WebSocket(wsUrl);
  socketId = Math.random().toString(36).slice(2);

  console.log("Created WebSocket with id:", socketId);

  socket.onopen = () => {
    console.log("WebSocket connected, id:", socketId);

    startHeartbeat();
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);

      // 💓 Pong handler
      if (payload.event === "pong") {
        lastPong = Date.now();
        return;
      }
    } catch {}
  };

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
  stopHeartbeat();

  heartbeatInterval = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    // 🔥 Detect stale connection
    if (Date.now() - lastPong > HEARTBEAT_TIMEOUT) {
      console.warn("Heartbeat timeout. Closing socket...");
      socket.close();
      return;
    }

    socket.send(
      JSON.stringify({
        event: "ping",
        data: { ts: Date.now() },
      })
    );
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
