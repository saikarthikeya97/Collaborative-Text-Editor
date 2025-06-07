const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'your_mongodb_connection_string_here';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
})
.catch((err) => {
    console.error('❌ MongoDB connection error:', err);
});

// Define Mongoose schema and model
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
        .then((doc) => {
            if (doc) {
                socket.emit('load-document', doc.content);
            } else {
                const newDoc = new Document({ _id: DEFAULT_DOC_ID, content: {} });
                newDoc.save().catch(e => console.error('❌ Error saving new document:', e));
                socket.emit('load-document', {});
            }
        })
        .catch((err) => {
            console.error('❌ Error fetching document:', err);
            socket.emit('load-document', {});
        });

    socket.on('send-changes', (delta) => {
        socket.broadcast.emit('receive-changes', delta);
        Document.findById(DEFAULT_DOC_ID)
            .then((doc) => {
                if (doc) {
                    doc.content = delta;
                    doc.save().catch(e => console.error('❌ Error saving document:', e));
                }
            })
            .catch((err) => console.error('❌ Error finding document:', err));
    });

    socket.on('disconnect', () => {
        console.log('🔴 Client disconnected');
    });
});

// Serve static React files from client/build
const clientBuildPath = path.join(__dirname, 'client', 'build');
app.use(express.static(clientBuildPath));

// Catch-all handler for React routing (make sure this is AFTER all API routes)
app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});
