import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom/client";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { io } from "socket.io-client";
import "./index.css";

const SAVE_INTERVAL_MS = 2000;
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
    return () => {
      s.disconnect();
    };
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

    // Load document content from server
    socket.once("load-document", (document) => {
      quill.setContents(document);
      quill.enable();
    });

    // Request document with ID
    socket.emit("get-document", "default-document-id");

    // Send user changes only (ignore remote changes to prevent loops)
    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return;
      socket.emit("send-changes", delta);
    };
    quill.on("text-change", handler);

    // Receive remote changes and apply silently
    socket.on("receive-changes", (delta) => {
      quill.updateContents(delta, "api");
    });

    // Auto-save every SAVE_INTERVAL_MS
    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents());
    }, SAVE_INTERVAL_MS);

    return () => {
      quill.off("text-change", handler);
      socket.off("receive-changes");
      clearInterval(interval);
    };
  }, [socket, quill]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center p-6">
      <header className="w-full max-w-4xl mb-6">
        <h1 className="text-4xl font-extrabold text-indigo-900 border-b-4 border-indigo-600 pb-2">
          Collaborative Text Editor
        </h1>
        <p className="mt-1 text-indigo-700 italic">
          Real-time collaboration powered by React, Quill, and Socket.io
        </p>
      </header>

      <div
        ref={wrapperRef}
        className="bg-white rounded-lg shadow-lg max-w-4xl w-full h-[600px] p-4"
      ></div>

      <footer className="mt-6 text-indigo-600 text-sm">
        © 2025 Sai Karthikeya. All rights reserved.
      </footer>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Editor />);
