const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);

// Socket.IO configuration
const io = socketIO(server, {
  path: '/socket.io',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
    allowEIO3: true  // Add this for compatibility

});



// Create separate server for PeerJS
const peerApp = express();
const peerServer = http.createServer(peerApp);
const peerService = ExpressPeerServer(peerServer, {
  debug: true,
  path: '/'  // Set internal path to root
});

peerApp.use('/', peerService);  // Changed from '/peerjs'

// Serve static files
app.use(express.static('public'));
// Store sessions
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
    // Add this to server.js
socket.on('end-session', (sessionId) => {
  if (sessions[sessionId]) {
    io.to(sessionId).emit('session-ended');
    delete sessions[sessionId];
    console.log(`Session ${sessionId} ended by host`);
  }
});
});

// In server.js
peerService.on('connection', (client) => {
  console.log('PeerJS client connected:', client.getId());
});

peerService.on('disconnect', (client) => {
  console.log('PeerJS client disconnected:', client.getId());
});

peerService.on('error', (error) => {
  console.error('PeerJS server error:', error);
});
peerService.on('error', (error) => {
  console.error('PeerJS server error:', error);
});

// Start main server
server.listen(3000, () => {
    console.log("🚀 Main server running at http://localhost:3000");
});

// Start PeerJS server
peerServer.listen(3001, () => {
    console.log("🔌 PeerJS server running at http://localhost:3001");
});