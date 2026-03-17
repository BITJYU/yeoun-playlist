let player;
let isPlaying = false;
let currentIndex = 0;
let currentPlaylistId = null;
let progressInterval = null;
let titleRequestId = 0;
let lastRenderedVideoId = null;
let hasTriedFallbackVideo = false;

const DEFAULT_VIDEO_URL = "https://www.youtube.com/watch?v=M7lc1UVf-VE";
const FALLBACK_VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
let playlist = [DEFAULT_VIDEO_URL];

const vinyl = document.getElementById("vinyl");
const playPauseBtn = document.getElementById("playpause");
const background = document.getElementById("background");
const cover = document.getElementById("cover");
const upload = document.getElementById("upload");
const coverWrapper = document.getElementById("cover-wrapper");
const progress = document.getElementById("progress");
const progressContainer = document.getElementById("progress-container");
const currentTimeText = document.getElementById("current-time");
const durationTimeText = document.getElementById("duration-time");
const songTitle = document.getElementById("song-title");
const mainTitle = document.getElementById("main-title");
const playlistInput = document.getElementById("playlist-url");
const loadPlaylistBtn = document.getElementById("load-playlist");
const settingsModal = document.getElementById("settings-modal");
const settingsBtn = document.getElementById("settings-btn");
const saveBtn = document.getElementById("save-settings");
const cancelBtn = document.getElementById("cancel-settings");
const titleInput = document.getElementById("title-input");
const playlistInputField = document.getElementById("playlist-input-field");
const effectSelect = document.getElementById("effect-select");
const coverUpload = document.getElementById("cover-upload");
const subtitle = document.querySelector(".sub-title");
const subtitleInput = document.getElementById("subtitle-input");
const pCanvas = document.getElementById("particles");
const pCtx = pCanvas.getContext("2d");

let particles = [];
let pType = null;
let animationFrame;

function extractVideoId(value) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const rawIdPattern = /^[a-zA-Z0-9_-]{11}$/;

  if (rawIdPattern.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1) || null;
    }

    if (url.searchParams.has("v")) {
      return url.searchParams.get("v");
    }

    if (url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/embed/")[1] || null;
    }
  } catch {
    return null;
  }

  return null;
}

function extractPlaylistId(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.searchParams.get("list");
  } catch {
    const match = value.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
  }
}

function normalizeYouTubeURL(url) {
  const videoId = extractVideoId(url);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
}

function getCurrentVideoId() {
  return extractVideoId(playlist[currentIndex]);
}

function getPlayerPlaylist() {
  if (!player || typeof player.getPlaylist !== "function") {
    return [];
  }

  const items = player.getPlaylist();
  return Array.isArray(items) ? items : [];
}

function syncCurrentIndexFromPlayer() {
  if (!currentPlaylistId || !player || typeof player.getPlaylistIndex !== "function") {
    return;
  }

  const playerIndex = player.getPlaylistIndex();
  if (typeof playerIndex === "number" && playerIndex >= 0) {
    currentIndex = playerIndex;
  }
}

function getActiveVideoId() {
  if (player && typeof player.getVideoData === "function") {
    const data = player.getVideoData();
    if (data && data.video_id) {
      return data.video_id;
    }
  }

  if (currentPlaylistId) {
    const playlistItems = getPlayerPlaylist();
    if (playlistItems.length > 0) {
      syncCurrentIndexFromPlayer();
      return playlistItems[currentIndex] || playlistItems[0] || null;
    }
  }

  return getCurrentVideoId();
}

function syncPlaybackUI(playing) {
  isPlaying = playing;
  playPauseBtn.textContent = playing ? "⏸" : "▶";
  playPauseBtn.setAttribute("aria-label", playing ? "일시정지" : "재생");
  vinyl.style.animationPlayState = playing ? "running" : "paused";
}

function setPlayerReadyState(isReady) {
  playPauseBtn.disabled = !isReady;
  playPauseBtn.style.opacity = isReady ? "1" : "0.5";
}

function applyCoverImage(imageURL) {
  cover.src = imageURL;
  background.style.background = `url(${imageURL}) center/cover no-repeat`;
  localStorage.setItem("albumCover", imageURL);
  detectBrightness(imageURL);
}

function restoreSavedCover() {
  const savedCover = localStorage.getItem("albumCover");

  if (savedCover) {
    applyCoverImage(savedCover);
  } else {
    detectBrightness(cover.src);
  }
}

