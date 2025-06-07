const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const Document = require("./Document");

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // your frontend
        methods: ["GET", "POST"],
    },
});

// ✅ CONNECT TO MONGO
mongoose
    .connect("mongodb://127.0.0.1:27017/google-docs-clone")
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.error("MongoDB error:", err));

const defaultValue = "";

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("get-document", async (documentId) => {
        console.log("get-document:", documentId);

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
});

async function findOrCreateDocument(id) {
    if (id == null) return;

    const document = await Document.findById(id);
    if (document) return document;
    return await Document.create({ _id: id, data: defaultValue });
}

server.listen(5000, () => {
    console.log("Server listening on port 5000");
});
