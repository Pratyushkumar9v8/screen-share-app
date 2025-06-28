 // DOM Elements
        const video = document.getElementById('video');
        const status = document.getElementById('status');
        const viewerVideo = document.getElementById('viewerVideo');
        const viewerStatus = document.getElementById('viewerStatus');
        const notification = document.getElementById('notification');
        const notificationMessage = document.getElementById('notificationMessage');
        
        // Track status elements
        const audioStatus = document.getElementById('audioStatus');
        const videoStatus = document.getElementById('videoStatus');
        const viewerAudioStatus = document.getElementById('viewerAudioStatus');
        const viewerVideoStatus = document.getElementById('viewerVideoStatus');
        
        // Socket.IO and PeerJS setup
const socket = io(window.location.origin, {
  path: '/socket.io',
  transports: ['polling'],
  secure: true
});


        
        // Fix PeerJS initialization
        // Update PeerJS initialization
const peer = new Peer(undefined, {
  host: window.location.hostname,
  port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
  path: '/peerjs',
  secure: window.location.protocol === 'https:'
});

peer.on('call', call => {
    console.log("📞 Host received call from", call.peer);

    if (!currentStream || currentStream.getTracks().length === 0) {
        console.error("❌ No stream to send to viewer.");
        return;
    }

    console.log("📡 Answering call with tracks:", currentStream.getTracks().map(t => t.kind));
    call.answer(currentStream);  // 🔥 This must happen once only

    activeCalls[call.peer] = call;

    call.on('stream', viewerMicStream => {
        console.log("🎤 Received viewer mic stream");
    });

    call.on('close', () => {
        console.log("🚪 Viewer disconnected");
        delete activeCalls[call.peer];
    });

    call.on('error', err => {
        console.error("Call error:", err);
    });
});

        // In index.html script
peer.on('error', (err) => {
  console.error('PeerJS error:', err);
  showNotification(`PeerJS error: ${err.type}`, true);
  
  // Reinitialize Peer on certain errors
  if (err.type === 'disconnected') {
    initializePeer();
  }
});

