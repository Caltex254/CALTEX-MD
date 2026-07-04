import { Server } from "socket.io";

// ── Configuration ──────────────────────────────────────────────────────────
const PORT = Number(process.env.WS_PORT) || 3003;
const AUTH_TOKEN = process.env.WS_AUTH_TOKEN || "caltex-md-secret";
const HEARTBEAT_INTERVAL = 25_000; // ms
const HEARTBEAT_TIMEOUT = 60_000; // ms

// ── Server bootstrap ───────────────────────────────────────────────────────
const io = new Server(PORT, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://caltex-md.vercel.app",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: HEARTBEAT_INTERVAL,
  pingTimeout: HEARTBEAT_TIMEOUT,
});

// ── State ──────────────────────────────────────────────────────────────────
const rooms = ["dashboard", "bot"] as const;
type Room = (typeof rooms)[number];

interface ClientInfo {
  id: string;
  room: Room;
  connectedAt: number;
  authenticated: boolean;
}

const clients = new Map<string, ClientInfo>();

// ── Helpers ────────────────────────────────────────────────────────────────
const log = (level: "info" | "warn" | "error", msg: string, meta?: unknown) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}`, meta ?? "");
};

const clientCount = (room?: Room) =>
  room
    ? [...clients.values()].filter((c) => c.room === room).length
    : clients.size;

const emitClientCount = () => {
  io.to("dashboard").emit("ws:client-count", {
    total: clientCount(),
    dashboard: clientCount("dashboard"),
    bot: clientCount("bot"),
  });
};

// ── Authentication middleware ───────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  const room = socket.handshake.auth?.room as Room | undefined;

  if (!token || token !== AUTH_TOKEN) {
    log("warn", `Auth rejected for socket ${socket.id}`);
    return next(new Error("Unauthorized"));
  }

  if (!room || !rooms.includes(room)) {
    log("warn", `Invalid room "${room}" from socket ${socket.id}`);
    return next(new Error("Invalid room"));
  }

  next();
});

// ── Connection handler ─────────────────────────────────────────────────────
io.on("connection", (socket) => {
  const room = socket.handshake.auth.room as Room;

  // Track client
  clients.set(socket.id, {
    id: socket.id,
    room,
    connectedAt: Date.now(),
    authenticated: true,
  });

  socket.join(room);
  log("info", `Client connected → room="${room}" id=${socket.id}`);
  emitClientCount();

  // Confirm connection to the client
  socket.emit("ws:connected", {
    id: socket.id,
    room,
    serverTime: Date.now(),
  });

  // ── Bot → Dashboard events ─────────────────────────────────────────────
  const botToDashEvents = [
    "bot:status",
    "bot:qr",
    "bot:message",
    "bot:log",
    "bot:stats",
    "bot:session",
    "bot:command",
  ] as const;

  for (const event of botToDashEvents) {
    socket.on(event, (data) => {
      if (room !== "bot") {
        log("warn", `Non-bot client ${socket.id} emitted ${event}`);
        return;
      }
      log("info", `Relay ${event}`, data);
      io.to("dashboard").emit(event, data);
    });
  }

  // ── Dashboard → Bot events ─────────────────────────────────────────────
  const dashToBotEvents = [
    "dash:restart",
    "dash:stop",
    "dash:start",
    "dash:send-message",
    "dash:execute-command",
    "dash:update-settings",
    "dash:toggle-plugin",
  ] as const;

  for (const event of dashToBotEvents) {
    socket.on(event, (data) => {
      if (room !== "dashboard") {
        log("warn", `Non-dashboard client ${socket.id} emitted ${event}`);
        return;
      }
      log("info", `Relay ${event}`, data);
      io.to("bot").emit(event, data);
    });
  }

  // ── Heartbeat / health ─────────────────────────────────────────────────
  socket.on("ws:ping", () => {
    socket.emit("ws:pong", { serverTime: Date.now() });
  });

  // ── Disconnect ─────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    clients.delete(socket.id);
    log("info", `Client disconnected id=${socket.id} reason=${reason}`);
    emitClientCount();
  });

  // ── Error handler ──────────────────────────────────────────────────────
  socket.on("error", (err) => {
    log("error", `Socket error id=${socket.id}`, err);
  });
});

// ── Global error fallback ──────────────────────────────────────────────────
io.engine.on("connection_error", (err) => {
  log("error", "Engine connection error", err.message);
});

// ── Ready ──────────────────────────────────────────────────────────────────
log("info", `⚡ CALTEX WS service running on port ${PORT}`);
log("info", `   Rooms: ${rooms.join(", ")}`);
log("info", `   Heartbeat: interval=${HEARTBEAT_INTERVAL}ms timeout=${HEARTBEAT_TIMEOUT}ms`);
