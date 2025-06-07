// Issues identified in your code:
// 1. No logging of FRONTEND_URL or MONGODB_URI values for debugging.
// 2. No dotenv configuration, which is essential for reading env variables locally and on Render.
// 3. The wildcard route ("*") may be misinterpreted by path-to-regexp in some environments (e.g. Node 20+).
// 4. Not forcing Mongoose to retry connection in production (optional enhancement).

require("dotenv").config(); // ✅ Load env variables from .env

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const Document = require("./Document");

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/google-docs-clone";
const PORT = process.env.PORT || 5000;

console.log("\u{1F527} Using MongoDB URI:", MONGODB_URI);
console.log("\u{1F527} Allowed frontend origin:", FRONTEND_URL);

app.use(cors({ origin: FRONTEND_URL, methods: ["GET", "POST"] }));

// Create HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

// MongoDB connection
mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("\u2705 MongoDB connected"))
  .catch((err) => {
    console.error("\u274C MongoDB connection error:", err);
    process.exit(1);
  });

const defaultValue = "";

async function findOrCreateDocument(id) {
  if (!id) return null;
  const document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: defaultValue });
}

// Socket.IO logic
io.on("connection", (socket) => {
  console.log("\u26A1 Client connected:", socket.id);

  socket.on("get-document", async (documentId) => {
    console.log("\u{1F4C4} get-document:", documentId);

    const document = await findOrCreateDocument(documentId);
    if (!document) {
      socket.emit("load-document", defaultValue);
      return;
    }

    socket.join(documentId);
    socket.emit("load-document", document.data);

    socket.on("send-changes", (delta) => {
      socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    socket.on("save-document", async (data) => {
      await Document.findByIdAndUpdate(documentId, { data });
    });
  });

  socket.on("disconnect", () => {
    console.log("\u{1F50C} Client disconnected:", socket.id);
  });
});

// Serve React build folder if exists
const clientPath = path.join(__dirname, "..", "client", "build");
if (fs.existsSync(clientPath)) {
  app.use(express.static(clientPath));

  app.get("/*", (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
} else {
  console.warn("\u26A0\uFE0F React build folder not found at:", clientPath);
}

server.listen(PORT, () => {
  console.log(`\u{1F680} Server running on port ${PORT}`);
});
