// Vídeos de produto da Amazon são servidos como HLS (.m3u8), que só Safari/iOS
// tocam nativamente. Este helper carrega o player hls.js sob demanda (só quando
// alguém realmente vai assistir um vídeo) para funcionar também no Chrome/Firefox.
const HLS_JS_URL = "https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js";

function isHlsUrl(url) {
  return /\.m3u8(\?|#|$)/i.test(url);
}

function isYoutubeUrl(url) {
  return /youtube\.com|youtu\.be/i.test(url);
}

function loadHlsJs() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (window.__hlsLoadingPromise) return window.__hlsLoadingPromise;

  window.__hlsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = HLS_JS_URL;
    script.onload = () => resolve(window.Hls);
    script.onerror = () => reject(new Error("Não foi possível carregar o player de vídeo."));
    document.head.appendChild(script);
  });

  return window.__hlsLoadingPromise;
}

// Conecta a URL do vídeo a um elemento <video>, usando HLS nativo (Safari),
// hls.js (demais navegadores) ou atribuição direta (mp4 e afins).
async function attachVideoSource(videoEl, url) {
  if (!isHlsUrl(url)) {
    videoEl.src = url;
    return;
  }

  if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
    videoEl.src = url;
    return;
  }

  try {
    const Hls = await loadHlsJs();
    if (Hls && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(videoEl);
      return;
    }
  } catch {
    // segue para o fallback abaixo
  }

  videoEl.src = url;
}
