import React, { useCallback, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import './styles.css';

const SAVE_INTERVAL_MS = 2000;
const TOOLBAR_OPTIONS = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ header: 1 }, { header: 2 }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ script: 'sub' }, { script: 'super' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ direction: 'rtl' }],
  [{ size: ['small', false, 'large', 'huge'] }],
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ color: [] }, { background: [] }],
  [{ font: [] }],
  [{ align: [] }],
  ['clean'],
];

function App() {
  const [socket, setSocket] = useState(null);
  const [quill, setQuill] = useState(null);
  const quillRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [localChanges, setLocalChanges] = useState([]);
  const [documentLoaded, setDocumentLoaded] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const s = io('/', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      setIsConnected(true);
      if (quillRef.current) {
        quillRef.current.enable();
      }
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // Initialize Quill editor
  const wrapperRef = useCallback((wrapper) => {
    if (!wrapper) return;

    wrapper.innerHTML = '';
    const editor = document.createElement('div');
    wrapper.append(editor);
    const q = new Quill(editor, {
      theme: 'snow',
      modules: { toolbar: TOOLBAR_OPTIONS },
      placeholder: 'Start typing...'
    });

    // Enable editor immediately for optimistic UI
    q.enable();
    quillRef.current = q;
    setQuill(q);

    // Store local changes until connected
    q.on('text-change', (delta, oldDelta, source) => {
      if (source === 'user') {
        setLocalChanges(prev => [...prev, delta]);
        if (isConnected && socket) {
          socket.emit('send-changes', delta);
        }
      }
    });
  }, [isConnected, socket]);

  // Handle incoming changes
  useEffect(() => {
    if (!socket || !quill) return;

    const handler = (delta) => {
      quill.updateContents(delta, 'api');
    };
    socket.on('receive-changes', handler);

    return () => {
      socket.off('receive-changes', handler);
    };
  }, [socket, quill]);

  // Load document when connected
  useEffect(() => {
    if (!socket || !quill || !isConnected) return;

    socket.once('load-document', (document) => {
      if (document && document.ops) {
        quill.setContents(document, 'api');
      }
      setDocumentLoaded(true);
      
      // Apply any local changes made while disconnected
      if (localChanges.length > 0) {
        localChanges.forEach(delta => {
          socket.emit('send-changes', delta);
        });
        setLocalChanges([]);
      }
    });

    socket.emit('get-document', 'default-document');

    return () => {
      socket.off('load-document');
    };
  }, [socket, quill, isConnected, localChanges]);

  // Auto-save document
  useEffect(() => {
    if (!socket || !quill || !isConnected || !documentLoaded) return;

    const interval = setInterval(() => {
      const contents = quill.getContents();
      if (contents.ops.length > 1) {
        socket.emit('save-document', contents);
      }
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [socket, quill, isConnected, documentLoaded]);

  return (
    <div className="container">
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      <div ref={wrapperRef}></div>
    </div>
  );
}

export default App;
