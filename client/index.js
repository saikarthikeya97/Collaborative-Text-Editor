const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Document = require("./models/Document");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // adjust this in production to your frontend URL
        methods: ["GET", "POST"],
    },
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "your-mongodb-uri-here";

mongoose
    .connect(MONGODB_URI)
    .then(() => {
        console.log("✅ MongoDB connected");
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
    });

async function findOrCreateDocument(id) {
    if (id == null) return;

    let document = await Document.findById(id);
    if (document) {
        return document;
    }

    document = new Document({ _id: id, data: { ops: [{ insert: "\n" }] } }); // empty doc
    await document.save();
    return document;
}

io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("get-document", async (documentId) => {
        console.log(`get-document received for ID: ${documentId}`);

        try {
            const document = await findOrCreateDocument(documentId);

            if (!document) {
                console.log(`No document found or created for ID: ${documentId}`);
                // Send a dummy empty document to avoid frontend hang
                socket.emit("load-document", { ops: [{ insert: "\n" }] });
            } else {
                console.log(`Document loaded for ID ${documentId}:`, document.data);
                socket.join(documentId);
                socket.emit("load-document", document.data);
            }
        } catch (err) {
            console.error("Error fetching/creating document:", err);
            // Send dummy fallback
            socket.emit("load-document", { ops: [{ insert: "\n" }] });
        }
    });

    socket.on("send-changes", (delta) => {
        const rooms = Array.from(socket.rooms);
        const documentId = rooms[1]; // rooms[0] is socket.id, rooms[1] is documentId
        if (documentId) {
            socket.to(documentId).emit("receive-changes", delta);
        }
    });

    socket.on("save-document", async (data) => {
        const rooms = Array.from(socket.rooms);
        const documentId = rooms[1];
        if (documentId) {
            try {
                await Document.findByIdAndUpdate(documentId, { data });
                //console.log(`Document ${documentId} saved.`);
            } catch (err) {
                console.error(`Error saving document ${documentId}:`, err);
            }
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
