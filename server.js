const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Serve static files from public/
app.use(express.static('public'));

// Setup PeerJS server
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});
app.use('/peerjs', peerServer);

// Setup Socket.IO
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Session store
const sessions = {};

io.on('connection', socket => {
  console.log("✅ New client connected");

  socket.on('start-session', ({ password, peerId }) => {
    const sessionId = Math.random().toString(36).substr(2, 6).toUpperCase();
    sessions[sessionId] = { password, host: socket.id, peerId };
    socket.join(sessionId);
    socket.emit('session-started', sessionId);
    console.log(`Session started: ${sessionId} by ${peerId}`);
  });

  socket.on('join-session', ({ sessionId, password }) => {
    const session = sessions[sessionId];
    if (session && session.password === password) {
      socket.join(sessionId);
      socket.emit('session-joined', {
        sessionId,
        peerId: session.peerId
      });
      console.log(`Viewer joined session ${sessionId}`);
    } else {
      socket.emit('error-message', '❌ Session not found or incorrect password');
    }
  });

  socket.on('end-session', (sessionId) => {
    if (sessions[sessionId]) {
      io.to(sessionId).emit('session-ended');
      delete sessions[sessionId];
      console.log(`Session ${sessionId} ended by host`);
    }
  });

  socket.on('disconnect', () => {
    for (const sessionId in sessions) {
      if (sessions[sessionId].host === socket.id) {
        io.to(sessionId).emit('session-ended');
        delete sessions[sessionId];
        console.log(`Session ${sessionId} ended`);
        break;
      }
    }
  });
});

// Log PeerJS connections
peerServer.on('connection', client => {
  console.log('🔌 PeerJS client connected:', client.getId());
});

peerServer.on('disconnect', client => {
  console.log('❌ PeerJS client disconnected:', client.getId());
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
