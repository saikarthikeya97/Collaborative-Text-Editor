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
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false);

  // Define backend URL for socket connection
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  useEffect(() => {
    const s = io(BACKEND_URL);
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [BACKEND_URL]);

  useEffect(() => {
    if (!socket || !quill) return;

    socket.once("load-document", document => {
      quill.setContents(document);
      quill.enable();
      setIsDocumentLoaded(true);
    });

    socket.emit("get-document", documentId);
  }, [socket, quill, documentId]);

  useEffect(() => {
    if (!socket || !quill) return;

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents());
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [socket, quill]);

  useEffect(() => {
    if (!socket || !quill) return;

    const handler = delta => {
      socket.emit("send-changes", delta);
    };

    quill.on("text-change", handler);
    return () => quill.off("text-change", handler);
  }, [socket, quill]);

  useEffect(() => {
    if (!socket || !quill) return;

    const handler = delta => {
      quill.updateContents(delta);
    };

    socket.on("receive-changes", handler);
    return () => socket.off("receive-changes", handler);
  }, [socket, quill]);

  const wrapperRef = useCallback(wrapper => {
    if (wrapper == null) return;

    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);

    const q = new Quill(editor, {
      theme: "snow",
      modules: { toolbar: TOOLBAR_OPTIONS },
    });

    q.disable();

    setQuill(q);
  }, []);

  return (
    <div className="container">
      {!isDocumentLoaded && (
        <h1 style={{ textAlign: "center", marginTop: "20px" }}>
          Loading document…
        </h1>
      )}
      <div
        ref={wrapperRef}
        style={{ display: isDocumentLoaded ? "block" : "none", minHeight: "400px" }}
      ></div>
    </div>
  );
}
