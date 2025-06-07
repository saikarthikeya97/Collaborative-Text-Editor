import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { useParams } from "react-router-dom";

const SAVE_INTERVAL_MS = 2000;

const TextEditor = () => {
    const { id: documentId } = useParams();
    const wrapperRef = useRef();
    const socketRef = useRef();
    const quillRef = useRef();

    useEffect(() => {
        const socket = io("http://localhost:3001");
        socketRef.current = socket;

        const editorContainer = document.createElement("div");
        wrapperRef.current.innerHTML = "";
        wrapperRef.current.append(editorContainer);

        const quill = new Quill(editorContainer, {
            theme: "snow",
            modules: {
                toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ["bold", "italic", "underline"],
                    ["image", "code-block"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["clean"]
                ]
            }
        });
        quill.disable();
        quill.setText("Loading...");
        quillRef.current = quill;

        socket.once("load-document", document => {
            quill.setContents(document);
            quill.enable();
        });

        socket.emit("get-document", documentId);

        const handleChange = delta => {
            socket.emit("send-changes", delta);
        };
        quill.on("text-change", handleChange);

        socket.on("receive-changes", delta => {
            quill.updateContents(delta);
        });

        const interval = setInterval(() => {
            socket.emit("save-document", quill.getContents());
        }, SAVE_INTERVAL_MS);

        return () => {
            socket.disconnect();
            clearInterval(interval);
        };
    }, [documentId]);

    return <div ref={wrapperRef} className="container" style={{ height: "100vh" }}></div>;
};

export default TextEditor;
