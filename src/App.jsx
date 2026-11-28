import { useEffect, useMemo, useState } from "react";

const DEFAULT_API = "/api";

function normalizeServerUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return DEFAULT_API;
  if (/\/api$/i.test(raw)) return raw;
  return `${raw}/api`;
}

function getApiBase() {
  const saved = localStorage.getItem("tam_server_url");
  return saved ? normalizeServerUrl(saved) : DEFAULT_API;
}

function getServerOrigin() {
  const saved = localStorage.getItem("tam_server_url");
  if (!saved) return window.location.origin;
  const raw = String(saved).trim().replace(/\/+$/, "");
  return raw.replace(/\/api$/i, "");
}

function mediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (raw.startsWith("/")) return `${getServerOrigin()}${raw}`;
  return `${getServerOrigin()}/${raw}`;
}

function parseSocialEmbed(url) {
  const raw = String(url || "").trim();
  const ytMatch = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return {
      type: "youtube",
      src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&controls=0&rel=0&playsinline=1`
    };
  }
  const vimeoMatch = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return { type: "iframe", src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1` };
  }
  const dmMatch = raw.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
  if (dmMatch) {
    return { type: "iframe", src: `https://www.dailymotion.com/embed/video/${dmMatch[1]}?autoplay=1` };
  }
  if (/facebook\.com|fb\.watch/i.test(raw)) {
    return { type: "iframe", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(raw)}&show_text=false&autoplay=true` };
  }
  const igMatch = raw.match(/instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/);
  if (igMatch) {
    return { type: "iframe", src: `https://www.instagram.com/p/${igMatch[1]}/embed` };
  }
  if (/\.(mp4|webm|ogg|mov|m3u8)(\?|$)/i.test(raw)) {
    return { type: "direct_video", src: raw };
  }
  return { type: "iframe", src: raw };
}

const NAV = [
  ["dashboard", "🏠 Dashboard"],
  ["areas", "📍 Areas"],
  ["screens", "📺 TV Screens"],
  ["ads", "🎞 Advertisements"],
  ["playlists", "▶ Playlists"],
  ["schedules", "🕒 Schedules"],
  ["live", "🔴 Live & Emergency"],
  ["branding", "🎨 Logo & Clock Layout"],
  ["franchise", "🏢 Franchise"],
  ["crm", "👥 Clients / CRM"],
  ["billing", "💰 Billing & Invoices"],
  ["news", "📰 Flash News & Tickers"],
  ["social", "📱 Social Media Sync"],
  ["marketing", "📢 Marketing & Leads"],
  ["aitools", "🤖 AI Tools"],
  ["reports", "📊 Reports"],
  ["settings", "⚙ Users, Password & Backup"],
];

async function api(path, options = {}) {
  const token = localStorage.getItem("tam_token");

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(getApiBase() + path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const result = await response.json();
      message = result.error || message;
    } catch {}
    throw new Error(message);
  }

  return response.json();
}

const emptyData = {
  areas: [],
  screens: [],
  ads: [],
  playlists: [],
  schedules: [],
  devices: [],
  playback: [],
  franchises: [],
  clients: [],
  billings: [],
  tickers: [],
  socials: [],
  users: [],
  brandSettings: {
    brandName: "TV AD MANAGER PRO",
    logoUrl: "",
    showClock: true,
    showWatermark: true,
    emergencyActive: false,
    emergencyTitle: ""
  },
  cloudEnabled: false,
  dbPersistent: false,
};

