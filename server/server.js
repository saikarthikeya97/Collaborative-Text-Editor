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

// Optimized Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
  // Add these to prevent parsing warnings
  serveClient: false,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Enhanced MongoDB connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
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

// Improved Socket.IO handling
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

// Static file serving with improved error handling
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

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("🌐 Allowed frontend origin:", FRONTEND_URL);
  if (MONGODB_URI.includes('localhost')) {
    console.log("🔧 Using local MongoDB");
  } else {
    console.log("🔧 Using cloud MongoDB");
  }
});
