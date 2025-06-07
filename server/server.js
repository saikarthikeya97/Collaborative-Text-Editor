require("dotenv").config(); // load .env variables at the very top

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const Document = require("./Document");

const app = express();
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Socket.IO setup
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/google-docs-clone";

console.log("🔧 Using MongoDB URI:", MONGODB_URI);
console.log("🔧 Allowed frontend origin:", FRONTEND_URL);

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

const defaultValue = "";

// Helper: fetch or create document by id
async function findOrCreateDocument(id) {
  if (!id) return null;
  const document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: defaultValue });
}

// Socket.IO logic
io.on("connection", (socket) => {
  console.log("⚡ Client connected:", socket.id);

  socket.on("get-document", async (documentId) => {
    console.log("📄 get-document:", documentId);

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
    console.log("🔌 Client disconnected:", socket.id);
  });
});

// Serve React build if it exists
const clientPath = path.join(__dirname, "..", "client", "build");
if (fs.existsSync(clientPath)) {
  app.use(express.static(clientPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
} else {
  console.warn("⚠️ React build folder not found at:", clientPath);
}

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
