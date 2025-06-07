const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();
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

    // Log all registered routes for debugging
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        console.log('Route:', middleware.route.path);
      } else if (middleware.name === 'router') {
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            console.log('Route:', handler.route.path);
          }
        });
      }
    });

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
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

// Use '/*' to catch all routes for React SPA routing
app.get('/*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});
