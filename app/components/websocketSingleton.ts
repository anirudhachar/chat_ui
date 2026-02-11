// websocketClient.ts
let socket: WebSocket | null = null;
let socketId: string | null = null;

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

  socket.onopen = () => console.log("WebSocket connected, id:", socketId);
  socket.onerror = (err) => console.error("WebSocket error", err);

  return { ws: socket, id: socketId };
};

export const closeWebSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
    socketId = null;
  }
};