function AdminApp() {
  const [token, setToken] = useState(localStorage.getItem("tam_token"));
  const [page, setPage] = useState("dashboard");
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const result = await api("/state");
      setData({
        ...emptyData,
        ...result,
      });
    } catch (err) {
      setError(err.message);
      if (
        err.message.toLowerCase().includes("login") ||
        err.message.toLowerCase().includes("session")
      ) {
        localStorage.removeItem("tam_token");
        setToken(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadData();
      const autoRefresh = setInterval(() => loadData(true), 15000);
      return () => clearInterval(autoRefresh);
    } else {
      setLoading(false);
    }
  }, [token]);

  if (!token) {
    return (
      <Login
        onLogin={(newToken) => {
          localStorage.setItem("tam_token", newToken);
          setToken(newToken);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="login">
        <div className="loginbox">
          <h2>TV AD MANAGER PRO</h2>
          <p>Connecting to Remote Network...</p>
        </div>
      </div>
    );
  }

  const activeClientsCount = new Set([
    ...(data.clients || []).map(c => c.name),
    ...(data.billings || []).map(b => b.client),
    ...(data.ads || []).map(a => a.clientName).filter(Boolean),
  ]).size;

  const counts = {
    areas: data.areas.length,
    screens: data.screens.length,
    ads: data.ads.length,
    playlists: data.playlists.length,
    online: data.screens.filter((screen) => screen.status === "online").length,
    franchises: (data.franchises || []).length,
    clients: activeClientsCount,
    plays: (data.playback || []).length,
  };

  const currentTitle = NAV.find(([key]) => key === page)?.[1] || "Dashboard";

  return (
    <div className="app" style={{ display: "flex", minHeight: "100vh" }}>
      <aside className="side" style={{ width: "260px", background: "#0f172a", color: "#fff", flexShrink: 0, padding: "20px 10px", display: "flex", flexDirection: "column" }}>
        <div className="brand" style={{ padding: "0 15px 20px", borderBottom: "1px solid #1e293b", fontSize: "18px", fontWeight: "bold" }}>
          📺 TV AD <small style={{ display: "block", fontSize: "11px", color: "#38bdf8", letterSpacing: "1px" }}>MANAGER PRO</small>
        </div>

        <div className="nav" style={{ marginTop: "15px", display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", maxHeight: "calc(100vh - 120px)" }}>
          {NAV.map(([key, label]) => (
            <button
              key={key}
              style={{
                textAlign: "left",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "none",
                background: page === key ? "#2563eb" : "transparent",
                color: page === key ? "#fff" : "#94a3b8",
                cursor: "pointer",
                fontWeight: page === key ? "600" : "normal",
                fontSize: "14px",
                transition: "all 0.2s"
              }}
              onClick={() => setPage(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </aside>

      <main className="main" style={{ flex: 1, padding: "25px", background: "#f8fafc", overflowY: "auto" }}>
        <div className="top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", color: "#0f172a" }}>{currentTitle}</h1>
            <div className="muted" style={{ fontSize: "13px", color: "#64748b" }}>
              {data.dbPersistent ? "🟢 Permanent Cloud DB Active" : "⚠ Set Upstash & Cloudinary Keys in Render for 100% Permanent Storage"} • {data.cloudEnabled ? "☁️ Cloud Media Active" : "Local Media"}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn secondary" onClick={() => loadData(false)} style={{ padding: "8px 16px", cursor: "pointer", borderRadius: "6px" }}>
              ↻ Refresh
            </button>
            <button className="btn danger" onClick={() => { localStorage.removeItem("tam_token"); setToken(null); }} style={{ padding: "8px 16px", cursor: "pointer", borderRadius: "6px", background: "#ef4444", color: "#fff", border: "none" }}>
              Logout
            </button>
          </div>
        </div>

        {error && <div className="notice" style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "15px" }}>{error}</div>}

        {page === "dashboard" && <Dashboard counts={counts} data={data} setPage={setPage} />}
        {page === "areas" && <Areas data={data} reload={() => loadData(true)} />}
        {page === "screens" && <Screens data={data} reload={() => loadData(true)} />}
        {page === "ads" && <Ads data={data} reload={() => loadData(true)} />}
        {page === "playlists" && <Playlists data={data} reload={() => loadData(true)} />}
        {page === "schedules" && <Schedules data={data} reload={() => loadData(true)} />}
        {page === "live" && <LiveCenter data={data} reload={() => loadData(true)} />}
        {page === "branding" && <BrandLayoutSettings data={data} reload={() => loadData(true)} />}
        {page === "franchise" && <Franchise data={data} reload={() => loadData(true)} />}
        {page === "crm" && <CRM data={data} reload={() => loadData(true)} />}
        {page === "billing" && <Billing data={data} reload={() => loadData(true)} />}
        {page === "news" && <FlashNews data={data} reload={() => loadData(true)} />}
        {page === "social" && <SocialMedia data={data} reload={() => loadData(true)} />}
        {page === "marketing" && <MarketingLeads data={data} activeClientsCount={activeClientsCount} setPage={setPage} />}
        {page === "aitools" && <AITools />}
        {page === "reports" && <Reports data={data} reload={() => loadData(true)} />}
        {page === "settings" && <Settings data={data} reload={() => loadData(false)} />}
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [serverUrl, setServerUrl] = useState(localStorage.getItem("tam_server_url") || window.location.origin);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [masterKey, setMasterKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitLogin(event) {
    event.preventDefault();
    setError("");
    setInfo("");
    const cleanedServerUrl = serverUrl.trim().replace(/\/+$/, "");
    localStorage.setItem("tam_server_url", cleanedServerUrl || window.location.origin);
    setBusy(true);

    try {
      const result = await api("/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (!result?.token) throw new Error("Server login responseలో token లేదు.");
      onLogin(result.token);
    } catch (err) {
      setError(err?.message || "Unable to connect to server.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(event) {
    event.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const res = await api("/forgot-password", {
        method: "POST",
        body: JSON.stringify({ username, masterKey, newPassword }),
      });
      setInfo(res.message || "Password updated!");
      setForgotMode(false);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e3a8a" }}>
      {!forgotMode ? (
        <form className="loginbox" onSubmit={submitLogin} style={{ background: "#fff", padding: "35px", borderRadius: "16px", width: "100%", maxWidth: "420px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
          <h1 style={{ fontSize: "22px", textAlign: "center", margin: "0 0 5px", color: "#0f172a" }}>📺 TV AD MANAGER PRO</h1>
          <p className="muted" style={{ textAlign: "center", margin: "0 0 20px", color: "#64748b", fontSize: "14px" }}>Central Web / Android Remote Login</p>

          <div className="field" style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "5px" }}>Server URL</label>
            <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
          </div>

          <div className="field" style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "5px" }}>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }} required />
          </div>

          <div className="field" style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "5px" }}>Password</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter Password" autoFocus required />
          </div>

          {error && <div style={{ padding: "10px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "12px", fontSize: "13px" }}>{error}</div>}
          {info && <div style={{ padding: "10px", background: "#dcfce7", color: "#15803d", borderRadius: "8px", marginBottom: "12px", fontSize: "13px" }}>{info}</div>}

          <button className="btn" style={{ width: "100%", padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }} disabled={busy}>
            {busy ? "Connecting..." : "Login"}
          </button>

          <div style={{ textAlign: "center", marginTop: "14px" }}>
            <button type="button" onClick={() => { setForgotMode(true); setError(""); }} style={{ background: "transparent", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}>
              Forgot Password? Reset Here
            </button>
          </div>
        </form>
      ) : (
        <form className="loginbox" onSubmit={submitReset} style={{ background: "#fff", padding: "35px", borderRadius: "16px", width: "100%", maxWidth: "420px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
          <h2 style={{ fontSize: "20px", textAlign: "center", margin: "0 0 15px", color: "#0f172a" }}>🔑 Reset / Create Password</h2>
          <div className="field" style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "5px" }}>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }} required />
          </div>
          <div className="field" style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "5px" }}>Master Recovery Key</label>
            <PasswordInput value={masterKey} onChange={(e) => setMasterKey(e.target.value)} placeholder="Default: 123456 or TIRUPATI2026" required />
          </div>
          <div className="field" style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "5px" }}>New Password</label>
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" required />
          </div>
          {error && <div style={{ padding: "10px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "12px", fontSize: "13px" }}>{error}</div>}
          <button className="btn" style={{ width: "100%", padding: "12px", background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }} disabled={busy}>
            {busy ? "Updating..." : "Save New Password"}
          </button>
          <div style={{ textAlign: "center", marginTop: "12px" }}>
            <button type="button" onClick={() => setForgotMode(false)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "13px" }}>
              ← Back to Login
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Dashboard({ counts, data, setPage }) {
  return (
    <>
      <div className="cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "25px" }}>
        <StatCard icon="📺" title="TV Screens" value={counts.screens} />
        <StatCard icon="🟢" title="Online TVs" value={counts.online} />
        <StatCard icon="📍" title="Locations / Areas" value={counts.areas} />
        <StatCard icon="🎞" title="Ads Library" value={counts.ads} />
        <StatCard icon="▶" title="Playlists" value={counts.playlists} />
        <StatCard icon="👥" title="Active Advertisers" value={counts.clients} />
        <StatCard icon="🏢" title="Franchises" value={counts.franchises} />
        <StatCard icon="📊" title="Total Plays" value={counts.plays} />
      </div>

      <div className="panel" style={{ background: "#fff", padding: "20px", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: "18px" }}>Remote TV Network Control Hub (PosterBooking Pro Edition)</h2>
        <div className="actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("ads")}>+ Advertisement</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("playlists")}>▶ Playlist</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("screens")}>📺 Manage TVs</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("live")}>🚨 Live & Emergency Alert</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("branding")}>🎨 Logo & Clock Overlay</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("reports")}>📊 PDF Reports</button>
        </div>
      </div>

      <div className="panel" style={{ background: "#fff", padding: "20px", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <h2 style={{ margin: "0 0 15px", fontSize: "18px" }}>TV Screen Status Across All Cities</h2>
        {data.screens.length === 0 ? (
          <div style={{ color: "#94a3b8" }}>No TV screens connected yet. Go to 'TV Screens' tab to pair a new screen.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "10px" }}>TV Name</th>
                <th style={{ padding: "10px" }}>Short Player URL</th>
                <th style={{ padding: "10px" }}>Orientation</th>
                <th style={{ padding: "10px" }}>Assigned Playlist</th>
                <th style={{ padding: "10px" }}>Status</th>
                <th style={{ padding: "10px" }}>Live Action</th>
              </tr>
            </thead>
            <tbody>
              {data.screens.map((screen, idx) => {
                const shortUrl = `${getServerOrigin()}/tv/${screen.shortCode || idx + 1}`;
                return (
                  <tr key={screen.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: "600" }}>{screen.name}</td>
                    <td style={{ padding: "10px", fontSize: "12px", color: "#2563eb" }}>{shortUrl}</td>
                    <td style={{ padding: "10px", fontSize: "12px" }}>{screen.orientation || "landscape"}</td>
                    <td style={{ padding: "10px" }}>{data.playlists.find(p => p.id === screen.playlistId)?.name || "No Playlist"}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", background: screen.status === "online" ? "#dcfce7" : "#fee2e2", color: screen.status === "online" ? "#15803d" : "#b91c1c" }}>
                        {screen.status || "offline"}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <button onClick={() => window.open(shortUrl, "_blank", "noopener,noreferrer")} style={{ padding: "6px 12px", background: "#10b981", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                        ▶ Watch / Launch
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function StatCard({ icon, title, value }) {
  return (
    <div style={{ background: "#fff", padding: "18px", borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: "13px", color: "#64748b" }}>{icon} {title}</div>
        <div style={{ fontSize: "24px", fontWeight: "bold", color: "#0f172a", marginTop: "4px" }}>{value}</div>
      </div>
    </div>
  );
}

function Areas({ data, reload }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", city: "", state: "" });

  function openNew() { setEditId(null); setForm({ name: "", city: "", state: "" }); setOpen(true); }
  function openEdit(area) { setEditId(area.id); setForm({ name: area.name, city: area.city || "", state: area.state || "" }); setOpen(true); }

  async function save() {
    if (!form.name.trim()) return alert("Area Name ఇవ్వండి.");
    const next = editId
      ? data.areas.map(a => a.id === editId ? { ...a, name: form.name.trim(), city: form.city.trim(), state: form.state.trim() } : a)
      : [...data.areas, { id: `area_${Date.now()}`, name: form.name.trim(), city: form.city.trim(), state: form.state.trim(), active: true }];
    await api("/areas", { method: "PUT", body: JSON.stringify(next) });
    setOpen(false);
    await reload();
  }

  async function remove(id) {
    if (!confirm("ఈ Areaను తొలగించాలా?")) return;
    await api("/areas", { method: "PUT", body: JSON.stringify(data.areas.filter(a => a.id !== id)) });
    await reload();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>📍 Cities & Operational Areas ({data.areas.length})</h2>
        <button onClick={openNew} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add New Area / City</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "15px" }}>
        {data.areas.map(area => (
          <div key={area.id} style={{ border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 5px" }}>{area.name}</h3>
            <p style={{ margin: "0 0 10px", color: "#64748b", fontSize: "13px" }}>{area.city} {area.state && `(${area.state})`}</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => openEdit(area)} style={{ padding: "4px 10px", background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>✏️ Edit</button>
              <button onClick={() => remove(area.id)} style={{ padding: "4px 10px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>🗑 Delete</button>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <Modal title={editId ? "Edit Area / City" : "Add Area / City"} close={() => setOpen(false)}>
          <Field label="Area Name" value={form.name} set={v => setForm({ ...form, name: v })} />
          <Field label="City" value={form.city} set={v => setForm({ ...form, city: v })} />
          <Field label="State" value={form.state} set={v => setForm({ ...form, state: v })} />
          <button className="btn" onClick={save} style={{ marginTop: "15px", width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px" }}>Save Area</button>
        </Modal>
      )}
    </div>
  );
}

function Screens({ data, reload }) {
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", areaId: "", shortCode: "", orientation: "landscape", fitMode: "contain", groupTag: "" });

  async function loadPending() {
    try { setPending(await api("/pair/pending")); } catch { setPending([]); }
  }

  useEffect(() => { loadPending(); }, []);

  async function pairDevice(device) {
    const name = prompt("TV Screen Name", device.deviceName || "TV Screen");
    if (!name) return;
    const areaId = data.areas[0]?.id || "";
    await api("/pair/approve", {
      method: "POST",
      body: JSON.stringify({ pairCode: device.pairCode, name, areaId }),
    });
    await loadPending();
    await reload();
  }

  function openNew() {
    setEditId(null);
    setForm({ name: "", areaId: "", shortCode: String(data.screens.length + 1), orientation: "landscape", fitMode: "contain", groupTag: "" });
    setOpen(true);
  }

  function openEdit(sc) {
    setEditId(sc.id);
    setForm({
      name: sc.name,
      areaId: sc.areaId || "",
      shortCode: sc.shortCode || "",
      orientation: sc.orientation || "landscape",
      fitMode: sc.fitMode || "contain",
      groupTag: sc.groupTag || ""
    });
    setOpen(true);
  }

  async function saveScreen() {
    if (!form.name.trim()) return alert("TV Name ఇవ్వండి.");
    const next = editId
      ? data.screens.map(s => s.id === editId ? { ...s, ...form, name: form.name.trim(), shortCode: form.shortCode.trim() || s.shortCode } : s)
      : [...data.screens, {
          id: `tv_${Date.now()}`,
          shortCode: form.shortCode.trim() || String(data.screens.length + 1),
          name: form.name.trim(),
          areaId: form.areaId,
          orientation: form.orientation,
          fitMode: form.fitMode,
          groupTag: form.groupTag.trim(),
          status: "offline",
          lastSeen: null,
          playlistId: null,
          createdAt: new Date().toISOString(),
        }];
    await api("/screens", { method: "PUT", body: JSON.stringify(next) });
    setOpen(false);
    await reload();
  }

  async function assignPlaylist(screenId, playlistId) {
    const next = data.screens.map(s => s.id === screenId ? { ...s, playlistId: playlistId || null } : s);
    await api("/screens", { method: "PUT", body: JSON.stringify(next) });
    await reload();
  }

  async function removeScreen(id) {
    if (!confirm("ఈ TV Screen ను తీసివేయాలా?")) return;
    await api("/screens", { method: "PUT", body: JSON.stringify(data.screens.filter(s => s.id !== id)) });
    await reload();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ marginBottom: "20px", padding: "15px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
        <h3 style={{ margin: "0 0 8px" }}>🔗 Remote Android TV Pairing</h3>
        <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#64748b" }}>
          టీవీ బ్రౌజర్‌లో <b>{getServerOrigin()}/player</b> ఓపెన్ చేస్తే వచ్చే 6-digit Code ను ఇక్కడ చూడవచ్చు, లేదా క్రింద ఉన్న <b>Short Player Link</b> ను నేరుగా టీవీలో ఓపెన్ చేయవచ్చు.
        </p>
        {pending.length === 0 ? (
          <div style={{ fontSize: "13px", color: "#94a3b8" }}>No pending TV devices waiting to pair right now.</div>
        ) : (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {pending.map(dev => (
              <div key={dev.id} style={{ background: "#fff", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", display: "flex", alignItems: "center", gap: "10px" }}>
                <span>{dev.deviceName}</span>
                <b style={{ color: "#2563eb", fontSize: "16px" }}>{dev.pairCode}</b>
                <button onClick={() => pairDevice(dev)} style={{ padding: "4px 10px", background: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>Pair TV</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>📺 Connected TV Screens ({data.screens.length})</h2>
        <button onClick={openNew} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add TV Screen</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: "15px" }}>
        {data.screens.map((screen, idx) => {
          const shortUrl = `${getServerOrigin()}/tv/${screen.shortCode || idx + 1}`;
          return (
            <div key={screen.id} style={{ border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>{screen.name}</h3>
                <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", background: screen.status === "online" ? "#dcfce7" : "#fee2e2", color: screen.status === "online" ? "#15803d" : "#b91c1c" }}>
                  {screen.status || "offline"}
                </span>
              </div>
              <p style={{ margin: "5px 0", color: "#64748b", fontSize: "12px" }}>
                {data.areas.find(a => a.id === screen.areaId)?.name || "Remote"} • <b>{screen.orientation || "landscape"}</b> • Fit: <b>{screen.fitMode || "contain"}</b>
                {screen.groupTag && ` • Group: ${screen.groupTag}`}
              </p>

              <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: "6px", marginBottom: "10px", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#1d4ed8", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis" }}>{shortUrl}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(shortUrl); alert("Short Player URL Copied!"); }}
                  style={{ padding: "2px 6px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}
                >
                  Copy
                </button>
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label style={{ fontSize: "12px", color: "#475569", display: "block", marginBottom: "4px" }}>Select Playlist:</label>
                <select
                  value={screen.playlistId || ""}
                  onChange={e => assignPlaylist(screen.id, e.target.value)}
                  style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value="">No Playlist Assigned</option>
                  {data.playlists.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => window.open(shortUrl, "_blank", "noopener,noreferrer")} style={{ flex: 1, padding: "6px", background: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                  ▶ Play TV
                </button>
                <button onClick={() => openEdit(screen)} style={{ padding: "6px 10px", background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>✏️ Edit</button>
                <button onClick={() => removeScreen(screen.id)} style={{ padding: "6px 10px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <Modal title={editId ? "Edit TV Screen & Orientation" : "Add TV Screen"} close={() => setOpen(false)}>
          <Field label="TV Name" value={form.name} set={v => setForm({ ...form, name: v })} />
          <Field label="Short TV Code (e.g. 1, 2, hyd1)" value={form.shortCode} set={v => setForm({ ...form, shortCode: v })} />
          <Field label="Screen Group Tag (e.g. Tirupati, Malls, Hotels)" value={form.groupTag} set={v => setForm({ ...form, groupTag: v })} />
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Screen Orientation (PosterBooking Mode)</label>
            <select value={form.orientation} onChange={e => setForm({ ...form, orientation: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              <option value="landscape">Landscape (Normal Horizontal TV)</option>
              <option value="portrait">Portrait 90° (Vertical Standee Display)</option>
              <option value="portrait-270">Portrait 270° (Vertical Rotated)</option>
            </select>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Media Fit Mode</label>
            <select value={form.fitMode} onChange={e => setForm({ ...form, fitMode: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              <option value="contain">Fit Screen (No Cropping)</option>
              <option value="cover">Fill Full Screen (Stretch / Zoom)</option>
            </select>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>City / Area</label>
            <select value={form.areaId} onChange={e => setForm({ ...form, areaId: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              <option value="">Select Area</option>
              {data.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn" onClick={saveScreen} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px" }}>Save TV</button>
        </Modal>
      )}
    </div>
  );
}

function Ads({ data, reload }) {
  const [open, setOpen] = useState(false);
  const [editAd, setEditAd] = useState(null);
  const [form, setForm] = useState({ name: "", clientName: "", duration: 10, file: null });
  const [busy, setBusy] = useState(false);

  function openNew() { setEditAd(null); setForm({ name: "", clientName: "", duration: 10, file: null }); setOpen(true); }
  function openEditModal(ad) { setEditAd(ad); setForm({ name: ad.name, clientName: ad.clientName || "", duration: ad.duration || 10, file: null }); setOpen(true); }

  async function saveAdvertisement() {
    if (!form.name.trim()) return alert("Ad Name ఇవ్వండి.");
    if (!editAd && !form.file) return alert("File ఎంపిక చేయండి.");
    setBusy(true);
    try {
      let uploadedData = {};
      if (form.file) {
        const formData = new FormData();
        formData.append("file", form.file);
        uploadedData = await api("/upload", { method: "POST", body: formData });
      }

      const next = editAd
        ? data.ads.map(item =>
            item.id === editAd.id
              ? { ...item, name: form.name.trim(), clientName: form.clientName.trim(), duration: Number(form.duration) || 10, ...uploadedData, updatedAt: new Date().toISOString() }
              : item
          )
        : [
            ...data.ads,
            { id: `ad_${Date.now()}`, name: form.name.trim(), clientName: form.clientName.trim(), duration: Number(form.duration) || 10, ...uploadedData, createdAt: new Date().toISOString() },
          ];

      await api("/ads", { method: "PUT", body: JSON.stringify(next) });
      setOpen(false);
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function broadcastAdToAllTVs(ad) {
    if (!confirm(`"${ad.name}" యాడ్‌ను అన్ని (${data.screens.length}) టీవీలలో ఒకేసారి లైవ్ చేయాలా?`)) return;
    const res = await api("/broadcast-all", { method: "POST", body: JSON.stringify({ adId: ad.id }) });
    alert(`విజయవంతం! ${res.count} టీవీలలో ఇప్పుడు "${ad.name}" ప్లే అవుతోంది.`);
    await reload();
  }

  async function deleteAdvertisement(ad) {
    if (!confirm(`"${ad.name}" యాడ్‌ను డిలీట్ చేయాలా?`)) return;
    await api("/ads", { method: "PUT", body: JSON.stringify(data.ads.filter(item => item.id !== ad.id)) });
    if (ad.fileKey && !ad.permanent && !ad.isSocial) {
      try { await api(`/upload/${encodeURIComponent(ad.fileKey)}`, { method: "DELETE" }); } catch {}
    }
    await reload();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>🎞 Advertisements Media Library ({data.ads.length})</h2>
        <button onClick={openNew} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Upload Any Video / Banner</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: "15px" }}>
        {data.ads.map(ad => (
          <div key={ad.id} style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "15px" }}>{ad.name}</h3>
            {ad.clientName && <div style={{ fontSize: "11px", color: "#2563eb", marginBottom: "6px" }}>Client: {ad.clientName}</div>}
            <div style={{ width: "100%", height: "140px", background: "#000", borderRadius: "6px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "12px" }}>
              {ad.isSocial ? (
                <div style={{ textAlign: "center", padding: "10px" }}>
                  <div style={{ fontSize: "24px" }}>📱</div>
                  <div>{ad.platform || "Social Media"}</div>
                </div>
              ) : ad.fileType?.startsWith("video/") ? (
                <video src={mediaUrl(ad.fileUrl)} style={{ maxWidth: "100%", maxHeight: "100%" }} controls preload="metadata" />
              ) : (
                <img src={mediaUrl(ad.fileUrl)} alt={ad.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              )}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
              Duration: <b>{ad.duration || 10}s</b> • {ad.isSocial ? ad.platform : ad.permanent ? "☁️ Cloud" : "Local"}
            </div>
            <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
              <button onClick={() => openEditModal(ad)} style={{ flex: 1, padding: "6px 8px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                ✏️ Edit / Replace
              </button>
              <button onClick={() => broadcastAdToAllTVs(ad)} title="Play on ALL TVs" style={{ padding: "6px 8px", background: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                📡 All TVs
              </button>
              <button onClick={() => deleteAdvertisement(ad)} style={{ padding: "6px 10px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Modal title={editAd ? "Edit Ad / Duration / Replace Media" : "Upload Advertisement"} close={() => !busy && setOpen(false)}>
          <Field label="Ad Title" value={form.name} set={v => setForm({ ...form, name: v })} />
          <Field label="Advertiser / Client Name (Optional)" value={form.clientName} set={v => setForm({ ...form, clientName: v })} />
          <Field label="Display Duration (seconds)" type="number" value={form.duration} set={v => setForm({ ...form, duration: v })} />
          {!editAd?.isSocial && (
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                {editAd ? "Replace Video / Image (Optional)" : "Select Any Video or Image"}
              </label>
              <input type="file" accept="video/*,image/*" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} />
            </div>
          )}
          <button className="btn" disabled={busy} onClick={saveAdvertisement} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold" }}>
            {busy ? "Saving..." : editAd ? "Save Changes" : "Upload & Save"}
          </button>
        </Modal>
      )}
    </div>
  );
}

function Playlists({ data, reload }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", adIds: [] });

  function toggleAd(adId, checked) {
    setForm(curr => ({
      ...curr,
      adIds: checked ? [...curr.adIds, adId] : curr.adIds.filter(id => id !== adId),
    }));
  }

  function openCreateModal() { setEditingId(null); setForm({ name: "", adIds: [] }); setOpen(true); }
  function openEditModal(pl) { setEditingId(pl.id); setForm({ name: pl.name, adIds: [...(pl.adIds || [])] }); setOpen(true); }

  async function quickUpdateDuration(ad) {
    const val = prompt(`"${ad.name}" ఎన్ని సెకన్లు ప్లే అవ్వాలి?`, String(ad.duration || 10));
    if (!val || isNaN(Number(val))) return;
    const nextAds = data.ads.map(item => item.id === ad.id ? { ...item, duration: Number(val) } : item);
    await api("/ads", { method: "PUT", body: JSON.stringify(nextAds) });
    await reload();
  }

  async function quickDeleteAd(ad) {
    if (!confirm(`"${ad.name}" యాడ్‌ను పూర్తిగా డిలీట్ చేయాలా?`)) return;
    await api("/ads", { method: "PUT", body: JSON.stringify(data.ads.filter(item => item.id !== ad.id)) });
    setForm(curr => ({ ...curr, adIds: curr.adIds.filter(id => id !== ad.id) }));
    await reload();
  }

  async function broadcastPlaylistToAll(pl) {
    if (!confirm(`"${pl.name}" ప్లేలిస్ట్‌ను అన్ని (${data.screens.length}) టీవీలలో ఒకేసారి ప్లే చేయాలా?`)) return;
    const res = await api("/broadcast-all", { method: "POST", body: JSON.stringify({ playlistId: pl.id }) });
    alert(`విజయవంతం! ${res.count} టీవీలలో ఇప్పుడు "${pl.name}" ప్లేలిస్ట్ రన్ అవుతోంది.`);
    await reload();
  }

  async function savePlaylist() {
    if (!form.name.trim()) return alert("Playlist Name ఇవ్వండి.");
    if (form.adIds.length === 0) return alert("కనీసం ఒక Ad ఎంపిక చేయండి.");

    const next = editingId
      ? data.playlists.map(pl => pl.id === editingId ? { ...pl, name: form.name.trim(), adIds: form.adIds, updatedAt: new Date().toISOString() } : pl)
      : [...data.playlists, { id: `pl_${Date.now()}`, name: form.name.trim(), adIds: form.adIds, createdAt: new Date().toISOString() }];

    await api("/playlists", { method: "PUT", body: JSON.stringify(next) });
    setOpen(false);
    setEditingId(null);
    await reload();
  }

  async function removePlaylist(id) {
    if (!confirm("ఈ Playlist ను తొలగించాలా?")) return;
    await api("/playlists", { method: "PUT", body: JSON.stringify(data.playlists.filter(p => p.id !== id)) });
    await reload();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>▶ TV Playlists ({data.playlists.length})</h2>
        <button onClick={openCreateModal} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Create New Playlist</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "15px" }}>
        {data.playlists.map(pl => (
          <div key={pl.id} style={{ border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 5px" }}>{pl.name}</h3>
            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#64748b" }}>{pl.adIds.length} Advertisements in Loop</p>
            <div style={{ fontSize: "12px", background: "#f8fafc", padding: "8px", borderRadius: "4px", marginBottom: "10px", maxHeight: "140px", overflowY: "auto" }}>
              {pl.adIds.map((aid, idx) => {
                const found = data.ads.find(a => a.id === aid);
                return (
                  <div key={`${aid}_${idx}`} style={{ padding: "2px 0", display: "flex", justifyContent: "space-between" }}>
                    <span>{idx + 1}. {found?.name || "Ad"}</span>
                    <span style={{ color: "#64748b" }}>{found?.duration || 10}s</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button onClick={() => openEditModal(pl)} style={{ flex: 1, padding: "6px 10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                ✏️ Edit / Add Ads
              </button>
              <button onClick={() => broadcastPlaylistToAll(pl)} style={{ padding: "6px 10px", background: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                📡 All TVs
              </button>
              <button onClick={() => removePlaylist(pl.id)} style={{ padding: "6px 10px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Modal title={editingId ? "Edit Playlist & Manage Ads" : "Create New Playlist"} close={() => { setOpen(false); setEditingId(null); }}>
          <Field label="Playlist Name" value={form.name} set={v => setForm({ ...form, name: v })} />
          <div style={{ marginBottom: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600" }}>Select Ads ({form.adIds.length} selected)</label>
              {data.ads.length > 0 && (
                <button
                  type="button"
                  onClick={() => setForm(curr => ({
                    ...curr,
                    adIds: curr.adIds.length === data.ads.length ? [] : data.ads.map(a => a.id)
                  }))}
                  style={{ fontSize: "11px", color: "#2563eb", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  {form.adIds.length === data.ads.length ? "Unselect All" : "Select All Ads"}
                </button>
              )}
            </div>

            {data.ads.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#b91c1c" }}>ముందుగా 'Advertisements' లో కొన్ని Ads అప్‌లోడ్ చేయండి.</p>
            ) : (
              <div style={{ maxHeight: "260px", overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "8px" }}>
                {data.ads.map(ad => (
                  <div key={ad.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 4px", borderBottom: "1px solid #f1f5f9", fontSize: "13px" }}>
                    <input type="checkbox" checked={form.adIds.includes(ad.id)} onChange={e => toggleAd(ad.id, e.target.checked)} />
                    <span style={{ flex: 1 }}>{ad.name}</span>
                    <button type="button" onClick={() => quickUpdateDuration(ad)} style={{ fontSize: "11px", padding: "2px 6px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer" }}>
                      ⏱ {ad.duration || 10}s
                    </button>
                    <button type="button" onClick={() => quickDeleteAd(ad)} style={{ fontSize: "11px", padding: "2px 6px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn" onClick={savePlaylist} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
            {editingId ? "Save Changes" : "Save Playlist"}
          </button>
        </Modal>
      )}
    </div>
  );
}

function Schedules({ data, reload }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", screenId: "", playlistId: "", start: "09:00", end: "21:00" });

  function toMinutes(time) { const [h, m] = time.split(":").map(Number); return h * 60 + m; }
  function openNew() { setEditId(null); setForm({ name: "", screenId: "", playlistId: "", start: "09:00", end: "21:00" }); setOpen(true); }
  function openEdit(sc) { setEditId(sc.id); setForm({ name: sc.name, screenId: sc.screenId, playlistId: sc.playlistId, start: formatMinutes(sc.start), end: formatMinutes(sc.end) }); setOpen(true); }

  async function saveSchedule() {
    if (!form.name.trim() || !form.screenId || !form.playlistId) return alert("దయచేసి అన్ని వివరాలు పూరించండి.");
    const next = editId
      ? data.schedules.map(sc => sc.id === editId ? { ...sc, name: form.name.trim(), screenId: form.screenId, playlistId: form.playlistId, start: toMinutes(form.start), end: toMinutes(form.end) } : sc)
      : [...data.schedules, { id: `sc_${Date.now()}`, name: form.name.trim(), screenId: form.screenId, playlistId: form.playlistId, start: toMinutes(form.start), end: toMinutes(form.end), days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], active: true }];
    await api("/schedules", { method: "PUT", body: JSON.stringify(next) });
    setOpen(false);
    await reload();
  }

  async function removeSchedule(id) {
    if (!confirm("ఈ Schedule ను తొలగించాలా?")) return;
    await api("/schedules", { method: "PUT", body: JSON.stringify(data.schedules.filter(s => s.id !== id)) });
    await reload();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <div>
          <h2 style={{ margin: 0 }}>🕒 Automated Time Schedules ({data.schedules.length})</h2>
          <small style={{ color: "#16a34a" }}>Indian Standard Time (IST) Active</small>
        </div>
        <button onClick={openNew} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add Schedule</button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ padding: "10px" }}>Schedule Name</th>
            <th style={{ padding: "10px" }}>Target TV</th>
            <th style={{ padding: "10px" }}>Playlist</th>
            <th style={{ padding: "10px" }}>Active Hours (IST)</th>
            <th style={{ padding: "10px" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.schedules.map(sc => (
            <tr key={sc.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px", fontWeight: "600" }}>{sc.name}</td>
              <td style={{ padding: "10px" }}>{data.screens.find(s => s.id === sc.screenId)?.name || "TV"}</td>
              <td style={{ padding: "10px" }}>{data.playlists.find(p => p.id === sc.playlistId)?.name || "Playlist"}</td>
              <td style={{ padding: "10px" }}>{formatMinutes(sc.start)} - {formatMinutes(sc.end)}</td>
              <td style={{ padding: "10px", display: "flex", gap: "6px" }}>
                <button onClick={() => openEdit(sc)} style={{ padding: "4px 8px", background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>✏️ Edit</button>
                <button onClick={() => removeSchedule(sc.id)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>🗑 Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {open && (
        <Modal title={editId ? "Edit Broadcast Schedule" : "Add Broadcast Schedule"} close={() => setOpen(false)}>
          <Field label="Schedule Name" value={form.name} set={v => setForm({ ...form, name: v })} />
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Select TV</label>
            <select value={form.screenId} onChange={e => setForm({ ...form, screenId: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              <option value="">Select TV Screen</option>
              {data.screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Select Playlist</label>
            <select value={form.playlistId} onChange={e => setForm({ ...form, playlistId: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              <option value="">Select Playlist</option>
              {data.playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "13px" }}>Start Time (IST)</label>
              <input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} style={{ width: "100%", padding: "8px" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "13px" }}>End Time (IST)</label>
              <input type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} style={{ width: "100%", padding: "8px" }} />
            </div>
          </div>
          <button className="btn" onClick={saveSchedule} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px" }}>Save Schedule</button>
        </Modal>
      )}
    </div>
  );
}

function LiveCenter({ data, reload }) {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [groupTag, setGroupTag] = useState("");
  const [emergencyText, setEmergencyText] = useState(data.brandSettings?.emergencyTitle || "");
  const [busy, setBusy] = useState(false);

  const uniqueGroups = [...new Set(data.screens.map(s => s.groupTag).filter(Boolean))];

  async function pushToTVs() {
    if (!selectedPlaylistId) return alert("ముందుగా ఒక Playlist ఎంచుకోండి.");
    setBusy(true);
    try {
      const res = await api("/broadcast-all", { method: "POST", body: JSON.stringify({ playlistId: selectedPlaylistId, groupTag }) });
      alert(`విజయవంతం! ${res.count} టీవీలకు ఒకేసారి లైవ్ అప్‌డేట్ వెళ్లింది.`);
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleEmergency(active) {
    await api("/system-settings", {
      method: "PUT",
      body: JSON.stringify({
        emergencyActive: active,
        emergencyTitle: emergencyText.trim() || "BREAKING ALERT"
      })
    });
    await reload();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2 style={{ margin: "0 0 15px" }}>🔴 Live TV Broadcast & Emergency Alert Center</h2>

      <div style={{ background: "#fff1f2", border: "2px solid #f43f5e", padding: "15px", borderRadius: "10px", marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 8px", color: "#be123c", fontSize: "16px" }}>🚨 Instant Emergency / Breaking Full-Screen Override (All TVs)</h3>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={emergencyText}
            onChange={e => setEmergencyText(e.target.value)}
            placeholder="ఉదాహరణ: బంపర్ ఆఫర్! ఈ రోజు మాత్రమే 70% తగ్గింపు..."
            style={{ flex: 1, minWidth: "240px", padding: "10px", borderRadius: "6px", border: "1px solid #fda4af" }}
          />
          {!data.brandSettings?.emergencyActive ? (
            <button onClick={() => toggleEmergency(true)} style={{ padding: "10px 18px", background: "#e11d48", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              🚨 Start Emergency Alert on All TVs
            </button>
          ) : (
            <button onClick={() => toggleEmergency(false)} style={{ padding: "10px 18px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              ✅ Stop Alert & Resume Ads
            </button>
          )}
        </div>
      </div>

      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "15px", borderRadius: "10px", marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 8px", color: "#1e40af", fontSize: "16px" }}>📡 Push Playlist to All TVs or Specific Group</h3>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <select value={groupTag} onChange={e => setGroupTag(e.target.value)} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <option value="">All TVs ({data.screens.length})</option>
            {uniqueGroups.map(g => <option key={g} value={g}>Group: {g}</option>)}
          </select>
          <select value={selectedPlaylistId} onChange={e => setSelectedPlaylistId(e.target.value)} style={{ flex: 1, minWidth: "220px", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <option value="">Select Playlist to Broadcast</option>
            {data.playlists.map(p => <option key={p.id} value={p.id}>{p.name} ({p.adIds.length} Ads)</option>)}
          </select>
          <button disabled={busy} onClick={pushToTVs} style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
            {busy ? "Sending..." : "📡 Broadcast Now"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px" }}>
        {data.screens.map((screen, idx) => {
          const shortUrl = `${getServerOrigin()}/tv/${screen.shortCode || idx + 1}`;
          return (
            <div key={screen.id} style={{ border: "2px solid #e2e8f0", padding: "15px", borderRadius: "10px", background: screen.status === "online" ? "#f0fdf4" : "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>{screen.name}</h3>
                <span style={{ fontSize: "12px", color: screen.status === "online" ? "#15803d" : "#991b1b", fontWeight: "bold" }}>
                  {screen.status === "online" ? "● LIVE" : "○ OFFLINE"}
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "6px 0" }}>
                Playlist: <b>{data.playlists.find(p => p.id === screen.playlistId)?.name || "None"}</b>
              </p>
              <button onClick={() => window.open(shortUrl, "_blank")} style={{ width: "100%", padding: "8px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", marginTop: "8px" }}>
                🖥 Remote Screen Monitor
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BrandLayoutSettings({ data, reload }) {
  const bs = data.brandSettings || {};
  const [form, setForm] = useState({
    brandName: bs.brandName || "TV AD MANAGER PRO",
    logoUrl: bs.logoUrl || "",
    showClock: bs.showClock !== false,
    showWatermark: bs.showWatermark !== false,
  });
  const [busy, setBusy] = useState(false);

  async function uploadLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploaded = await api("/upload", { method: "POST", body: fd });
      setForm(curr => ({ ...curr, logoUrl: uploaded.fileUrl }));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveBrandSettings() {
    await api("/system-settings", { method: "PUT", body: JSON.stringify(form) });
    alert("లోగో మరియు స్క్రీన్ లేఅవుట్ సెట్టింగ్స్ సేవ్ అయ్యాయి!");
    await reload();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", maxWidth: "650px" }}>
      <h2>🎨 Channel Logo Watermark & Live Clock Overlay</h2>
      <Field label="Channel / Network Name" value={form.brandName} set={v => setForm({ ...form, brandName: v })} />

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Upload PNG/JPG Logo Watermark</label>
        <input type="file" accept="image/*" onChange={uploadLogo} disabled={busy} />
        {form.logoUrl && (
          <div style={{ marginTop: "10px", padding: "10px", background: "#0f172a", borderRadius: "8px", display: "inline-block" }}>
            <img src={mediaUrl(form.logoUrl)} alt="Logo" style={{ height: "50px", objectFit: "contain" }} />
          </div>
        )}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", cursor: "pointer" }}>
        <input type="checkbox" checked={form.showWatermark} onChange={e => setForm({ ...form, showWatermark: e.target.checked })} />
        <span>Show Channel Logo Watermark on TV Screens</span>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", cursor: "pointer" }}>
        <input type="checkbox" checked={form.showClock} onChange={e => setForm({ ...form, showClock: e.target.checked })} />
        <span>Show Live Digital Clock & Date on TV Screens</span>
      </label>

      <button onClick={saveBrandSettings} disabled={busy} style={{ padding: "10px 24px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
        💾 Save Screen Layout Settings
      </button>
    </div>
  );
}

function Franchise({ data, reload }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", city: "", phone: "", commission: "20%" });

  function openNew() { setEditId(null); setForm({ name: "", city: "", phone: "", commission: "20%" }); setOpen(true); }
  function openEdit(fr) { setEditId(fr.id); setForm({ name: fr.name, city: fr.city, phone: fr.phone, commission: fr.commission }); setOpen(true); }

  async function saveFranchise() {
    if (!form.name.trim()) return alert("Franchise Partner Name ఇవ్వండి.");
    const list = data.franchises || [];
    const next = editId ? list.map(f => f.id === editId ? { ...f, ...form } : f) : [...list, { id: `fr_${Date.now()}`, ...form }];
    await api("/franchises", { method: "PUT", body: JSON.stringify(next) });
    setOpen(false);
    await reload();
  }

  async function removeFranchise(id) {
    if (!confirm("ఈ Franchise Partner ను తొలగించాలా?")) return;
    await api("/franchises", { method: "PUT", body: JSON.stringify((data.franchises || []).filter(f => f.id !== id)) });
    await reload();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>🏢 Franchise Partners Management</h2>
        <button onClick={openNew} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add Franchise Partner</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "15px" }}>
        {(data.franchises || []).map(fr => (
          <div key={fr.id} style={{ border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 5px" }}>{fr.name}</h3>
            <p style={{ margin: "0 0 5px", fontSize: "13px", color: "#64748b" }}>City: {fr.city} • {fr.phone}</p>
            <span style={{ fontSize: "12px", background: "#e0f2fe", color: "#0369a1", padding: "3px 8px", borderRadius: "4px" }}>Revenue Share: {fr.commission}</span>
            <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
              <button onClick={() => openEdit(fr)} style={{ padding: "4px 8px", background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>✏️ Edit</button>
              <button onClick={() => removeFranchise(fr.id)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>🗑 Delete</button>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <Modal title={editId ? "Edit Franchise Partner" : "Add City Franchise Partner"} close={() => setOpen(false)}>
          <Field label="Partner Name" value={form.name} set={v => setForm({ ...form, name: v })} />
          <Field label="Operational City" value={form.city} set={v => setForm({ ...form, city: v })} />
          <Field label="Phone Number" value={form.phone} set={v => setForm({ ...form, phone: v })} />
          <Field label="Commission" value={form.commission} set={v => setForm({ ...form, commission: v })} />
          <button className="btn" onClick={saveFranchise} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px" }}>Save Partner</button>
        </Modal>
      )}
    </div>
  );
}

function CRM({ data, reload }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", business: "", phone: "", budget: "" });

  function openNew() { setEditId(null); setForm({ name: "", business: "", phone: "", budget: "" }); setOpen(true); }
  function openEdit(cl) { setEditId(cl.id); setForm({ name: cl.name, business: cl.business, phone: cl.phone, budget: cl.budget }); setOpen(true); }

  async function saveClient() {
    if (!form.name.trim()) return alert("Client Name ఇవ్వండి.");
    const list = data.clients || [];
    const next = editId ? list.map(c => c.id === editId ? { ...c, ...form } : c) : [...list, { id: `cl_${Date.now()}`, ...form }];
    await api("/clients", { method: "PUT", body: JSON.stringify(next) });
    setOpen(false);
    await reload();
  }

  async function removeClient(id) {
    if (!confirm("ఈ Client ను తొలగించాలా?")) return;
    await api("/clients", { method: "PUT", body: JSON.stringify((data.clients || []).filter(c => c.id !== id)) });
    await reload();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>👥 Advertisers & Clients (CRM)</h2>
        <button onClick={openNew} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add Advertiser</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ padding: "10px" }}>Client Name</th>
            <th style={{ padding: "10px" }}>Business</th>
            <th style={{ padding: "10px" }}>Phone</th>
            <th style={{ padding: "10px" }}>Budget</th>
            <th style={{ padding: "10px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(data.clients || []).map(cl => (
            <tr key={cl.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px", fontWeight: "600" }}>{cl.name}</td>
              <td style={{ padding: "10px" }}>{cl.business}</td>
              <td style={{ padding: "10px" }}>{cl.phone}</td>
              <td style={{ padding: "10px", color: "#16a34a", fontWeight: "bold" }}>₹{cl.budget}</td>
              <td style={{ padding: "10px", display: "flex", gap: "6px" }}>
                <button onClick={() => openEdit(cl)} style={{ padding: "4px 8px", background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>✏️ Edit</button>
                <button onClick={() => removeClient(cl.id)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>🗑 Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && (
        <Modal title={editId ? "Edit Client" : "Add New Advertiser Client"} close={() => setOpen(false)}>
          <Field label="Client Name" value={form.name} set={v => setForm({ ...form, name: v })} />
          <Field label="Shop / Business Name" value={form.business} set={v => setForm({ ...form, business: v })} />
          <Field label="Phone Number" value={form.phone} set={v => setForm({ ...form, phone: v })} />
          <Field label="Monthly Contract (₹)" value={form.budget} set={v => setForm({ ...form, budget: v })} />
          <button className="btn" onClick={saveClient} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px" }}>Save Client</button>
        </Modal>
      )}
    </div>
  );
}

function Billing({ data, reload }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ client: "", amount: "", status: "Paid", date: new Date().toISOString().split("T")[0] });

  function openNew() { setEditId(null); setForm({ client: "", amount: "", status: "Paid", date: new Date().toISOString().split("T")[0] }); setOpen(true); }
  function openEdit(inv) { setEditId(inv.id); setForm({ client: inv.client, amount: inv.amount, status: inv.status, date: inv.date }); setOpen(true); }

  async function saveInvoice() {
    if (!form.client.trim()) return alert("Client Name ఇవ్వండి.");
    const list = data.billings || [];
    const next = editId ? list.map(b => b.id === editId ? { ...b, ...form } : b) : [...list, { id: `inv_${Date.now()}`, ...form }];
    await api("/billings", { method: "PUT", body: JSON.stringify(next) });
    setOpen(false);
    await reload();
  }

  async function removeInvoice(id) {
    if (!confirm("ఈ Invoice ను తొలగించాలా?")) return;
    await api("/billings", { method: "PUT", body: JSON.stringify((data.billings || []).filter(b => b.id !== id)) });
    await reload();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>💰 Invoices & Billing Management</h2>
        <button onClick={openNew} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Generate Invoice</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ padding: "10px" }}>Client</th>
            <th style={{ padding: "10px" }}>Amount</th>
            <th style={{ padding: "10px" }}>Date</th>
            <th style={{ padding: "10px" }}>Status</th>
            <th style={{ padding: "10px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(data.billings || []).map(inv => (
            <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px", fontWeight: "600" }}>{inv.client}</td>
              <td style={{ padding: "10px", fontWeight: "bold" }}>₹{inv.amount}</td>
              <td style={{ padding: "10px" }}>{inv.date}</td>
              <td style={{ padding: "10px" }}>{inv.status}</td>
              <td style={{ padding: "10px", display: "flex", gap: "6px" }}>
                <button onClick={() => openEdit(inv)} style={{ padding: "4px 8px", background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>✏️ Edit</button>
                <button onClick={() => removeInvoice(inv.id)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>🗑 Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && (
        <Modal title={editId ? "Edit Invoice" : "Create Invoicing Entry"} close={() => setOpen(false)}>
          <Field label="Advertiser Name" value={form.client} set={v => setForm({ ...form, client: v })} />
          <Field label="Invoice Amount (₹)" type="number" value={form.amount} set={v => setForm({ ...form, amount: v })} />
          <Field label="Date" type="date" value={form.date} set={v => setForm({ ...form, date: v })} />
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", marginBottom: "6px" }}>Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px" }}>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <button className="btn" onClick={saveInvoice} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px" }}>Save Invoice</button>
        </Modal>
      )}
    </div>
  );
}

function FlashNews({ data, reload }) {
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);

  async function saveTicker() {
    if (!text.trim()) return;
    const list = data.tickers || [];
    const next = editId
      ? list.map(t => t.id === editId ? { ...t, text: text.trim() } : t)
      : [...list, { id: `tk_${Date.now()}`, text: text.trim(), active: true }];
    await api("/tickers", { method: "PUT", body: JSON.stringify(next) });
    setText("");
    setEditId(null);
    await reload();
  }

  async function removeTicker(id) {
    const next = (data.tickers || []).filter(t => t.id !== id);
    await api("/tickers", { method: "PUT", body: JSON.stringify(next) });
    await reload();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ramabhadra&display=swap" />
      <h2 style={{ margin: "0 0 6px" }}>📰 Flash News & Bottom Screen Tickers (Ramabhadra Font)</h2>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="ఉదాహరణ: 50% స్పెషల్ డిస్కౌంట్ ఆఫర్ అందుబాటులో ఉంది..."
          style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "'Ramabhadra', sans-serif", fontSize: "16px" }}
        />
        <button onClick={saveTicker} style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
          {editId ? "Update Ticker" : "+ Add Scroll Ticker"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {(data.tickers || []).map(tk => (
          <div key={tk.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#f8fafc", borderRadius: "8px", borderLeft: "4px solid #ef4444" }}>
            <span style={{ fontFamily: "'Ramabhadra', sans-serif", fontSize: "17px" }}>📢 {tk.text}</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => { setEditId(tk.id); setText(tk.text); }} style={{ padding: "4px 8px", background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: "4px", cursor: "pointer" }}>✏️ Edit</button>
              <button onClick={() => removeTicker(tk.id)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer" }}>🗑 Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialMedia({ data, reload }) {
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: "", platform: "YouTube / Shorts / Live", url: "", duration: 30, targetScreenId: "" });

  const indiaPlatforms = [
    "YouTube / Shorts / Live",
    "Instagram Reels / Video",
    "Facebook Video / Live",
    "ShareChat Video",
    "Moj Short Video",
    "Josh Video",
    "Koo Video",
    "X (Twitter) Video",
    "Vimeo",
    "Dailymotion",
    "Direct Live Stream (.m3u8 / .mp4)"
  ];

  async function saveSocialAd() {
    if (!form.title.trim() || !form.url.trim()) return alert("Title మరియు Social Media Video URL ఇవ్వండి.");
    const platformTag = form.platform.split(" ")[0];
    const formattedName = `[${platformTag}] ${form.title.trim()}`;

    let nextAds;
    let targetAdId;

    if (editId) {
      targetAdId = editId;
      nextAds = data.ads.map(a =>
        a.id === editId
          ? { ...a, name: formattedName, rawTitle: form.title.trim(), duration: Number(form.duration) || 30, fileUrl: form.url.trim(), platform: form.platform, updatedAt: new Date().toISOString() }
          : a
      );
    } else {
      targetAdId = `ad_soc_${Date.now()}`;
      nextAds = [...data.ads, {
        id: targetAdId,
        name: formattedName,
        rawTitle: form.title.trim(),
        duration: Number(form.duration) || 30,
        fileUrl: form.url.trim(),
        fileType: "social/stream",
        platform: form.platform,
        isSocial: true,
        createdAt: new Date().toISOString(),
      }];
    }

    await api("/ads", { method: "PUT", body: JSON.stringify(nextAds) });

    if (form.targetScreenId === "ALL_TVS") {
      await api("/broadcast-all", { method: "POST", body: JSON.stringify({ adId: targetAdId }) });
    } else if (form.targetScreenId) {
      const targetScreen = data.screens.find(s => s.id === form.targetScreenId);
      if (targetScreen) {
        if (targetScreen.playlistId) {
          const nextPl = data.playlists.map(p =>
            p.id === targetScreen.playlistId && !p.adIds.includes(targetAdId) ? { ...p, adIds: [...p.adIds, targetAdId] } : p
          );
          await api("/playlists", { method: "PUT", body: JSON.stringify(nextPl) });
        } else {
          const newPl = { id: `pl_${Date.now()}`, name: `${targetScreen.name} Social Loop`, adIds: [targetAdId], createdAt: new Date().toISOString() };
          await api("/playlists", { method: "PUT", body: JSON.stringify([...data.playlists, newPl]) });
          const nextSc = data.screens.map(s => s.id === targetScreen.id ? { ...s, playlistId: newPl.id } : s);
          await api("/screens", { method: "PUT", body: JSON.stringify(nextSc) });
        }
      }
    }

    setEditId(null);
    setForm({ title: "", platform: "YouTube / Shorts / Live", url: "", duration: 30, targetScreenId: "" });
    alert(editId ? "సోషల్ మీడియా లింక్ అప్‌డేట్ అయింది!" : "సోషల్ మీడియా వీడియో యాడ్ జోడించబడింది!");
    await reload();
  }

  function startEdit(sa) {
    setEditId(sa.id);
    setForm({
      title: sa.rawTitle || sa.name.replace(/^\[[^\]]+\]\s*/, ""),
      platform: sa.platform || "YouTube / Shorts / Live",
      url: sa.fileUrl || "",
      duration: sa.duration || 30,
      targetScreenId: "",
    });
  }

  async function removeSocialAd(id) {
    if (!confirm("ఈ సోషల్ మీడియా లింక్‌ను డిలీట్ చేయాలా?")) return;
    await api("/ads", { method: "PUT", body: JSON.stringify(data.ads.filter(a => a.id !== id)) });
    await reload();
  }

  const socialAds = data.ads.filter(a => a.isSocial);

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2>📱 India Social Media & Live Video Integration</h2>
      <div style={{ background: "#f8fafc", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Social Platform</label>
            <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              {indiaPlatforms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Video / Live Title</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="ఉదా: Telugu Focus TV Live" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Duration (Seconds)</label>
            <input type="number" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Broadcast Target TV</label>
            <select value={form.targetScreenId} onChange={e => setForm({ ...form, targetScreenId: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              <option value="">Save to Ads Library</option>
              <option value="ALL_TVS">📡 ALL TVs (100+ Screens Live)</option>
              {data.screens.map(s => <option key={s.id} value={s.id}>📺 {s.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: "10px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Social Video / Live URL</label>
          <input type="text" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://youtube.com/watch?v=... | Instagram | Facebook | ShareChat | Moj | .m3u8" style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
          <button onClick={saveSocialAd} style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>
            {editId ? "💾 Update Social Link" : "+ Add Social Video & Broadcast"}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm({ title: "", platform: "YouTube / Shorts / Live", url: "", duration: 30, targetScreenId: "" }); }} style={{ padding: "10px 16px", background: "#e2e8f0", border: "none", borderRadius: "6px", cursor: "pointer" }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <h3 style={{ margin: "0 0 10px" }}>Connected Social Media Streams ({socialAds.length})</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "12px" }}>
        {socialAds.map(sa => (
          <div key={sa.id} style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "8px" }}>
            <div style={{ fontWeight: "bold", fontSize: "14px" }}>{sa.name}</div>
            <div style={{ fontSize: "12px", color: "#2563eb", margin: "4px 0", wordBreak: "break-all" }}>{sa.fileUrl}</div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>Duration: {sa.duration}s</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => startEdit(sa)} style={{ padding: "4px 10px", background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>✏️ Edit</button>
              <button onClick={() => removeSocialAd(sa.id)} style={{ padding: "4px 10px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>🗑 Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketingLeads({ data, activeClientsCount, setPage }) {
  const totalRevenue = (data.billings || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const estimatedViewers = data.playback.length * 18;

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2>📢 Local Digital Marketing & Lead Generation</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "15px", marginTop: "15px" }}>
        <div style={{ padding: "18px", background: "#eff6ff", borderRadius: "10px", border: "1px solid #bfdbfe" }}>
          <div style={{ fontSize: "13px", color: "#1e40af" }}>Active TV Screens</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#2563eb", marginTop: "5px" }}>{data.screens.length}</div>
        </div>
        <div style={{ padding: "18px", background: "#f0fdf4", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: "13px", color: "#166534" }}>Total Ad Impressions (Plays)</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#16a34a", marginTop: "5px" }}>{data.playback.length}</div>
        </div>
        <div style={{ padding: "18px", background: "#faf5ff", borderRadius: "10px", border: "1px solid #e9d5ff" }}>
          <div style={{ fontSize: "13px", color: "#6b21a8" }}>Active Advertisers</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#9333ea", marginTop: "5px" }}>{activeClientsCount}</div>
          <button onClick={() => setPage("crm")} style={{ marginTop: "6px", fontSize: "11px", color: "#7e22ce", background: "transparent", border: "none", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
            + Add / Manage Clients
          </button>
        </div>
        <div style={{ padding: "18px", background: "#fffbeb", borderRadius: "10px", border: "1px solid #fde68a" }}>
          <div style={{ fontSize: "13px", color: "#92400e" }}>Estimated Audience Reach</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#d97706", marginTop: "5px" }}>{estimatedViewers.toLocaleString()}</div>
          <div style={{ fontSize: "11px", color: "#92400e" }}>Billing Value: ₹{totalRevenue.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

function AITools() {
  const [prompt, setPrompt] = useState("");
  const [generatedAd, setGeneratedAd] = useState("");

  function generateScript() {
    if (!prompt.trim()) return;
    setGeneratedAd(`🌟 30-Second Commercial Script for ${prompt}:\n\n[0-5s]: Bold Telugu headline introducing ${prompt}.\n[5-20s]: Special festive offers and location details.\n[20-30s]: Visit today or scan QR code on TV!`);
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2>🤖 AI Ad Script & Headline Generator</h2>
      <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Shop / Business Name & Offer..." style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "10px" }} />
      <button onClick={generateScript} style={{ padding: "10px 20px", background: "#9333ea", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>Generate Ad Script</button>
      {generatedAd && <div style={{ marginTop: "20px", padding: "15px", background: "#faf5ff", borderRadius: "8px", whiteSpace: "pre-line" }}>{generatedAd}</div>}
    </div>
  );
}

function Reports({ data, reload }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const firstDayMonthStr = `${todayStr.slice(0, 7)}-01`;

  const [reportMode, setReportMode] = useState("all");
  const [singleAdId, setSingleAdId] = useState("");
  const [selectedAdIds, setSelectedAdIds] = useState([]);
  const [fromDate, setFromDate] = useState(firstDayMonthStr);
  const [toDate, setToDate] = useState(todayStr);

  const filteredLogs = useMemo(() => {
    return (data.playback || []).filter(item => {
      const itemDate = String(item.createdAt || "").slice(0, 10);
      if (reportMode === "monthly") return itemDate.startsWith(todayStr.slice(0, 7));
      if (reportMode === "custom") {
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;
      }
      if (reportMode === "single" && singleAdId) return String(item.adId) === String(singleAdId);
      if (reportMode === "selected" && selectedAdIds.length > 0) return selectedAdIds.includes(String(item.adId));
      return true;
    });
  }, [data.playback, reportMode, singleAdId, selectedAdIds, fromDate, toDate, todayStr]);

  const adSummaryRows = useMemo(() => {
    const map = {};
    for (const play of filteredLogs) {
      const key = play.adId || play.adName || "unknown";
      if (!map[key]) {
        map[key] = { adId: key, name: data.ads.find(a => a.id === key)?.name || play.adName || key, totalPlays: 0, tvBreakdown: {}, lastPlayedAt: play.createdAt };
      }
      map[key].totalPlays += 1;
      const tvName = play.screenName || play.screenId || "TV";
      map[key].tvBreakdown[tvName] = (map[key].tvBreakdown[tvName] || 0) + 1;
      map[key].lastPlayedAt = play.createdAt;
    }
    return Object.values(map);
  }, [filteredLogs, data.ads]);

  const tvSummaryRows = useMemo(() => {
    const map = {};
    for (const play of filteredLogs) {
      const tvKey = play.screenId || play.screenName || "tv";
      if (!map[tvKey]) {
        map[tvKey] = { screenId: tvKey, tvName: play.screenName || play.screenId || "TV", areaName: play.areaName || "-", totalPlays: 0, uniqueAds: new Set() };
      }
      map[tvKey].totalPlays += 1;
      map[tvKey].uniqueAds.add(play.adName || play.adId);
    }
    return Object.values(map).map(item => ({ ...item, uniqueAdsCount: item.uniqueAds.size }));
  }, [filteredLogs]);

  function downloadPDFReport() {
    const reportTitles = {
      all: "Complete Network Proof-of-Play Report",
      single: `Single Ad Report: ${data.ads.find(a => a.id === singleAdId)?.name || "Selected Ad"}`,
      selected: `Selected Ads (${selectedAdIds.length}) Proof-of-Play Report`,
      monthly: `Monthly Broadcast Report (${todayStr.slice(0, 7)})`,
      custom: `Custom Date Report (${fromDate} to ${toDate})`,
    };

    const win = window.open("", "_blank", "width=950,height=750");
    if (!win) return alert("దయచేసి పాప్-అప్ అనుమతించండి.");

    const adRowsHtml = adSummaryRows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${r.name}</b></td>
        <td>${r.totalPlays}</td>
        <td>${Object.entries(r.tvBreakdown).map(([tv, cnt]) => `${tv} (${cnt})`).join(", ")}</td>
        <td>${r.lastPlayedAt ? new Date(r.lastPlayedAt).toLocaleString() : "-"}</td>
      </tr>
    `).join("");

    const tvRowsHtml = tvSummaryRows.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${t.tvName}</b></td>
        <td>${t.areaName}</td>
        <td>${t.uniqueAdsCount}</td>
        <td>${t.totalPlays}</td>
      </tr>
    `).join("");

    win.document.write(`
      <html>
        <head>
          <title>TV AD MANAGER PRO - Proof of Play PDF Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #0f172a; }
            h1 { margin: 0; color: #1e3a8a; font-size: 22px; }
            .sub { color: #64748b; font-size: 13px; margin-bottom: 20px; }
            .box { display: flex; gap: 15px; margin-bottom: 20px; }
            .stat { border: 1px solid #cbd5e1; padding: 10px 15px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background: #f1f5f9; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <button class="no-print" onclick="window.print()" style="padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-bottom:15px;">🖨 Save as PDF / Print</button>
          <h1>📺 ${data.brandSettings?.brandName || "TV AD MANAGER PRO"} — Proof of Play Report</h1>
          <div class="sub">${reportTitles[reportMode]} • Generated: ${new Date().toLocaleString()}</div>
          <div class="box">
            <div class="stat"><b>Total Ad Plays:</b> ${filteredLogs.length}</div>
            <div class="stat"><b>Active TVs:</b> ${tvSummaryRows.length}</div>
            <div class="stat"><b>Ads Covered:</b> ${adSummaryRows.length}</div>
          </div>
          <h3>1. Advertisement-Wise Proof of Play</h3>
          <table>
            <thead><tr><th>#</th><th>Advertisement Name</th><th>Total Plays</th><th>TV-Wise Breakdown</th><th>Last Played</th></tr></thead>
            <tbody>${adRowsHtml || '<tr><td colspan="5">No play records for selected filter.</td></tr>'}</tbody>
          </table>
          <h3>2. TV Screen-Wise Broadcast Summary</h3>
          <table>
            <thead><tr><th>#</th><th>TV Screen Name</th><th>Location / Area</th><th>Ads Played</th><th>Total Plays</th></tr></thead>
            <tbody>${tvRowsHtml || '<tr><td colspan="5">No TV records for selected filter.</td></tr>'}</tbody>
          </table>
          <script>setTimeout(() => window.print(), 400);</script>
        </body>
      </html>
    `);
    win.document.close();
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ margin: 0 }}>📊 Live Ad Proof of Play & PDF Reports</h2>
          <small style={{ color: "#64748b" }}>ప్రతి యాడ్, సెలెక్ట్ చేసిన యాడ్స్, నెలవారీ మరియు కస్టమ్ తేదీ PDF రిపోర్ట్ డౌన్‌లోడ్</small>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={reload} style={{ padding: "8px 14px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}>↻ Refresh</button>
          <button onClick={downloadPDFReport} style={{ padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
            📄 Download PDF Report
          </button>
        </div>
      </div>

      <div style={{ background: "#f8fafc", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
          {[
            ["all", "All Time Report"],
            ["single", "Single Ad Report"],
            ["selected", "Select Multiple Ads"],
            ["monthly", "This Month Report"],
            ["custom", "Custom Date Range"],
          ].map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setReportMode(mode)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "600",
                background: reportMode === mode ? "#2563eb" : "#e2e8f0",
                color: reportMode === mode ? "#fff" : "#334155",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {reportMode === "single" && (
          <select value={singleAdId} onChange={e => setSingleAdId(e.target.value)} style={{ width: "100%", maxWidth: "400px", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <option value="">-- Select Advertisement --</option>
            {data.ads.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}

        {reportMode === "selected" && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", background: "#fff", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            {data.ads.map(a => (
              <label key={a.id} style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedAdIds.includes(a.id)}
                  onChange={e => setSelectedAdIds(curr => e.target.checked ? [...curr, a.id] : curr.filter(id => id !== a.id))}
                />
                {a.name}
              </label>
            ))}
          </div>
        )}

        {reportMode === "custom" && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: "12px", display: "block" }}>From Date:</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", display: "block" }}>To Date:</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </div>
          </div>
        )}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px", marginBottom: "25px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ padding: "10px" }}>Advertisement</th>
            <th style={{ padding: "10px" }}>Total Plays</th>
            <th style={{ padding: "10px" }}>Played on TVs (Count)</th>
            <th style={{ padding: "10px" }}>Last Played</th>
          </tr>
        </thead>
        <tbody>
          {adSummaryRows.map(row => (
            <tr key={row.adId} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px", fontWeight: "600" }}>{row.name}</td>
              <td style={{ padding: "10px", color: "#2563eb", fontWeight: "bold" }}>{row.totalPlays} times</td>
              <td style={{ padding: "10px", fontSize: "13px" }}>{Object.entries(row.tvBreakdown).map(([tv, cnt]) => `${tv} (${cnt})`).join(", ")}</td>
              <td style={{ padding: "10px", fontSize: "12px", color: "#64748b" }}>{row.lastPlayedAt ? new Date(row.lastPlayedAt).toLocaleString() : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ margin: "0 0 10px" }}>TV Screen-Wise Broadcast Summary</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ padding: "10px" }}>TV Screen Name</th>
            <th style={{ padding: "10px" }}>Area / City</th>
            <th style={{ padding: "10px" }}>Unique Ads Played</th>
            <th style={{ padding: "10px" }}>Total Plays</th>
          </tr>
        </thead>
        <tbody>
          {tvSummaryRows.map(tv => (
            <tr key={tv.screenId} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px", fontWeight: "600" }}>{tv.tvName}</td>
              <td style={{ padding: "10px" }}>{tv.areaName}</td>
              <td style={{ padding: "10px" }}>{tv.uniqueAdsCount} ads</td>
              <td style={{ padding: "10px", color: "#16a34a", fontWeight: "bold" }}>{tv.totalPlays} times</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Settings({ data, reload }) {
  const [restoring, setRestoring] = useState(false);
  const [userForm, setUserForm] = useState({ id: null, username: "", fullName: "", role: "Admin", password: "" });

  async function saveUser(e) {
    e.preventDefault();
    if (!userForm.username.trim()) return alert("Username ఇవ్వండి.");
    try {
      await api("/users", { method: "POST", body: JSON.stringify(userForm) });
      alert(userForm.id ? "యూజర్ వివరాలు & పాస్‌వర్డ్ అప్‌డేట్ అయ్యాయి!" : "కొత్త యూజర్ క్రియేట్ అయ్యారు!");
      setUserForm({ id: null, username: "", fullName: "", role: "Admin", password: "" });
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteUser(id) {
    if (!confirm("ఈ యూజర్ ఖాతాను తొలగించాలా?")) return;
    try {
      await api(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function downloadBackup() {
    const backup = await api("/backup");
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tv-ad-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const json = JSON.parse(await file.text());
      await api("/restore", { method: "POST", body: JSON.stringify(json) });
      alert("మీ సెటప్ ఫైల్స్ అన్నీ విజయవంతంగా రిస్టోర్ అయ్యాయి!");
      await reload();
    } catch (err) {
      alert("Restore failed: " + err.message);
    } finally {
      setRestoring(false);
      event.target.value = "";
    }
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
        <h2 style={{ margin: "0 0 10px" }}>🔐 Custom Username & Password Management</h2>
        <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "15px" }}>
          మీ సొంత Username మరియు Password క్రియేట్ చేసుకోండి లేదా పాత యూజర్ పాస్‌వర్డ్ మార్చుకోండి. (Forgot Password Master Key: <b>TIRUPATI2026</b>)
        </p>

        <form onSubmit={saveUser} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "20px", background: "#f8fafc", padding: "15px", borderRadius: "8px" }}>
          <input type="text" placeholder="Username (e.g. sreenu)" value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} required />
          <input type="text" placeholder="Full Name" value={userForm.fullName} onChange={e => setUserForm({ ...userForm, fullName: e.target.value })} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
          <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
          </select>
          <PasswordInput placeholder={userForm.id ? "New Password (Optional)" : "Create Password"} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required={!userForm.id} />
          <button type="submit" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
            {userForm.id ? "Update User" : "+ Create User"}
          </button>
        </form>

        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "8px" }}>Username</th>
              <th style={{ padding: "8px" }}>Full Name</th>
              <th style={{ padding: "8px" }}>Role</th>
              <th style={{ padding: "8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data.users || []).map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px", fontWeight: "bold" }}>{u.username}</td>
                <td style={{ padding: "8px" }}>{u.fullName}</td>
                <td style={{ padding: "8px" }}>{u.role}</td>
                <td style={{ padding: "8px", display: "flex", gap: "6px" }}>
                  <button onClick={() => setUserForm({ id: u.id, username: u.username, fullName: u.fullName, role: u.role, password: "" })} style={{ padding: "4px 8px", background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>✏️ Edit / Change Password</button>
                  <button onClick={() => deleteUser(u.id)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>🗑 Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
        <h2>💾 Backup & Restore Setup File</h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "10px" }}>
          <button onClick={downloadBackup} style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>
            📥 Download Setup Backup (.json)
          </button>
          <label style={{ padding: "10px 20px", background: "#10b981", color: "#fff", borderRadius: "6px", cursor: "pointer", fontWeight: "600", display: "inline-block" }}>
            {restoring ? "Restoring..." : "📤 Restore Setup File (.json)"}
            <input type="file" accept=".json,application/json" onChange={restoreBackup} style={{ display: "none" }} disabled={restoring} />
          </label>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder = "Enter Password", required = false, autoFocus = false }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        style={{ width: "100%", padding: "10px 40px 10px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        title={show ? "Hide Password" : "Show Password"}
        style={{
          position: "absolute",
          right: "8px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "16px",
          padding: "4px",
          color: "#475569"
        }}
      >
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

function Field({ label, value, set, type = "text" }) {
  return (
    <div style={{ marginBottom: "15px" }}>
      <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>{label}</label>
      <input type={type} value={value} onChange={e => set(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
    </div>
  );
}

function Modal({ title, close, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
      <div style={{ background: "#fff", padding: "25px", borderRadius: "12px", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h2 style={{ margin: 0, fontSize: "18px" }}>{title}</h2>
          <button onClick={close} style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function formatMinutes(value) {
  const minutes = Number(value || 0);
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function getPlayerScreenId() {
  const pathMatch = window.location.pathname.match(/^\/tv\/([^/]+)/i);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  const params = new URLSearchParams(window.location.search);
  return params.get("player") || params.get("screen") || "";
}

function PlayerMode({ screenId }) {
  const [state, setState] = useState({ loading: true, error: "", screen: null, playlist: null, ads: [], tickers: [], brandSettings: {} });
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [clockStr, setClockStr] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockStr(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " | " + now.toLocaleDateString());
    };
    updateClock();
    const t = setInterval(updateClock, 1000);
    return () => clearInterval(t);
  }, []);

  async function loadPlayer() {
    if (!screenId) return;
    try {
      const result = await api(`/tv/${encodeURIComponent(screenId)}/player`);
      const ads = Array.isArray(result.ads) ? result.ads : Array.isArray(result.playlist?.ads) ? result.playlist.ads : [];
      const tickers = Array.isArray(result.tickers) ? result.tickers : [];
      setState({ loading: false, error: "", screen: result.screen || null, playlist: result.playlist || null, ads, tickers, brandSettings: result.brandSettings || {} });
    } catch (err) {
      setState(curr => ({ ...curr, loading: false, error: err.message || "Failed to load TV ads." }));
    }
  }

  async function logPlayback(ad) {
    if (!ad) return;
    try {
      await api(`/tv/${encodeURIComponent(screenId)}/playback`, {
        method: "POST",
        body: JSON.stringify({ adId: ad.id, adName: ad.name, duration: ad.duration || 10 }),
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
    if (currentAd && !state.brandSettings?.emergencyActive) {
      logPlayback(currentAd);
    }
  }, [currentAd?.id, index, state.brandSettings?.emergencyActive]);

  const goNext = () => setIndex(i => (i + 1) % state.ads.length);

  if (state.loading) return <div style={{ background: "#000", color: "#fff", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Connecting to Central Hub...</div>;

  const orientation = state.screen?.orientation || "landscape";
  const fitMode = state.screen?.fitMode || "contain";
  const rotationStyle = orientation === "portrait"
    ? { transform: "rotate(90deg)", width: "100vh", height: "100vw" }
    : orientation === "portrait-270"
    ? { transform: "rotate(270deg)", width: "100vh", height: "100vw" }
    : { width: "100%", height: "100%" };

  if (state.brandSettings?.emergencyActive) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#991b1b", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", textAlign: "center", fontFamily: "'Ramabhadra', sans-serif" }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ramabhadra&display=swap" />
        <div style={{ fontSize: "28px", background: "#fff", color: "#991b1b", padding: "6px 20px", borderRadius: "30px", fontWeight: "bold", marginBottom: "20px" }}>🚨 BREAKING ALERT</div>
        <div style={{ fontSize: "48px", lineHeight: 1.4 }}>{state.brandSettings.emergencyTitle}</div>
      </div>
    );
  }

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
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ramabhadra&display=swap" />

      <div style={{ ...rotationStyle, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PlayerAd
          key={`${currentAd.id}_${index}`}
          ad={currentAd}
          fitMode={fitMode}
          muted={muted}
          onForceMute={() => setMuted(true)}
          onFinished={goNext}
        />

        {state.brandSettings?.showWatermark && state.brandSettings?.logoUrl && (
          <img
            src={mediaUrl(state.brandSettings.logoUrl)}
            alt="Channel Logo"
            style={{ position: "absolute", top: "18px", left: "18px", height: "54px", objectFit: "contain", zIndex: 45, opacity: 0.9 }}
          />
        )}

        {state.brandSettings?.showClock && (
          <div style={{ position: "absolute", top: "18px", right: "18px", background: "rgba(15, 23, 42, 0.78)", color: "#fff", padding: "6px 14px", borderRadius: "8px", fontSize: "16px", fontWeight: "bold", zIndex: 45 }}>
            🕒 {clockStr}
          </div>
        )}

        {muted && (
          <button
            onClick={(e) => { e.stopPropagation(); setMuted(false); }}
            style={{ position: "absolute", top: "60px", right: "18px", zIndex: 50, padding: "8px 14px", background: "rgba(0,0,0,0.75)", color: "#fff", border: "1px solid #fff", borderRadius: "20px", cursor: "pointer", fontSize: "13px" }}
          >
            🔇 Tap Screen for Sound
          </button>
        )}

        {tickerText && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(90deg, #b91c1c, #dc2626)", color: "#fff", padding: "10px 0", fontSize: "22px", fontFamily: "'Ramabhadra', sans-serif", zIndex: 40, overflow: "hidden", whiteSpace: "nowrap", boxShadow: "0 -2px 10px rgba(0,0,0,0.6)" }}>
            <style>{`
              @keyframes tamMarquee {
                0% { transform: translateX(100%); }
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
    </div>
  );
}

function PlayerAd({ ad, fitMode, muted, onForceMute, onFinished }) {
  useEffect(() => {
    if (ad.fileType?.startsWith("video/") && !ad.isSocial) return;
    const timer = setTimeout(onFinished, (ad.duration || 10) * 1000);
    return () => clearTimeout(timer);
  }, [ad, onFinished]);

  if (ad.isSocial) {
    const parsed = parseSocialEmbed(ad.fileUrl);
    if (parsed.type === "direct_video") {
      return <video src={parsed.src} autoPlay muted={muted} playsInline style={{ width: "100%", height: "100%", objectFit: fitMode }} onEnded={onFinished} onError={onFinished} />;
    }
    const iframeSrc = parsed.type === "youtube" ? `${parsed.src}&mute=${muted ? 1 : 0}` : parsed.src;
    return <iframe src={iframeSrc} style={{ width: "100%", height: "100%", border: "none" }} allow="autoplay; fullscreen; encrypted-media" title={ad.name} />;
  }

  if (ad.fileType?.startsWith("video/")) {
    return (
      <video
        src={mediaUrl(ad.fileUrl)}
        autoPlay
        muted={muted}
        playsInline
        preload="auto"
        style={{ width: "100%", height: "100%", objectFit: fitMode }}
        ref={(el) => {
          if (!el) return;
          el.muted = muted;
          const playPromise = el.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
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

  return <img src={mediaUrl(ad.fileUrl)} alt={ad.name} onError={onFinished} style={{ width: "100%", height: "100%", objectFit: fitMode }} />;
}

export default function AppRoot() {
  const playerId = getPlayerScreenId();
  if (playerId) return <PlayerMode screenId={playerId} />;
  return <AdminApp />;
}
