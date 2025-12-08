// ========== DOM Elements ==========
const createUserBtn = document.getElementById("create-user");
const username = document.getElementById("username");
const allusersHtml = document.getElementById("allusers");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCallBtn = document.getElementById("end-call-btn");
const muteButton = document.getElementById("mute-call-btn");
const youtubeUrlInput = document.getElementById("youtube-url");
const youtubePlayer = document.getElementById("youtube-player");
const loadYoutubeVideoButton = document.getElementById("load-youtube-video");
const uploadInput = document.getElementById("video-url");
const uploadBtn = document.getElementById("load-video");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const sendChatBtn = document.getElementById("send-chat-btn");

// ========== Global Variables ==========
const socket = io();
let localStream;
let caller = [];
let isMuted = false;

// ========== PeerConnection Singleton ==========
const PeerConnection = (() => {
    let peerConnection;

    const createPeerConnection = () => {
        const config = {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        };

        peerConnection = new RTCPeerConnection(config);

        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("icecandidate", event.candidate);
            }
        };

        return peerConnection;
    };

    return {
        getInstance: () => peerConnection || createPeerConnection(),
    };
})();

// ========== Video Call Events ==========
createUserBtn.addEventListener("click", () => {
    if (username.value !== "") {
        document.querySelector(".username-input").style.display = "none";
        socket.emit("join-user", username.value);
    }
});

endCallBtn.addEventListener("click", () => {
    socket.emit("call-ended", caller);
});

muteButton.addEventListener("click", () => {
    const localStream = localVideo.srcObject;
    if (!localStream) return console.error("No local stream found.");

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
        isMuted = !isMuted;
        audioTracks[0].enabled = !isMuted;
        muteButton.innerHTML = isMuted
            ? '<img height="30px" width="30px" src="/images/unmute.png">'
            : '<img height="30px" width="30px" src="/images/mute.png">';
    }
});

const startCall = async (user) => {
    const pc = PeerConnection.getInstance();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { from: username.value, to: user, offer });
};

const endCall = () => {
    const pc = PeerConnection.getInstance();
    if (pc) pc.close();
    endCallBtn.style.display = "none";
    muteButton.style.display = "none";
};

// ========== Media Setup ==========
const startMyVideo = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        localStream = stream;
        localVideo.srcObject = stream;
    } catch (error) {
        console.error("Error accessing media devices:", error);
    }
};

// ========== Socket Events ==========
socket.on("joined", (allusers) => {
    allusersHtml.innerHTML = "";
    for (const user in allusers) {
        const li = document.createElement("li");
        li.textContent = `${user} ${user === username.value ? "(You)" : ""}`;

        if (user !== username.value) {
            const button = document.createElement("button");
            button.classList.add("call-btn");
            button.addEventListener("click", () => startCall(user));

            const img = document.createElement("img");
            img.src = "/images/phone.png";
            img.width = 20;

            button.appendChild(img);
            li.appendChild(button);
        }

        allusersHtml.appendChild(li);
    }
});

socket.on("offer", async ({ from, to, offer }) => {
    const pc = PeerConnection.getInstance();
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { from, to, answer: pc.localDescription });
    caller = [from, to];
});

socket.on("answer", async ({ answer }) => {
    const pc = PeerConnection.getInstance();
    await pc.setRemoteDescription(answer);
    endCallBtn.style.display = "block";
});

socket.on("icecandidate", async (candidate) => {
    const pc = PeerConnection.getInstance();
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("call-ended", () => {
    endCall();
});

// ========== Chat ==========
sendChatBtn.addEventListener("click", () => {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit("chat-message", { username: username.value, message });
        addChatMessage({ username: "You", message });
        chatInput.value = "";
    }
});

chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        sendChatBtn.click();
    }
});

socket.on("chat-message", addChatMessage);

function addChatMessage({ username, message }) {
    const messageDiv = document.createElement("div");
    messageDiv.innerHTML = `<strong>${username}:</strong> ${message}`;
    chatMessages.appendChild(messageDiv);
}

// ========== YouTube Video Sync ==========
loadYoutubeVideoButton.addEventListener("click", () => {
    const youtubeUrl = youtubeUrlInput.value.trim();
    const videoId = extractYoutubeVideoId(youtubeUrl);

    if (videoId) {
        const timestamp = Date.now();
        youtubePlayer.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1`;
        socket.emit("sync-youtube-video", { videoId, timestamp });
    } else {
        alert("Invalid YouTube URL");
    }
});

socket.on("sync-youtube-video", ({ videoId, timestamp }) => {
    const delay = Date.now() - timestamp;
    youtubePlayer.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&start=${Math.floor(delay / 1000)}`;
});

socket.on("play-video", (timestamp) => {
    player.seekTo(timestamp, true);
    player.playVideo();
});

socket.on("pause-video", (timestamp) => {
    player.seekTo(timestamp, true);
    player.pauseVideo();
});

function extractYoutubeVideoId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// ========== Media Upload ==========
uploadBtn.addEventListener("click", () => {
    const file = uploadInput.files[0];
    if (!file || !(file.type.startsWith("video") || file.type.startsWith("image"))) {
        alert("Please upload a valid video or image file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        socket.emit("media-uploaded", { dataUrl, type: file.type });
        replaceIframeWithMedia(dataUrl, file.type);
    };
    reader.readAsDataURL(file);
});

socket.on("media-uploaded", ({ dataUrl, type }) => {
    replaceIframeWithMedia(dataUrl, type);
});

function replaceIframeWithMedia(dataUrl, type) {
    const container = youtubePlayer.parentElement;
    const existing = container.querySelector("iframe, video, img");
    if (existing) existing.remove();

    let element;
    if (type.startsWith("video")) {
        element = document.createElement("video");
        element.controls = true;
        element.autoplay = true;
    } else if (type.startsWith("image")) {
        element = document.createElement("img");
    }

    if (element) {
        element.src = dataUrl;
        element.width = 560;
        element.height = 315;
        container.appendChild(element);
    }
}
function replaceIframeWithMedia(dataUrl, type) {
    const container = youtubePlayer.parentElement;

    // Remove all iframe, video, or image elements
    const existingMedia = container.querySelectorAll("iframe, video, img");
    existingMedia.forEach(el => el.remove());

    let element;
    if (type.startsWith("video")) {
        element = document.createElement("video");
        element.controls = true;
        element.autoplay = true;
    } else if (type.startsWith("image")) {
        element = document.createElement("img");
    }

    if (element) {
        element.src = dataUrl;
        element.width = 560;
        element.height = 315;
        element.style.borderRadius = "8px"; // optional styling
        container.appendChild(element);
    }
}


// ========== Start App ==========
startMyVideo();
