let player;
let isPlaying = false;
let currentIndex = 0;
let progressInterval = null;
let playlist = []; // 나중에 유저 입력 반영

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
  playlist = ["https://youtube.com/playlist?list=PLEZxU6QNz271eHmBKYXJ9cLacIabzjHv9&si=jN-uqzWMB4bdtiEX"];
  playPauseBtn.disabled = true;
  playPauseBtn.style.opacity = 0.5;
  initPlayer();
}

function initPlayer() {
  player = new YT.Player('youtube-player', {
    height: '0',
    width: '0',
    videoId: extractVideoId(playlist[currentIndex]),
    playerVars: { controls: 0, autoplay: 1, mute: 1 }, // ✅ 자동재생 허용
    events: { onStateChange: onPlayerStateChange, onReady: onPlayerReady }
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

let lastUpdate = Date.now();

function startProgress() {
  stopProgress();
  progressInterval = setInterval(() => {
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
editTitleBtn.addEventListener('click', () => {
  const newTitle = prompt("새 제목을 입력하세요:", mainTitle.textContent);
  if (newTitle && newTitle.trim() !== "") {
    mainTitle.textContent = newTitle.trim();
  }
});

// 🔹 YouTube 플레이리스트 불러오기
loadPlaylistBtn.addEventListener('click', () => {
  const url = normalizeYouTubeURL(playlistInput.value.trim());
  const playlistId = extractPlaylistId(url);
  if (!playlistId) {
    alert("유효한 YouTube 플레이리스트 URL을 입력하세요.");
    return;
  }

// ✅ CORS Proxy 적용 (allorigins으로 교체)
const proxy = "https://api.allorigins.win/raw?url=";
const apiUrl = encodeURIComponent(
  `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=20&playlistId=${playlistId}&key=AIzaSyDdNqVT7Etw1tYJQN6onzpUpSXceLtWNu0`
);

fetch(proxy + apiUrl)
  .then(res => res.json())
  .then(data => {
    console.log("✅ Data:", data);
    if (!data || !Array.isArray(data.items) || data.items.length === 0) {
      alert("⚠️ 플레이리스트를 불러올 수 없습니다. (항목이 없음)");
      return;
    }

    playlist = data.items.map(
      item => `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`
    );
    currentIndex = 0;

    const firstId = extractVideoId(playlist[0]);

    // ✅ player 존재 확인 후 처리
    if (!player || typeof player.loadVideoById !== "function") {
      console.warn("⚠️ player 초기화 중... onReady 후 재시도 예정");
      initPlayer();
      const waitForPlayer = setInterval(() => {
        if (player && typeof player.loadVideoById === "function") {
          clearInterval(waitForPlayer);
          player.loadVideoById(firstId);
          updateSongTitle();
        }
      }, 500);
    } else {
      player.loadVideoById(firstId);
      updateSongTitle();
    }

    alert(`🎧 플레이리스트가 성공적으로 불러와졌습니다! 총 ${playlist.length}곡`);
  })
  .catch(err => {
    console.error("❌ Proxy Error:", err);
    alert("플레이리스트를 불러올 수 없습니다. (프록시 또는 네트워크 오류)");
  });


// 🟢 표지 클릭 이벤트 (이건 loadPlaylistBtn 밖에 둬야 함)
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
    if (brightness > 128) {
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
