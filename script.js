let player;
let isPlaying = false;
let currentIndex = 0;
let progressInterval = null;
let playlist = []; // 나중에 유저 입력 반영
let lastUpdate = Date.now();


const vinyl = document.getElementById('vinyl');
const playPauseBtn = document.getElementById('playpause');
const background = document.getElementById('background');
const cover = document.getElementById('cover');
const upload = document.getElementById('upload');
const coverWrapper = document.getElementById('cover-wrapper');
const progress = document.getElementById('progress');
const progressContainer = document.getElementById('progress-container');
const currentTimeText = document.getElementById('current-time');
const durationTimeText = document.getElementById('duration-time');
const songTitle = document.getElementById('song-title');
const mainTitle = document.getElementById('main-title');
const editTitleBtn = document.getElementById('edit-title');
const playlistInput = document.getElementById('playlist-url');
const loadPlaylistBtn = document.getElementById('load-playlist');
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

function extractVideoId(url) {
  const match = url.match(/v=([^&]+)/);
  return match ? match[1] : null;
}

function extractPlaylistId(url) {
  const match = url.match(/[?&]list=([^&]+)/);
  return match ? match[1] : null;
}

function onYouTubeIframeAPIReady() {
  // 초기 더미 플레이리스트 (없으면 기본 하나라도)
  playlist = ["PLEZxU6QNz271eHmBKYXJ9cLacIabzjHv9"];
  playPauseBtn.disabled = true;
  playPauseBtn.style.opacity = 0.5;
  initPlayer();
}

function initPlayer(videoId = null) {
  // 🔒 videoId 없으면 초기화 스킵
  if (!videoId) {
    console.warn("⚠️ 유효한 videoId가 없어 초기화를 건너뜁니다.");
    return;
  }

  player = new YT.Player("youtube-player", {
    height: "0",
    width: "0",
    videoId, // ✅ 유효한 값만 전달
    playerVars: { controls: 0, autoplay: 0, mute: 0 },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange
    }
  });
}

function onPlayerReady() {
  updateSongTitle();
  playPauseBtn.disabled = false;
  playPauseBtn.style.opacity = 1;
}

async function fetchVideoTitle(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    const data = await res.json();
    return data.title;
  } catch {
    return "제목을 불러올 수 없습니다";
  }
}

async function updateSongTitle() {
  const videoId = extractVideoId(playlist[currentIndex]);
  songTitle.textContent = "불러오는 중...";
  const title = await fetchVideoTitle(videoId);
  songTitle.textContent = title || "재생 중인 곡 없음";
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) startProgress();
  else stopProgress();
  if (event.data === YT.PlayerState.ENDED) changeTrack(true);
}

// 🎶 재생 / 일시정지
function togglePlay() {
  if (!player || typeof player.playVideo !== "function") {
    console.warn("⚠️ player가 아직 준비되지 않았습니다!");
    return;
  }
  if (!isPlaying) {
    player.playVideo();
    vinyl.style.animationPlayState = 'running';
    playPauseBtn.textContent = '⏸';
    isPlaying = true;
  } else {
    player.pauseVideo();
    vinyl.style.animationPlayState = 'paused';
    playPauseBtn.textContent = '▶';
    isPlaying = false;
  }
}


function changeTrack(next = true) {
  if (playlist.length === 0) return;

  currentIndex = next
    ? (currentIndex + 1) % playlist.length
    : (currentIndex - 1 + playlist.length) % playlist.length;

  const nextId = extractVideoId(playlist[currentIndex]);

  // 안전하게 player 준비되었는지 확인
  if (!player || typeof player.loadVideoById !== "function") {
    console.warn("⚠️ player가 아직 준비되지 않았습니다. 대기 중...");
    setTimeout(() => changeTrack(next), 500);
    return;
  }

  player.loadVideoById(nextId);
  updateSongTitle();

if (isPlaying) {
  // 사용자가 재생 중일 때만 다음 곡 자동재생
  player.playVideo();
  vinyl.style.animationPlayState = 'running';
} else {
  // 일시정지 상태면 재생하지 않음
  player.pauseVideo();
  vinyl.style.animationPlayState = 'paused';
}

}