function isYouTubeAPIReady() {
  return typeof YT !== "undefined" && typeof YT.Player === "function";
}

function createPlayer({ videoId = null, playlistId = null, index = 0 } = {}) {
  if (!isYouTubeAPIReady()) {
    return;
  }

  const playerOptions = {
    height: "1",
    width: "1",
    playerVars: { controls: 0, autoplay: 0, mute: 0, playsinline: 1 },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError
    }
  };

  if (window.location.protocol !== "file:") {
    playerOptions.playerVars.origin = window.location.origin;
  }

  if (playlistId) {
    playerOptions.playerVars.listType = "playlist";
    playerOptions.playerVars.list = playlistId;
    playerOptions.playerVars.index = index;
  } else if (videoId) {
    playerOptions.videoId = videoId;
  } else {
    console.warn("유효한 재생 대상이 없어 플레이어 초기화를 건너뜁니다.");
    return;
  }

  player = new YT.Player("youtube-player", playerOptions);
}

function loadVideoSource(videoId, autoplay = false) {
  if (!videoId) {
    console.warn("유효한 videoId가 없습니다.");
    return;
  }

  currentPlaylistId = null;
  playlist = [`https://www.youtube.com/watch?v=${videoId}`];
  currentIndex = 0;
  lastRenderedVideoId = null;
  resetProgressBar();

  if (!player || typeof player.loadVideoById !== "function") {
    createPlayer({ videoId });
    return;
  }

  if (autoplay) {
    player.loadVideoById(videoId);
  } else {
    player.cueVideoById(videoId);
    syncPlaybackUI(false);
  }
}

function loadPlaylistSource(playlistId, autoplay = false, index = 0) {
  if (!playlistId) {
    console.warn("유효한 playlistId가 없습니다.");
    return;
  }

  currentPlaylistId = playlistId;
  currentIndex = index;
  lastRenderedVideoId = null;
  resetProgressBar();

  const playlistOptions = {
    listType: "playlist",
    list: playlistId,
    index
  };

  if (!player || typeof player.loadPlaylist !== "function") {
    createPlayer({ playlistId, index });
    return;
  }

  if (autoplay) {
    player.loadPlaylist(playlistOptions);
  } else {
    player.cuePlaylist(playlistOptions);
    syncPlaybackUI(false);
  }
}

function onYouTubeIframeAPIReady() {
  setPlayerReadyState(false);
  syncPlaybackUI(false);
  loadVideoSource(getCurrentVideoId(), false);
}

window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

function onPlayerReady() {
  setPlayerReadyState(true);
  syncPlaybackUI(false);
  updateSongTitle(true);
}

function onPlayerError(event) {
  console.warn("YouTube player error:", event.data);

  if (!currentPlaylistId && !hasTriedFallbackVideo) {
    hasTriedFallbackVideo = true;
    loadVideoSource(extractVideoId(FALLBACK_VIDEO_URL), false);
    return;
  }

  songTitle.textContent = "재생할 수 없는 영상입니다";
}

async function fetchVideoTitle(videoId) {
  if (!videoId) {
    return "재생 중인 곡 없음";
  }

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.title;
  } catch {
    return "제목을 불러올 수 없습니다";
  }
}

async function updateSongTitle(force = false) {
  syncCurrentIndexFromPlayer();
  const videoId = getActiveVideoId();

  if (!videoId) {
    songTitle.textContent = "재생 중인 곡 없음";
    lastRenderedVideoId = null;
    return;
  }

  if (!force && videoId === lastRenderedVideoId) {
    return;
  }

  lastRenderedVideoId = videoId;
  const requestId = ++titleRequestId;
  songTitle.textContent = "불러오는 중...";

  const title = await fetchVideoTitle(videoId);
  if (requestId !== titleRequestId) {
    return;
  }

  songTitle.textContent = title;
}

function startProgress() {
  if (!player || typeof player.getCurrentTime !== "function") {
    return;
  }

  stopProgress();
  progressInterval = setInterval(() => {
    if (!player || typeof player.getCurrentTime !== "function") {
      return;
    }

    const current = player.getCurrentTime();
    const duration = player.getDuration();

    if (duration > 0) {
      const percent = (current / duration) * 100;
      progress.style.width = `${percent}%`;
      progressContainer.setAttribute("aria-valuenow", String(Math.round(percent)));
      currentTimeText.textContent = formatTime(current);
      durationTimeText.textContent = formatTime(duration);
    }
  }, 500);
}

function stopProgress() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

