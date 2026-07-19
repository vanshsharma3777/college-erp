import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";

import { authenticateConnection } from "./auth";
import type { SocketAuth } from "./auth";
import { parseClientMessage } from "./protocol";
import { addConnection, removeConnection, send } from "./connections";
import {
  handleCreateAttendance,
  handleMarkAttendance,
  handleRemoveStudent,
  handleAcceptAttendance,
  handleCloseAttendance,
} from "./handlers";
import { getOpenSessionsForStudent, toView } from "./store";

type Socket = WebSocket & { isAlive?: boolean };

function sendError(ws: WebSocket, code: string, message: string): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: "error", payload: { code, message } }));
  }
}

/**
 * Attach the attendance WebSocket server to the existing HTTP server so it
 * shares the Express port. Auth happens during the HTTP upgrade itself,
 * verifying the same `accessToken` cookie auth-service issues — an
 * unauthenticated request never completes the WS handshake at all, it
 * gets a real 401 instead of a WS close code.
 */
export function createWebSocketServer(server: Server, path = "/ws"): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url || new URL(req.url, "http://localhost").pathname !== path) {
      return; // not ours
    }

    authenticateConnection(req)
      .then((auth) => {
        if (!auth) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, auth);
        });
      })
      .catch(() => {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
      });
  });

  wss.on("connection", async (ws: Socket, auth: SocketAuth) => {
    addConnection(ws, auth);
    ws.isAlive = true;

    send(ws, { type: "connected", payload: { role: auth.role } });

    // Late-join: a student connecting after sessions were created still
    // sees every currently-open session they're enrolled in.
    if (auth.role === "STUDENT") {
      const openSessions = await getOpenSessionsForStudent(auth.studentProfileId);
      for (const session of openSessions) {
        send(ws, { type: "attendance_available", payload: { attendance: toView(session) } });
      }
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        sendError(ws, "INVALID_JSON", "Message must be valid JSON");
        return;
      }

      const msg = parseClientMessage(parsed);
      if ("error" in msg) {
        sendError(ws, "BAD_MESSAGE", msg.error);
        return;
      }

      try {
        switch (msg.type) {
          case "create_attendance": {
            if (auth.role !== "TEACHER") {
              sendError(ws, "FORBIDDEN", "Only teachers can create attendance");
              return;
            }
            await handleCreateAttendance(ws, msg.payload, auth);
            return;
          }

          case "mark_attendance": {
            if (auth.role !== "STUDENT") {
              sendError(ws, "FORBIDDEN", "Only students can mark attendance");
              return;
            }
            await handleMarkAttendance(ws, msg.payload, auth);
            return;
          }

          case "remove_student": {
            if (auth.role !== "TEACHER") {
              sendError(ws, "FORBIDDEN", "Only teachers can remove a student");
              return;
            }
            await handleRemoveStudent(ws, msg.payload, auth);
            return;
          }

          case "accept_attendance": {
            if (auth.role !== "TEACHER") {
              sendError(ws, "FORBIDDEN", "Only teachers can accept attendance");
              return;
            }
            await handleAcceptAttendance(ws, msg.payload, auth);
            return;
          }

          case "close_attendance": {
            if (auth.role !== "TEACHER") {
              sendError(ws, "FORBIDDEN", "Only teachers can close attendance");
              return;
            }
            await handleCloseAttendance(ws, msg.payload, auth);
            return;
          }

          default: {
            sendError(ws, "UNKNOWN_MESSAGE", "Unknown message type");
            return;
          }
        }
      } catch (err) {
        console.error("WS handler error:", err);
        sendError(ws, "INTERNAL_ERROR", "Something went wrong processing that message");
      }
    });

    const cleanup = () => removeConnection(ws);
    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });

  // Heartbeat: terminate connections that stopped responding.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      const sock = client as Socket;
      if (sock.isAlive === false) {
        sock.terminate();
        return;
      }
      sock.isAlive = false;
      if (client.readyState === client.OPEN) client.ping();
    });
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}