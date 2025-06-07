require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');
const Document = require('./Document');

const app = express();

// Configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/google-docs-clone';
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Create HTTP server
const server = http.createServer(app);

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// MongoDB connection
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

// Document handling
const defaultValue = '';

async function findOrCreateDocument(id) {
  if (!id) return null;
  try {
    const document = await Document.findById(id);
    return document || await Document.create({ _id: id, data: defaultValue });
  } catch (err) {
    console.error('Document error:', err.message);
    return null;
  }
}

// Socket.IO events
io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);

  socket.on('get-document', async (documentId) => {
    try {
      const document = await findOrCreateDocument(documentId);
      socket.join(documentId);
      socket.emit('load-document', document?.data || defaultValue);

      socket.on('send-changes', (delta) => {
        socket.broadcast.to(documentId).emit('receive-changes', delta);
      });

      socket.on('save-document', async (data) => {
        await Document.findByIdAndUpdate(documentId, { data }, { upsert: true });
      });
    } catch (err) {
      console.error('Document error:', err);
      socket.emit('error', 'Failed to load document');
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Serve static files (if client build exists)
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client/build');
  app.use(express.static(clientPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 CORS allowed for: ${FRONTEND_URL}`);
  });
}

startServer();