function startProgress() {
   if (!player || typeof player.getCurrentTime !== "function") return; 
  stopProgress();
  progressInterval = setInterval(() => {
     if (!player || typeof player.getCurrentTime !== "function") return; 
    const current = player.getCurrentTime();
    const duration = player.getDuration();
    const elapsed = (Date.now() - lastUpdate) / 1000;

    if (duration > 0) {
      const percent = (current / duration) * 100;
      progress.style.width = `${percent}%`;
      currentTimeText.textContent = formatTime(current);
      durationTimeText.textContent = formatTime(duration);
    }
    lastUpdate = Date.now();
  }, 500);
}


function stopProgress() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" + s : s}`;
}

// 🔹 제목 변경 버튼
mainTitle.addEventListener('click', () => {
  const newTitle = prompt("새 제목을 입력하세요:", mainTitle.textContent);
  if (newTitle && newTitle.trim() !== "") {
    mainTitle.textContent = newTitle.trim();
  }
});

// 🔹 YouTube 플레이리스트 불러오기

loadPlaylistBtn.addEventListener("click", () => {
  const url = normalizeYouTubeURL(playlistInput.value.trim());
  const playlistId = extractPlaylistId(url);
  if (!playlistId) {
    alert("유효한 YouTube 플레이리스트 URL을 입력하세요.");
    return;
  }

  const proxy = "https://api.allorigins.win/raw?url=";
  const apiUrl = encodeURIComponent(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=20&playlistId=${playlistId}&key=AIzaSyDdNqVT7Etw1tYJQN6onzpUpSXceLtWNu0`
  );

  fetch(proxy + apiUrl)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      console.log("✅ Data:", data);

      if (!data.items || data.items.length === 0) {
        alert("⚠️ 플레이리스트를 불러올 수 없습니다. (항목이 없음)");
        return;
      }

      playlist = data.items.map(
        item => `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`
      );
      currentIndex = 0;

      const firstId = data.items[0].snippet.resourceId.videoId;
      console.log("🎵 첫 영상:", firstId);

      // ✅ 기존 player 있으면 갱신만
      if (player && typeof player.loadVideoById === "function") {
        player.loadVideoById(firstId);
      } else {
        initPlayer(firstId);
      }

      updateSongTitle();
      console.log(`🎧 총 ${playlist.length}곡 로드 완료`);
    })
    .catch(err => {
      console.error("❌ Proxy Error:", err);
      alert("플레이리스트를 불러올 수 없습니다. (CORS 또는 네트워크 오류)");
    });
});



/* 💾 페이지 로드 시 저장된 이미지 복원 */
window.addEventListener('DOMContentLoaded', () => {
  const savedCover = localStorage.getItem('albumCover');
  if (savedCover) {
    cover.src = savedCover;
    background.style.background = `url(${savedCover}) center/cover no-repeat`;
    detectBrightness(savedCover);
  }
});

/* 🌗 밝기 감지 함수 */
function detectBrightness(imageURL) {
  const img = new Image();
  img.src = imageURL;
  img.crossOrigin = "anonymous";

  img.onload = function() {
    // 임시 캔버스에 그림 그리기
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 전체 픽셀 데이터 분석
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let r, g, b, avg;
    let colorSum = 0;

    for (let i = 0, len = data.length; i < len; i += 4) {
      r = data[i];
      g = data[i + 1];
      b = data[i + 2];
      avg = Math.floor((r + g + b) / 3);
      colorSum += avg;
    }

    const brightness = Math.floor(colorSum / (img.width * img.height));

    // 밝기 기준값 (128보다 크면 밝은 이미지)
    if (brightness > 150) {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
  };
}

window.addEventListener('DOMContentLoaded', () => {
  const savedCover = localStorage.getItem('albumCover');
  if (savedCover) {
    cover.src = savedCover;
    background.style.background = `url(${savedCover}) center/cover no-repeat`;
    detectBrightness(savedCover);
  }
});

function normalizeYouTubeURL(url) {
  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1].split("?")[0];
    return `https://www.youtube.com/watch?v=${id}`;
  }
  return url;
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    // 탭으로 돌아왔을 때 다시 업데이트
    startProgress();
  }
});

