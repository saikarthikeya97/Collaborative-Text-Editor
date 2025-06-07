const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();

// ======= Safety wrapper to catch invalid route paths immediately =======
['get', 'post', 'put', 'delete', 'use'].forEach((method) => {
  const original = app[method].bind(app);
  app[method] = function (path, ...args) {
    if (typeof path === 'string') {
      if (path.startsWith('http')) {
        console.error(`❌ ERROR: app.${method}() called with invalid path (full URL):`, path);
        process.exit(1);
      }
      if (/:\s*[^/]/.test(path)) {
        console.error(`❌ ERROR: app.${method}() called with invalid parameter in path:`, path);
        process.exit(1);
      }
    }
    return original(path, ...args);
  };
});

app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Environment variables
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  process.exit(1);
}

// Mongoose Schema & Model
const documentSchema = new mongoose.Schema({
  _id: String,
  content: Object,
});
const Document = mongoose.model('Document', documentSchema);

// Connect MongoDB and start server
mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Socket.IO Logic
io.on('connection', (socket) => {
  console.log('🟢 Client connected');

  socket.on('get-document', async (documentId) => {
    if (!documentId) return;

    let document = await Document.findById(documentId);
    if (!document) {
      document = await Document.create({ _id: documentId, content: '' });
    }

    socket.join(documentId);
    socket.emit('load-document', document.content);

    socket.on('send-changes', (delta) => {
      socket.broadcast.to(documentId).emit('receive-changes', delta);
    });

    socket.on('save-document', async (data) => {
      await Document.findByIdAndUpdate(documentId, { content: data });
    });
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected');
  });
});

// Serve React frontend static files
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuildPath));

// Use '/*' to catch all React routes
app.get('/*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});