function initializePeer() {
  return new Peer(undefined, {
    host: window.location.hostname,
    port: 3001,
    path: '/',
    debug: 3
  });
}
        // Global variables
        let currentStream = null;
        let activeCalls = {};
        let sessionId = null;
        
        // Event Listeners
        socket.on('connect', () => {
            console.log('✅ Socket.IO connected');
            showNotification('Connected to signaling server');
        });
        
        socket.on('disconnect', () => {
            console.log('❌ Socket.IO disconnected');
            showNotification('Disconnected from signaling server', true);
        });
        
        peer.on('open', peerId => {
            window.peerId = peerId;
            console.log('🔑 Peer ID:', peerId);
        });
        
        // Notification function
        function showNotification(message, isError = false) {
            notificationMessage.textContent = message;
            notification.className = 'notification show';
            if (isError) notification.classList.add('error');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
        
        // Track monitoring
        function monitorTracks(stream, isHost = true) {
            if (!stream) return;
            
            const audioTracks = stream.getAudioTracks();
            const videoTracks = stream.getVideoTracks();
            
            if (isHost) {
                audioStatus.textContent = audioTracks.length > 0 ? 'Active' : 'Inactive';
                audioStatus.style.color = audioTracks.length > 0 ? '#4cc9f0' : '#f72585';
                
                videoStatus.textContent = videoTracks.length > 0 ? 'Active' : 'Inactive';
                videoStatus.style.color = videoTracks.length > 0 ? '#4cc9f0' : '#f72585';
            } else {
                viewerAudioStatus.textContent = audioTracks.length > 0 ? 'Active' : 'Inactive';
                viewerAudioStatus.style.color = audioTracks.length > 0 ? '#4cc9f0' : '#f72585';
                
                viewerVideoStatus.textContent = videoTracks.length > 0 ? 'Active' : 'Inactive';
                viewerVideoStatus.style.color = videoTracks.length > 0 ? '#4cc9f0' : '#f72585';
            }
        }
        
// Webcam-based debug version for host
async function startSession() {
    const password = document.getElementById('password').value;
    if (!password) {
        showNotification('Please enter a session password', true);
        return;
    }

    let videoStream, micStream;
    try {
        // ✅ Use webcam instead of getDisplayMedia
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: false
        });
        console.log("🎥 Webcam video stream tracks:", videoStream.getVideoTracks());

        micStream = await navigator.mediaDevices.getUserMedia({
            audio: { noiseSuppression: true, echoCancellation: true },
            video: false
        });
        console.log("🎤 Mic stream tracks:", micStream.getAudioTracks());
    } catch (err) {
        console.error("Error capturing media:", err);
        showNotification("Media capture failed: " + err.message, true);
        return;
    }

    const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...micStream.getAudioTracks()
    ]);
    console.log("📡 Combined stream tracks:", combinedStream.getTracks());

    currentStream = combinedStream;
    video.srcObject = combinedStream;
    status.textContent = "Sharing webcam...";
    status.classList.add('connected');

    document.getElementById('hostVideoContainer').classList.remove('hidden');
    document.getElementById('startBtn').classList.add('hidden');
    document.getElementById('stopBtn').classList.remove('hidden');

    monitorTracks(currentStream);
    setInterval(() => monitorTracks(currentStream), 2000);

    socket.emit('start-session', { password, peerId: window.peerId });
    socket.once('session-started', newSessionId => {
        sessionId = newSessionId;
        document.getElementById('sessionInfo').classList.remove('hidden');
        document.getElementById('sessionIdDisplay').textContent = sessionId;
        showNotification(`Session started! ID: ${sessionId}`);
    });
}


        
        // HOST: Stop sharing session
        function stopSession() {
            // End all active calls
            Object.values(activeCalls).forEach(call => call.close());
            
            // Stop all tracks
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
            
            // Reset UI
            video.srcObject = null;
            status.textContent = "Disconnected";
            status.classList.remove('connected');
            document.getElementById('hostVideoContainer').classList.add('hidden');
            document.getElementById('sessionInfo').classList.add('hidden');
            document.getElementById('startBtn').classList.remove('hidden');
            document.getElementById('stopBtn').classList.add('hidden');
            
            // Notify server
            if (sessionId) {
                socket.emit('end-session', sessionId);
                sessionId = null;
            }
            
            showNotification("Session ended");
        }
        
        // VIEWER: Join session
        async function joinSession() {
            const sessionIdInput = document.getElementById('sessionId').value;
            const password = document.getElementById('joinPassword').value;
            
            if (!sessionIdInput || !password) {
                showNotification('Please enter both session ID and password', true);
                return;
            }
            
            try {
                // Get viewer's mic
                const viewerMicStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { noiseSuppression: true, echoCancellation: true }
                });
                
                // Show viewer UI
                document.getElementById('viewerVideoContainer').classList.remove('hidden');
                document.getElementById('joinBtn').classList.add('hidden');
                document.getElementById('leaveBtn').classList.remove('hidden');
                viewerStatus.textContent = "Connecting...";
                
                // Join session
                socket.emit('join-session', { sessionId: sessionIdInput, password });
                
                // Handle session joined
                socket.once('session-joined', async ({ peerId }) => {
                    viewerStatus.textContent = "Connected";
                    viewerStatus.classList.add('connected');
                    
                    // Call host
                    const call = peer.call(peerId, viewerMicStream);
                    
                    // Handle host stream
                    
// Autoplay-safe viewer stream handler

call.on('stream', hostStream => {
    console.log("✅ Received host stream with tracks:", hostStream.getTracks().map(t => t.kind));

    viewerVideo.srcObject = hostStream;
    viewerVideo.muted = false;
    viewerVideo.setAttribute("playsinline", true);

    const audio = new Audio();
    audio.srcObject = new MediaStream(hostStream.getAudioTracks());
    audio.autoplay = false;
const tracks = hostStream.getTracks();
console.log("All received tracks:", tracks.map(t => `${t.kind} - enabled: ${t.enabled}`));

tracks.forEach(t => {
  t.onended = () => console.warn(`${t.kind} track ended`);
  t.onmute = () => console.warn(`${t.kind} track muted`);
  t.onunmute = () => console.info(`${t.kind} track unmuted`);
});

    // Show a prompt to viewer
    const unmuteButton = document.createElement("button");
    unmuteButton.textContent = "🔊 Click to Start Audio/Video";
    unmuteButton.style = "padding:10px;font-size:16px;margin-top:10px;";
    document.body.appendChild(unmuteButton);

    unmuteButton.onclick = () => {
        audio.play().catch(err => console.warn("Audio play error:", err));
        viewerVideo.play().catch(err => console.warn("Video play error:", err));
        unmuteButton.remove();
    };

    monitorTracks(hostStream, false);
    setInterval(() => monitorTracks(hostStream, false), 2000);
});

                    
                    call.on('close', () => {
                        viewerStatus.textContent = "Disconnected";
                        viewerStatus.classList.remove('connected');
                        viewerVideo.srcObject = null;
                        showNotification("Disconnected from host");
                    });
                    
                    call.on('error', err => {
                        console.error('Call error:', err);
                        showNotification("Connection error: " + err.message, true);
                    });
                });
                
                // Handle errors
                peer.on('error', (err) => {
                  console.error('PeerJS error:', err);
                  showNotification(`PeerJS error: ${err.type}`, true);
                });
                socket.once('error-message', msg => {
                    showNotification(msg, true);
                });
                
                socket.once('session-ended', () => {
                    showNotification("Session ended by host", true);
                    viewerStatus.textContent = "Session ended";
                    viewerStatus.classList.remove('connected');
                    viewerVideo.srcObject = null;
                });
                
            } catch (err) {
                console.error("Error joining session:", err);
                showNotification("Failed to join session: " + err.message, true);
            }
        }
        
        // VIEWER: Leave session
        function leaveSession() {
            viewerVideo.srcObject = null;
            viewerStatus.textContent = "Disconnected";
            viewerStatus.classList.remove('connected');
            document.getElementById('viewerVideoContainer').classList.add('hidden');
            document.getElementById('joinBtn').classList.remove('hidden');
            document.getElementById('leaveBtn').classList.add('hidden');
            showNotification("Left session");
        }