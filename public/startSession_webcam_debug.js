
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
