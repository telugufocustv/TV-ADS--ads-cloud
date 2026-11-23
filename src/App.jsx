function PlayerMode({ screenId }) {
  const [state, setState] = useState({ loading: true, error: "", screen: null, playlist: null, ads: [], tickers: [] });
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);

  async function loadPlayer() {
    if (!screenId) return;
    try {
      const result = await api(`/tv/${encodeURIComponent(screenId)}/player`);
      const ads = Array.isArray(result.ads) ? result.ads : Array.isArray(result.playlist?.ads) ? result.playlist.ads : [];
      const tickers = Array.isArray(result.tickers) ? result.tickers : [];
      setState({ loading: false, error: "", screen: result.screen || null, playlist: result.playlist || null, ads, tickers });
    } catch (err) {
      setState(curr => ({ ...curr, loading: false, error: err.message || "Failed to load TV ads." }));
    }
  }

  async function logPlayback(ad) {
    if (!ad) return;
    try {
      await api(`/tv/${encodeURIComponent(screenId)}/playback`, {
        method: "POST",
        body: JSON.stringify({
          adId: ad.id,
          adName: ad.name,
          duration: ad.duration || 10,
        }),
      });
    } catch {}
  }

  useEffect(() => {
    loadPlayer();
    const timer = setInterval(loadPlayer, 10000);
    return () => clearInterval(timer);
  }, [screenId]);

  const currentAd = state.ads.length ? state.ads[index % state.ads.length] : null;

  useEffect(() => {
    if (currentAd) {
      logPlayback(currentAd);
    }
  }, [currentAd?.id, index]);

  const goNext = () => {
    setIndex(i => (i + 1) % state.ads.length);
  };

  if (state.loading) return <div style={{ background: "#000", color: "#fff", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Connecting to Tirupati Central Hub...</div>;
  if (!state.ads.length) return <div style={{ background: "#000", color: "#fff", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>No ads assigned to this TV screen yet.</div>;

  const tickerText = state.tickers.map(t => `📢 ${t.text}`).join("     •     ");

  return (
    <div
      onClick={() => {
        setMuted(false);
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }}
      style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
    >
      <PlayerAd
        key={`${currentAd.id}_${index}`}
        ad={currentAd}
        muted={muted}
        onForceMute={() => setMuted(true)}
        onFinished={goNext}
      />

      {muted && (
        <button
          onClick={(e) => { e.stopPropagation(); setMuted(false); }}
          style={{ position: "fixed", top: "15px", right: "15px", zIndex: 50, padding: "8px 14px", background: "rgba(0,0,0,0.75)", color: "#fff", border: "1px solid #fff", borderRadius: "20px", cursor: "pointer", fontSize: "13px" }}
        >
          🔇 Tap Screen for Audio
        </button>
      )}

      {tickerText && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "linear-gradient(90deg, #b91c1c, #dc2626)", color: "#fff", padding: "10px 0", fontSize: "20px", fontWeight: "bold", zIndex: 40, overflow: "hidden", whiteSpace: "nowrap", boxShadow: "0 -2px 10px rgba(0,0,0,0.6)" }}>
          <style>{`
            @keyframes tamMarquee {
              0% { transform: translateX(100vw); }
              100% { transform: translateX(-100%); }
            }
            .tam-scroll-text {
              display: inline-block;
              animation: tamMarquee 22s linear infinite;
            }
          `}</style>
          <div className="tam-scroll-text">{tickerText}</div>
        </div>
      )}
    </div>
  );
}

function PlayerAd({ ad, muted, onForceMute, onFinished }) {
  useEffect(() => {
    if (ad.fileType?.startsWith("video/") && !ad.isSocial) return;
    const timer = setTimeout(onFinished, (ad.duration || 10) * 1000);
    return () => clearTimeout(timer);
  }, [ad, onFinished]);

  if (ad.isSocial) {
    const ytId = extractYouTubeId(ad.fileUrl);
    if (ytId) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&rel=0`}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="autoplay; fullscreen"
          title={ad.name}
        />
      );
    }
    return (
      <iframe
        src={ad.fileUrl}
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="autoplay; fullscreen"
        title={ad.name}
      />
    );
  }

  if (ad.fileType?.startsWith("video/")) {
    return (
      <video
        src={mediaUrl(ad.fileUrl)}
        autoPlay
        muted={muted}
        playsInline
        preload="auto"
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        ref={(el) => {
          if (!el) return;
          el.muted = muted;
          const playPromise = el.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Browser blocked unmuted autoplay -> immediately mute & force play without stopping!
              el.muted = true;
              onForceMute();
              el.play().catch(() => onFinished());
            });
          }
        }}
        onEnded={onFinished}
        onError={onFinished}
      />
    );
  }

  return <img src={mediaUrl(ad.fileUrl)} alt={ad.name} onError={onFinished} style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
}
