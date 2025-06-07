require("dotenv").config();

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
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/google-docs-clone";
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration
app.use(cors({
  origin: FRONTEND_URL,
  methods: ["GET", "POST"],
  credentials: true
}));

// Prevent favicon warnings
app.get('/favicon.ico', (req, res) => res.status(204).end());

const server = http.createServer(app);

// Optimized Socket.IO configuration to prevent parsing warnings
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
  serveClient: false,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
  // Add parser configuration
  parser: require("socket.io-parser"),
  pingTimeout: 60000,
  pingInterval: 25000
});

// Clean MongoDB connection without deprecated options
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
.then(() => console.log("✅ MongoDB connected successfully"))
.catch((err) => {
  console.error("❌ MongoDB connection error:", err.message);
  process.exit(1);
});

const defaultValue = "";

async function findOrCreateDocument(id) {
  if (!id) return null;
  
  try {
    const document = await Document.findById(id);
    if (document) return document;
    return await Document.create({ _id: id, data: defaultValue });
  } catch (err) {
    console.error("Document error:", err.message);
    return null;
  }
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("⚡ Client connected:", socket.id);

  socket.on("get-document", async (documentId) => {
    try {
      const document = await findOrCreateDocument(documentId);
      socket.join(documentId);
      socket.emit("load-document", document?.data || defaultValue);

      socket.on("send-changes", (delta) => {
        socket.broadcast.to(documentId).emit("receive-changes", delta);
      });

      socket.on("save-document", async (data) => {
        try {
          await Document.findByIdAndUpdate(documentId, { data }, { upsert: true });
        } catch (err) {
          console.error("Save error:", err.message);
        }
      });
    } catch (err) {
      console.error("Document load error:", err.message);
      socket.emit("load-document", defaultValue);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔌 Client disconnected (${reason}):`, socket.id);
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
  });
});

// Static file serving
const clientPath = path.join(__dirname, "..", "client", "build");

if (fs.existsSync(clientPath)) {
  app.use(express.static(clientPath, {
    maxAge: '1d',
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  app.get("*", (req, res) => {
    try {
      res.sendFile(path.join(clientPath, "index.html"));
    } catch (err) {
      console.error("Serve static error:", err.message);
      res.status(500).send("Internal Server Error");
    }
  });
} else {
  console.warn("⚠️ React build folder not found at:", clientPath);
  app.get("/", (req, res) => {
    res.send("API is running - Client build not found");
  });
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("🌐 Allowed frontend origin:", FRONTEND_URL);
  console.log("🔧 MongoDB:", MONGODB_URI.includes('localhost') ? "Local" : "Cloud");
});
