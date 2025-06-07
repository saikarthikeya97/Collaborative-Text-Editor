import React, { useEffect, useState, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { io } from "socket.io-client";

const TOOLBAR_OPTIONS = [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "code-block"],
    ["link", "image"],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    ["clean"],
];

function Editor() {
    const [socket, setSocket] = useState(null);
    const [quill, setQuill] = useState(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const s = io("http://localhost:5000");
        setSocket(s);
        return () => s.disconnect();
    }, []);

    useEffect(() => {
        if (!wrapperRef.current) return;

        wrapperRef.current.innerHTML = "";

        const editor = document.createElement("div");
        wrapperRef.current.appendChild(editor);

        const q = new Quill(editor, {
            theme: "snow",
            modules: { toolbar: TOOLBAR_OPTIONS },
        });

        q.disable();
        q.setText("Loading document...");
        setQuill(q);
    }, []);

    useEffect(() => {
        if (!socket || !quill) return;

        socket.once("load-document", (document) => {
            quill.setContents(document);
            quill.enable();
        });

        socket.emit("get-document", "default-document-id");

        const handler = (delta) => {
            socket.emit("send-changes", delta);
        };
        quill.on("text-change", handler);

        socket.on("receive-changes", (delta) => {
            quill.updateContents(delta);
        });

        const interval = setInterval(() => {
            socket.emit("save-document", quill.getContents());
        }, 2000);

        return () => {
            quill.off("text-change", handler);
            socket.off("receive-changes");
            clearInterval(interval);
        };
    }, [socket, quill]);
    <div className="app-container">
        <div className="hero-section">
            <div class="centered-text">
                <h1 className="title">Collaborative Text Editor</h1>
                <p className="subtitle">Real-time collaboration powered by React, Quill, and Socket.io.</p>
            </div>
        </div>

        <main ref={wrapperRef} className="editor-container"></main>

        <footer className="footer">© 2025 Sai Karthikeya. All rights reserved.</footer>
    </div>

}

export default Editor;
