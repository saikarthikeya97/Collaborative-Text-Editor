// src/TextEditor.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { io } from "socket.io-client";

const SAVE_INTERVAL_MS = 2000;
const TOOLBAR_OPTIONS = [
    [{ header: [1, 2, 3, false] }],
    [{ font: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    ["bold", "italic", "underline"],
    [{ color: [] }, { background: [] }],
    [{ script: "sub" }, { script: "super" }],
    [{ align: [] }],
    ["clean"],
];

export default function TextEditor() {
    const { id: documentId } = useParams();
    const [quill, setQuill] = useState();
    const socketRef = useRef();

    // Setup socket connection
    useEffect(() => {
        socketRef.current = io("http://localhost:5000");
        return () => {
            socketRef.current.disconnect();
        };
    }, []);

    // Initialize Quill editor
    const wrapperRef = useCallback((wrapper) => {
        if (wrapper == null) return;
        wrapper.innerHTML = "";
        const editor = document.createElement("div");
        wrapper.append(editor);
        const q = new Quill(editor, {
            theme: "snow",
            modules: { toolbar: TOOLBAR_OPTIONS },
        });
        q.disable();
        q.setText("Loading document...");
        setQuill(q);
    }, []);

    // Load document data
    useEffect(() => {
        if (!socketRef.current || !quill) return;

        socketRef.current.once("load-document", (document) => {
            quill.setContents(document);
            quill.enable();
        });

        socketRef.current.emit("get-document", documentId);
    }, [socketRef, quill, documentId]);

    // Save document every SAVE_INTERVAL_MS
    useEffect(() => {
        if (!socketRef.current || !quill) return;
        const interval = setInterval(() => {
            socketRef.current.emit("save-document", quill.getContents());
        }, SAVE_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [socketRef, quill]);

    // Send changes to server
    useEffect(() => {
        if (!socketRef.current || !quill) return;

        const handler = (delta, oldDelta, source) => {
            if (source !== "user") return;
            socketRef.current.emit("send-changes", delta);
        };
        quill.on("text-change", handler);

        return () => {
            quill.off("text-change", handler);
        };
    }, [socketRef, quill]);

    // Receive changes from server
    useEffect(() => {
        if (!socketRef.current || !quill) return;

        const handler = (delta) => {
            quill.updateContents(delta);
        };

        socketRef.current.on("receive-changes", handler);
        return () => {
            socketRef.current.off("receive-changes", handler);
        };
    }, [socketRef, quill]);

    return (
        <div className="container mx-auto p-6 bg-white shadow-lg rounded-lg min-h-[600px]">
            <div ref={wrapperRef} className="quill-editor" style={{ height: "500px" }} />
        </div>
    );
}
