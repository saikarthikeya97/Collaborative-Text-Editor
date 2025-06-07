const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 4000;

// Use your actual MongoDB Atlas URI here with password included
const MONGODB_URI = 'mongodb+srv://saikarthikeya97:Karthikeya.97@cluster0.jk2vf6u.mongodb.net/collab-editor?retryWrites=true&w=majority';

// Connect to MongoDB (no need to specify useNewUrlParser/useUnifiedTopology)
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('MongoDB connected');

        // Start server only after DB connection is successful
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
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
            newDoc.save().catch(e => console.error('Error saving new document:', e));
            socket.emit('load-document', {});
        }
    }).catch(err => {
        console.error('Error fetching document:', err);
        socket.emit('load-document', {}); // fallback empty doc
    });

    // Listen for text changes and broadcast + save
    socket.on('send-changes', (delta) => {
        socket.broadcast.emit('receive-changes', delta);

        Document.findById(DEFAULT_DOC_ID).then(doc => {
            if (doc) {
                doc.content = delta;
                doc.save().catch(e => console.error('Error saving document:', e));
            }
        }).catch(err => console.error('Error finding document:', err));
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});
