import React, { useCallback, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import './styles.css';

const SAVE_INTERVAL_MS = 2000;
const CONNECTION_TIMEOUT_MS = 5000;
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
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const connectionTimeoutRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    const s = io('/', {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: CONNECTION_TIMEOUT_MS
    });

    s.on('connect', () => {
      setConnectionStatus('connected');
      clearTimeout(connectionTimeoutRef.current);
    });

    s.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    s.on('connect_error', () => {
      setConnectionStatus('error');
    });

    setSocket(s);

    // Set a timeout for initial connection
    connectionTimeoutRef.current = setTimeout(() => {
      if (s.disconnected) {
        setConnectionStatus('timeout');
      }
    }, CONNECTION_TIMEOUT_MS);

    return () => {
      clearTimeout(connectionTimeoutRef.current);
      s.disconnect();
    };
  }, []);

  // Handle document changes from other clients
  useEffect(() => {
    if (!socket || !quill) return;

    const handler = (delta, oldDelta, source) => {
      if (source !== 'user') {
        quill.updateContents(delta);
      }
    };
    socket.on('receive-changes', handler);

    return () => {
      socket.off('receive-changes', handler);
    };
  }, [socket, quill]);

  // Auto-save document at intervals
  useEffect(() => {
    if (!socket || !quill) return;

    const interval = setInterval(() => {
      if (quill.getContents().ops.length > 1) { // Don't save empty docs
        socket.emit('save-document', quill.getContents());
      }
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [socket, quill]);

  // Load document when connected
  useEffect(() => {
    if (!socket || !quill || connectionStatus !== 'connected') return;

    const loadHandler = (document) => {
      if (document && document.ops) {
        quill.setContents(document);
      } else {
        quill.setContents([{ insert: 'Start collaborating!\n' }]);
      }
      quill.enable();
    };

    socket.once('load-document', loadHandler);
    socket.emit('get-document', 'default-document');

    return () => {
      socket.off('load-document', loadHandler);
    };
  }, [socket, quill, connectionStatus]);

  // Send changes to server
  useEffect(() => {
    if (!socket || !quill) return;

    const handler = (delta, oldDelta, source) => {
      if (source === 'user') {
        socket.emit('send-changes', delta);
      }
    };
    quill.on('text-change', handler);

    return () => {
      quill.off('text-change', handler);
    };
  }, [socket, quill]);

  // Initialize Quill editor
  const wrapperRef = useCallback((wrapper) => {
    if (!wrapper) return;

    wrapper.innerHTML = '';
    const editor = document.createElement('div');
    wrapper.append(editor);
    const q = new Quill(editor, {
      theme: 'snow',
      modules: { toolbar: TOOLBAR_OPTIONS },
      placeholder: 'Start typing here...'
    });
    
    q.disable();
    
    // Show appropriate status message
    if (connectionStatus === 'connecting') {
      q.setText('Connecting to server...');
    } else if (connectionStatus === 'timeout') {
      q.setText('Connection timeout. Please refresh.');
    } else if (connectionStatus === 'error') {
      q.setText('Connection error. Please check your network.');
    }
    
    setQuill(q);
  }, [connectionStatus]);

  return (
    <div className="container">
      <div className="status-bar">
        Status: {connectionStatus}
      </div>
      <div ref={wrapperRef}></div>
    </div>
  );
}

export default App;
