require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');

// Create app and server
const app = express();
const server = http.createServer(app);

// Configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/google-docs-clone';
const PORT = process.env.PORT || 5000;

// 1. Silence Socket.IO parser warnings
const { Protocol } = require('socket.io-parser');
const originalDecodeString = Protocol.decodeString;
Protocol.decodeString = function(str) {
  if (str === '/' || str === '/*') return null;
  return originalDecodeString.call(this, str);
};

// 2. Configure CORS
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

// 3. MongoDB connection (modern version)
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err.message));

// 4. Socket.IO with clean configuration
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST']
  },
  // Critical settings to prevent warnings:
  connectTimeout: 45000,
  pingTimeout: 60000,
  pingInterval: 25000,
  cookie: false
});

// 5. Document handling
const defaultValue = '';
const Document = require('./Document');

async function findOrCreateDocument(id) {
  if (!id) return null;
  try {
    return await Document.findById(id) || 
           await Document.create({ _id: id, data: defaultValue });
  } catch (err) {
    console.error('Document error:', err.message);
    return null;
  }
}

// 6. Socket.IO events (clean implementation)
io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);

  socket.on('get-document', async (documentId) => {
    const document = await findOrCreateDocument(documentId);
    socket.join(documentId);
    socket.emit('load-document', document?.data || defaultValue);

    socket.on('send-changes', (delta) => {
      socket.broadcast.to(documentId).emit('receive-changes', delta);
    });

    socket.on('save-document', async (data) => {
      await Document.findByIdAndUpdate(documentId, { data }, { upsert: true });
    });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// 7. Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// 8. Static files (if in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// 9. Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Allowed origin: ${FRONTEND_URL}`);
  console.log(`🔧 MongoDB: ${MONGODB_URI.includes('localhost') ? 'Local' : 'Cloud'}`);
});

// 10. Clean process exit
process.on('SIGTERM', () => {
  server.close(() => {
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });
});