function resetProgressBar() {
  stopProgress();
  progress.style.width = "0%";
  progressContainer.setAttribute("aria-valuenow", "0");
  currentTimeText.textContent = "0:00";
  durationTimeText.textContent = "0:00";
}

function formatTime(seconds) {
  if (Number.isNaN(seconds)) {
    return "0:00";
  }

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? `0${s}` : s}`;
}

function onPlayerStateChange(event) {
  syncCurrentIndexFromPlayer();

  if (event.data === YT.PlayerState.PLAYING) {
    syncPlaybackUI(true);
    updateSongTitle();
    startProgress();
    return;
  }

  if (event.data === YT.PlayerState.PAUSED) {
    syncPlaybackUI(false);
    stopProgress();
    return;
  }

  if (event.data === YT.PlayerState.CUED) {
    syncPlaybackUI(false);
    updateSongTitle();
    stopProgress();
    return;
  }

  if (event.data === YT.PlayerState.ENDED) {
    syncPlaybackUI(false);
    resetProgressBar();

    if (!currentPlaylistId) {
      changeTrack(true, { autoplay: true });
    }
    return;
  }

  if (event.data === YT.PlayerState.BUFFERING) {
    stopProgress();
  }
}

function togglePlay() {
  if (!player || typeof player.playVideo !== "function") {
    console.warn("player가 아직 준비되지 않았습니다.");
    return;
  }

  if (isPlaying) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

function getPlaylistTargetIndex(next) {
  const playlistItems = getPlayerPlaylist();
  if (playlistItems.length === 0) {
    return null;
  }

  syncCurrentIndexFromPlayer();
  return next
    ? (currentIndex + 1) % playlistItems.length
    : (currentIndex - 1 + playlistItems.length) % playlistItems.length;
}

function changeTrack(next = true, options = {}) {
  const shouldAutoplay = options.autoplay ?? isPlaying;

  if (currentPlaylistId) {
    const targetIndex = getPlaylistTargetIndex(next);

    if (targetIndex === null) {
      console.warn("플레이리스트 항목을 찾을 수 없습니다.");
      return;
    }

    loadPlaylistSource(currentPlaylistId, shouldAutoplay, targetIndex);
    return;
  }

  if (playlist.length === 0) {
    return;
  }

  currentIndex = next
    ? (currentIndex + 1) % playlist.length
    : (currentIndex - 1 + playlist.length) % playlist.length;

  const nextId = getCurrentVideoId();
  if (!nextId) {
    console.warn("다음 트랙의 videoId를 찾을 수 없습니다.");
    updateSongTitle(true);
    return;
  }

  loadVideoSource(nextId, shouldAutoplay);
}

function loadFromInput(value, autoplay = false) {
  const playlistId = extractPlaylistId(value);

  if (playlistId) {
    playlistInput.value = value;
    loadPlaylistSource(playlistId, autoplay, 0);
    return true;
  }

  const videoId = extractVideoId(value);
  if (videoId) {
    playlistInput.value = normalizeYouTubeURL(value);
    loadVideoSource(videoId, autoplay);
    return true;
  }

  return false;
}

mainTitle.addEventListener("click", () => {
  const newTitle = prompt("새 제목을 입력하세요:", mainTitle.textContent);

  if (newTitle && newTitle.trim() !== "") {
    mainTitle.textContent = newTitle.trim();
  }
});

loadPlaylistBtn.addEventListener("click", () => {
  const value = playlistInput.value.trim();

  if (!value) {
    alert("YouTube 재생목록 또는 영상 URL을 입력하세요.");
    return;
  }

  const loaded = loadFromInput(value, false);
  if (!loaded) {
    alert("유효한 YouTube 재생목록 또는 영상 URL을 입력하세요.");
  }
});

function detectBrightness(imageURL) {
  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let colorSum = 0;

      for (let i = 0; i < data.length; i += 4) {
        colorSum += Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3);
      }

      const brightness = Math.floor(colorSum / (img.width * img.height));
      document.body.classList.toggle("light-theme", brightness > 150);
    } catch (error) {
      console.warn("표지 이미지 밝기 분석에 실패했습니다.", error);
      document.body.classList.remove("light-theme");
    }
  };

  img.onerror = () => {
    document.body.classList.remove("light-theme");
  };

  img.src = imageURL;
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isPlaying) {
    startProgress();
  }
});

coverWrapper.addEventListener("click", () => {
  upload.click();
});

upload.addEventListener("change", (event) => {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    applyCoverImage(loadEvent.target.result);
  };
  reader.readAsDataURL(file);
});

function resizeCanvas() {
  pCanvas.width = window.innerWidth;
  pCanvas.height = window.innerHeight;
}

function initParticles(type) {
  const count = type === "snow" ? 150 : 100;
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * pCanvas.width,
    y: Math.random() * pCanvas.height,
    r: type === "snow" ? 0.5 + Math.random() * 1.2 : 1 + Math.random() * 1.5,
    s: type === "snow" ? 0.2 + Math.random() * 0.5 : 1.5 + Math.random() * 2,
    drift: Math.random() * 1.5 - 0.75
  }));
}

function drawParticles() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  pCtx.fillStyle = "white";
  pCtx.beginPath();
  pCtx.shadowBlur = 0;
  pCtx.globalAlpha = 1;

  for (const particle of particles) {
    if (pType === "snow") {
      particle.y += particle.s * 0.6;
      particle.x += particle.drift * 0.3;

      if (particle.y > pCanvas.height) {
        particle.y = -5;
      }
      if (particle.x > pCanvas.width) {
        particle.x = 0;
      }
      if (particle.x < 0) {
        particle.x = pCanvas.width;
      }

      pCtx.shadowBlur = 6;
      pCtx.shadowColor = "rgba(255, 255, 255, 0.8)";
      pCtx.globalAlpha = 0.8;
      pCtx.moveTo(particle.x, particle.y);
      pCtx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    } else if (pType === "rain") {
      particle.y += particle.s;
      particle.x += particle.drift * 0.2;

      if (particle.y > pCanvas.height) {
        particle.y = -10;
      }

      pCtx.moveTo(particle.x, particle.y);
      pCtx.lineTo(particle.x, particle.y + 15);
    }
  }

  pCtx.strokeStyle = pType === "rain" ? "rgba(180, 220, 255, 0.7)" : "white";
  pCtx.lineWidth = pType === "rain" ? 1.2 : 0;
  pCtx.stroke();
  pCtx.fill();

  if (pType) {
    animationFrame = requestAnimationFrame(drawParticles);
  }
}

function startEffect(type) {
  pType = type;
  cancelAnimationFrame(animationFrame);
  initParticles(type);
  pCanvas.style.opacity = "1";
  drawParticles();
}

function stopEffect() {
  pType = null;
  cancelAnimationFrame(animationFrame);
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  pCanvas.style.opacity = "0";
}

function openSettings() {
  settingsModal.style.display = "flex";
  titleInput.value = mainTitle.textContent;
  subtitleInput.value = subtitle.textContent;
  playlistInputField.value = playlistInput.value;
}

function closeSettings() {
  settingsModal.style.display = "none";
}

settingsBtn.addEventListener("click", openSettings);
cancelBtn.addEventListener("click", closeSettings);

settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    closeSettings();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && settingsModal.style.display === "flex") {
    closeSettings();
  }
});

saveBtn.addEventListener("click", () => {
  mainTitle.textContent = titleInput.value.trim() || mainTitle.textContent;

  const subtitleText = subtitleInput.value.trim();
  subtitle.textContent = subtitleText || "찻잎의 잔향";

  const newURL = playlistInputField.value.trim();
  if (newURL) {
    loadFromInput(newURL, false);
  }

  const file = coverUpload.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      applyCoverImage(event.target.result);
    };
    reader.readAsDataURL(file);
  }

  const effect = effectSelect.value;
  if (effect === "snow") {
    startEffect("snow");
  } else if (effect === "rain") {
    startEffect("rain");
  } else {
    stopEffect();
  }

  closeSettings();
});

playPauseBtn.addEventListener("click", togglePlay);
document.getElementById("prev").addEventListener("click", () => changeTrack(false));
document.getElementById("next").addEventListener("click", () => changeTrack(true));

progressContainer.addEventListener("click", (event) => {
  if (!player || typeof player.getDuration !== "function") {
    return;
  }

  const duration = player.getDuration();
  if (!duration) {
    return;
  }

  const rect = progressContainer.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const seekRatio = Math.min(Math.max(offsetX / rect.width, 0), 1);
  player.seekTo(duration * seekRatio, true);
  startProgress();
});

window.addEventListener("DOMContentLoaded", () => {
  setPlayerReadyState(false);
  syncPlaybackUI(false);
  restoreSavedCover();
  resizeCanvas();
});

window.addEventListener("resize", resizeCanvas);