// 🟢 표지 클릭 이벤트
coverWrapper.addEventListener('click', () => {
  upload.click();
});

upload.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgURL = e.target.result;
      cover.src = imgURL;
      background.style.background = `url(${imgURL}) center/cover no-repeat`;
      localStorage.setItem('albumCover', imgURL);
      detectBrightness(imgURL);
    };
    reader.readAsDataURL(file);
  }
});

const pCanvas = document.getElementById('particles');
const pCtx = pCanvas.getContext('2d');
let particles = [];
let pType = null; // 'snow' | 'rain' | null
let animationFrame;

function resizeCanvas() {
  pCanvas.width = window.innerWidth;
  pCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

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

  for (const p of particles) {
    if (pType === "snow") {
      p.y += p.s * 0.6;                // ❄️ 눈은 살짝 느리게
      p.x += p.drift * 0.3;            // ❄️ 옆으로 살짝 흩날림
      if (p.y > pCanvas.height) p.y = -5;
      if (p.x > pCanvas.width) p.x = 0;
      if (p.x < 0) p.x = pCanvas.width;
      
      pCtx.shadowBlur = 6;
      pCtx.shadowColor = "rgba(255, 255, 255, 0.8)";
      pCtx.globalAlpha = 0.8;

      pCtx.moveTo(p.x, p.y);
      pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      
      
    } else if (pType === "rain") {
      p.y += p.s;
      p.x += p.drift * 0.2;
      if (p.y > pCanvas.height) p.y = -10;
      pCtx.moveTo(p.x, p.y);
      pCtx.lineTo(p.x, p.y + 15);
    }
  }

  pCtx.strokeStyle = pType === "rain" ? "rgba(180, 220, 255, 0.7)" : "white";
  pCtx.lineWidth = pType === "rain" ? 1.2 : 0;
  pCtx.stroke();
  pCtx.fill();

  if (pType) animationFrame = requestAnimationFrame(drawParticles);
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

settingsBtn.addEventListener("click", () => {
  settingsModal.style.display = "flex";
  titleInput.value = mainTitle.textContent;
  subtitleInput.value = subtitle.innerHTML.replace(/<br\s*\/?>/g, "\n");
  playlistInputField.value = playlistInput.value;
});

// ✖ 닫기
cancelBtn.addEventListener("click", () => {
  settingsModal.style.display = "none";
});

// 💾 저장
saveBtn.addEventListener("click", () => {
  // 제목 수정
  mainTitle.textContent = titleInput.value;
  
  // 부제목(서브타이틀) 수정
  const subtitleText = subtitleInput.value.trim().replace(/\n/g, "<br>");
  subtitle.innerHTML = subtitleText || "찻잎의 잔향";

  // 플레이리스트 수정
  const newURL = playlistInputField.value.trim();
  if (newURL) {
    playlistInput.value = newURL;
    loadPlaylistBtn.click();
  }

  // 표지 수정
  const file = coverUpload.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgURL = e.target.result;
      cover.src = imgURL;
      background.style.background = `url(${imgURL}) center/cover no-repeat`;
      localStorage.setItem('albumCover', imgURL);
      detectBrightness(imgURL);
    };
    reader.readAsDataURL(file);
  }

  // 눈/비 효과 적용
  const effect = effectSelect.value;
  if (effect === "snow") startEffect("snow");
  else if (effect === "rain") startEffect("rain");
  else stopEffect();

  // 닫기
  settingsModal.style.display = "none";
});
