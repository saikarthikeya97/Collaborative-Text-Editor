import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import Quill from "quill";
import "quill/dist/quill.snow.css";

const SAVE_INTERVAL_MS = 2000;

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
];

export default function TextEditor() {
  const { id: documentId } = useParams();
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize socket
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://collaborative-text-editor-1-lek8.onrender.com";
    console.log("🔌 Connecting to backend:", backendUrl);

    const s = io(backendUrl);
    setSocket(s);

    return () => s.disconnect();
  }, []);

  // Load document content
  useEffect(() => {
    if (!socket || !quill) return;

    socket.once("load-document", (document) => {
      console.log("📄 Document received:", document);
      if (!document || typeof document !== "object") {
        console.error("❌ Invalid document format received");
        return;
      }

      try {
        quill.setContents(document);
        quill.enable();
        setIsLoaded(true);
      } catch (err) {
        console.error("⚠️ Failed to set document contents:", err);
      }
    });

    socket.emit("get-document", documentId);
  }, [socket, quill, documentId]);

  // Auto-save every 2 seconds
  useEffect(() => {
    if (!socket || !quill) return;

    const interval = setInterval(() => {
      const contents = quill.getContents();
      socket.emit("save-document", contents);
      console.log("💾 Document saved");
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [socket, quill]);

  // Handle incoming changes
  useEffect(() => {
    if (!socket || !quill) return;

    const handleReceive = (delta) => {
      quill.updateContents(delta);
      console.log("🔄 Document updated from other user");
    };

    socket.on("receive-changes", handleReceive);
    return () => socket.off("receive-changes", handleReceive);
  }, [socket, quill]);

  // Send local changes
  useEffect(() => {
    if (!socket || !quill) return;

    const handleChange = (delta) => {
      socket.emit("send-changes", delta);
    };

    quill.on("text-change", handleChange);
    return () => quill.off("text-change", handleChange);
  }, [socket, quill]);

  // Setup Quill instance
  const wrapperRef = useCallback((wrapper) => {
    if (!wrapper) return;
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

  return (
    <div className="container">
      {!isLoaded && (
        <h1 style={{ textAlign: "center", marginTop: "20px" }}>Loading document…</h1>
      )}
      <div
        ref={wrapperRef}
        style={{
          display: isLoaded ? "block" : "none",
          minHeight: "400px",
        }}
      ></div>
    </div>
  );
}
