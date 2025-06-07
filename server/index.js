const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow CORS for socket connection

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

// Socket.IO logic
io.on('connection', socket => {
    console.log('🟢 New client connected');

    socket.on('get-document', async documentId => {
        if (!documentId) return;

        let document = await Document.findById(documentId);
        if (!document) {
            document = await Document.create({ _id: documentId, content: '' });
        }

        socket.join(documentId);
        socket.emit('load-document', document.content);

        socket.on('send-changes', delta => {
            socket.broadcast.to(documentId).emit('receive-changes', delta);
        });

        socket.on('save-document', async data => {
            await Document.findByIdAndUpdate(documentId, { content: data });
        });
    });

    socket.on('disconnect', () => {
        console.log('🔴 Client disconnected');
    });
});

// ✅ Serve React frontend in production
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuildPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});
