(() => {
  const PROTOCOL = "listensub/1";
  try { window.__listensubStop?.(); } catch {}
  console.info("[ListenSub] playback clock 0.2.8 loaded");

  let active = true;
  let observedVideo = null;
  let pollTimer = 0;
  let lastSent = 0;

  function stop() {
    if (!active) return;
    active = false;
    clearInterval(pollTimer);
    if (observedVideo) {
      for (const event of ["timeupdate", "play", "pause", "seeked", "ratechange", "ended"]) {
        observedVideo.removeEventListener(event, send);
      }
    }
    document.removeEventListener("yt-navigate-finish", onNavigate);
    try { chrome.runtime.onMessage.removeListener(onRuntimeMessage); } catch {}
    try { if (window.__listensubStop === stop) delete window.__listensubStop; } catch {}
  }

  function getVideo() {
    return document.querySelector("video.html5-main-video") || document.querySelector("video");
  }

  function snapshot() {
    const video = getVideo();
    return {
      videoId: new URL(location.href).searchParams.get("v"),
      url: location.href,
      title: document.querySelector("h1 yt-formatted-string")?.textContent?.trim() || document.title.replace(/ - YouTube$/, ""),
      currentTime: video?.currentTime || 0,
      playbackRate: video?.playbackRate || 1,
      paused: video?.paused ?? true,
      ended: video?.ended ?? false,
      updatedAt: Date.now()
    };
  }

  function send() {
    if (!active) return;
    try { if (!chrome.runtime?.id) return stop(); } catch { return stop(); }
    if (Date.now() - lastSent < 200) return;
    lastSent = Date.now();
    try {
      chrome.runtime.sendMessage({ protocol: PROTOCOL, type: "STATE", state: snapshot() }, () => {
        try { void chrome.runtime.lastError; } catch { stop(); }
      });
    } catch { stop(); }
  }

  function attachVideo() {
    const video = getVideo();
    if (!video || video === observedVideo) return;
    if (observedVideo) {
      for (const event of ["timeupdate", "play", "pause", "seeked", "ratechange", "ended"]) {
        observedVideo.removeEventListener(event, send);
      }
    }
    observedVideo = video;
    for (const event of ["timeupdate", "play", "pause", "seeked", "ratechange", "ended"]) {
      video.addEventListener(event, send, { passive: true });
    }
    send();
  }

  function onNavigate() { attachVideo(); send(); }
  function onRuntimeMessage(message, _sender, respond) {
    if (message?.protocol !== PROTOCOL) return;
    if (message.type === "REQUEST_STATE") {
      respond({ state: snapshot() });
      return;
    }
    if (message.type !== "PLAYER_CONTROL") return;
    const video = getVideo();
    if (!video) { respond({ ok: false, error: "YouTube video player is not ready." }); return; }
    if (message.command === "PAUSE") {
      video.pause();
      send();
      respond({ ok: true });
      return;
    }
    if (message.command === "PLAY") {
      Promise.resolve(video.play()).then(() => {
        send();
        respond({ ok: true });
      }).catch(() => respond({ ok: false, error: "Chrome blocked playback. Click Play in the YouTube tab once, then try again." }));
      return true;
    }
    respond({ ok: false, error: "Unsupported player command." });
  }

  function start() {
    window.__listensubStop = stop;
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
    document.addEventListener("yt-navigate-finish", onNavigate);
    attachVideo();
    send();
    // Keep the reader clock moving even if YouTube suppresses media events in
    // a background tab. Four updates per second stays lightweight and gives
    // the separate reader a fresh timestamp for interpolation.
    pollTimer = setInterval(() => { attachVideo(); send(); }, 250);
  }

  start();
})();
