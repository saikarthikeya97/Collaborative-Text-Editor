const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 4000;
const MONGODB_URI = 'mongodb://localhost:27017/collab-editor'; // your MongoDB URI

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Mongoose schema and model for document
const documentSchema = new mongoose.Schema({
    _id: String,        // fixed ID for single doc
    content: Object,     // Quill delta JSON
});

const Document = mongoose.model('Document', documentSchema);

const DEFAULT_DOC_ID = 'default-document';

io.on('connection', (socket) => {
    console.log('New client connected');

    // Load document or create new if not exist
    Document.findById(DEFAULT_DOC_ID).then(doc => {
        if (doc) {
            socket.emit('load-document', doc.content);
        } else {
            const newDoc = new Document({ _id: DEFAULT_DOC_ID, content: {} });
            newDoc.save();
            socket.emit('load-document', {});
        }
    });

    // Listen for text changes and broadcast + save
    socket.on('send-changes', (delta) => {
        socket.broadcast.emit('receive-changes', delta);

        Document.findById(DEFAULT_DOC_ID).then(doc => {
            if (doc) {
                // Here for simplicity, just replace content with last delta
                doc.content = delta;
                doc.save();
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
