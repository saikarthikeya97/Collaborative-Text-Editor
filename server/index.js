
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const path = require("path");

// Mongoose Schema & Model
const documentSchema = new mongoose.Schema({
  _id: String,
  data: Object, // use consistent naming - 'data' or 'content'
});
const Document = mongoose.model("Document", documentSchema);
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');


const app = express();
app.use(cors());

const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // change this to your deployed frontend URL or '*'
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/google-docs-clone";

mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const defaultValue = "";

async function findOrCreateDocument(id) {
  if (!id) return;
  let document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: defaultValue });
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("get-document", async (documentId) => {
    if (!documentId) return;

    const document = await findOrCreateDocument(documentId);

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
    console.log("Client disconnected:", socket.id);
  });
});

// Serve React static files
const clientBuildPath = path.join(__dirname, "..", "client", "build");
app.use(express.static(clientBuildPath));

app.get("/*", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Environment variables
  const PORT = process.env.PORT || 4000;
  const MONGODB_URI = 'mongodb+srv://saikarthikeya97:Karthikeya%40123@cluster0.jk2vf6u.mongodb.net/collab-editor?retryWrites=true&w=majority';

  // MongoDB connection
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('✅ MongoDB connected');
      server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
    });

  // Mongoose Schema
  const documentSchema = new mongoose.Schema({
    _id: String,
    content: Object,
  });

  const Document = mongoose.model('Document', documentSchema);
  const DEFAULT_DOC_ID = 'default-document';

  // Socket.io logic
  io.on('connection', (socket) => {
    console.log('🟢 New client connected');

    Document.findById(DEFAULT_DOC_ID)
      .then(doc => {
        if (doc) {
          socket.emit('load-document', doc.content);
        } else {
          const newDoc = new Document({ _id: DEFAULT_DOC_ID, content: {} });
          newDoc.save().catch(e => console.error('❌ Error saving new document:', e));
          socket.emit('load-document', {});
        }
      })
      .catch(err => {
        console.error('❌ Error fetching document:', err);
        socket.emit('load-document', {});
      });

    socket.on('send-changes', (delta) => {
      socket.broadcast.emit('receive-changes', delta);
      Document.findById(DEFAULT_DOC_ID)
        .then(doc => {
          if (doc) {
            doc.content = delta;
            doc.save().catch(e => console.error('❌ Error saving document:', e));
          }
        })
        .catch(err => console.error('❌ Error finding document:', err));
    });

    socket.on('disconnect', () => {
      console.log('🔴 Client disconnected');
    });
  });

  // ✅ Serve React static files (client/build) in production
  app.use(express.static(path.join(__dirname, '../client/build')));

  // ✅ Catch-all to handle React routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
