// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import TextEditor from "./TextEditor";
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Redirect root path to a default document */}
        <Route path="/" element={<Navigate to="/documents/123" replace />} />

        {/* Dynamic route to load the editor for document by id */}
        <Route path="/documents/:id" element={<TextEditor />} />
      </Routes>
    </Router>
  );
}

export default App;
