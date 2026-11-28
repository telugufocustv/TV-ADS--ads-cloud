import { useEffect, useMemo, useRef, useState } from "react";

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

function parseSocialEmbed(url, isWebPage = false) {
  const raw = String(url || "").trim();
  if (isWebPage) return { type: "iframe", src: raw };

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
  ["franchise", "🏢 Franchise"],
  ["crm", "👥 Clients / CRM"],
  ["billing", "💰 Billing & Invoices"],
  ["news", "📰 Flash News & Tickers"],
  ["social", "📱 Social & Web URLs"],
  ["marketing", "📢 Marketing & Leads"],
  ["aitools", "🤖 AI Tools"],
  ["reports", "📊 PDF Reports"],
  ["settings", "⚙ Settings & Users"],
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
  systemSettings: {},
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
          <p>Connecting to Cloud Network...</p>
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
          📺 TV AD <small style={{ display: "block", fontSize: "11px", color: "#38bdf8", letterSpacing: "1px" }}>MANAGER PRO 3.0</small>
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
        <div className="top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", color: "#0f172a" }}>{currentTitle}</h1>
            <div className="muted" style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
              {data.dbPersistent ? "🟢 Permanent Cloud DB Active" : "🟠 Set GITHUB_TOKEN / UPSTASH in Render for 24/7 DB Sync"} •{" "}
              {data.cloudEnabled ? "☁️ Cloudinary Media Active" : "⚠ Set Cloudinary Keys in Render"}
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

/* ================= LOGIN & FORGOT PASSWORD SCREEN ================= */
function Login({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | forgot
  const [serverUrl, setServerUrl] = useState(localStorage.getItem("tam_server_url") || window.location.origin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPin, setRecoveryPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitLogin(event) {
    event.preventDefault();
    setError("");
    const cleanedServerUrl = serverUrl.trim().replace(/\/+$/, "");
    localStorage.setItem("tam_server_url", cleanedServerUrl || window.location.origin);
    setBusy(true);

    try {
      const result = await api("/login", {
        method: "POST",
        body: JSON.stringify({ username: username || "admin", password }),
      });
      if (!result?.token) throw new Error("Server login responseలో token లేదు.");
      onLogin(result.token);
    } catch (err) {
      setError(err?.message || "Unable to connect to server.");
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(event) {
    event.preventDefault();
    setError("");
    const cleanedServerUrl = serverUrl.trim().replace(/\/+$/, "");
    localStorage.setItem("tam_server_url", cleanedServerUrl || window.location.origin);
    setBusy(true);

    try {
      const result = await api("/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          recoveryPin,
          newUsername: username,
          newPassword: password,
        }),
      });
      if (!result?.token) throw new Error("Reset failed");
      alert("కొత్త Username మరియు Password విజయవంతంగా సెట్ అయ్యాయి!");
      onLogin(result.token);
    } catch (err) {
      setError(err?.message || "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e3a8a", padding: "15px" }}>
      <form
        className="loginbox"
        onSubmit={mode === "login" ? submitLogin : submitForgot}
        style={{ background: "#fff", padding: "32px", borderRadius: "16px", width: "100%", maxWidth: "430px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)" }}
      >
        <h1 style={{ fontSize: "22px", textAlign: "center", margin: "0 0 5px", color: "#0f172a" }}>📺 TV AD MANAGER PRO</h1>
        <p className="muted" style={{ textAlign: "center", margin: "0 0 20px", color: "#64748b", fontSize: "13px" }}>
          {mode === "login" ? "Multi-Device Cloud Login" : "🔑 Reset Username & Password"}
        </p>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Server URL</label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>

        {mode === "forgot" && (
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color: "#b91c1c" }}>
              Master Recovery PIN (Default: 123456)
            </label>
            <input
              type="text"
              value={recoveryPin}
              onChange={(e) => setRecoveryPin(e.target.value)}
              placeholder="Enter Secret Recovery PIN"
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #fca5a5", background: "#fef2f2" }}
              required
            />
          </div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
            {mode === "login" ? "Username" : "New Username (కొత్త యూజర్‌నేమ్)"}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            required
          />
        </div>

        <div style={{ marginBottom: "18px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
            {mode === "login" ? "Password" : "New Password (కొత్త పాస్‌వర్డ్)"}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            required
          />
        </div>

        {error && <div style={{ padding: "10px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "14px", fontSize: "13px" }}>{error}</div>}

        <button className="btn" style={{ width: "100%", padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }} disabled={busy}>
          {busy ? "Please wait..." : mode === "login" ? "Login" : "Save New Username & Password"}
        </button>

        <div style={{ textAlign: "center", marginTop: "14px" }}>
          {mode === "login" ? (
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(""); }}
              style={{ background: "transparent", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}
            >
              Forgot Password / Create New Login?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
              style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}
            >
              ← Back to Login
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ================= DASHBOARD ================= */
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
        <h2 style={{ margin: "0 0 10px", fontSize: "18px" }}>Remote TV Network Control Hub (PosterBooking Pro Engine)</h2>
        <div className="actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("ads")}>+ Upload Ad / Web URL</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("playlists")}>▶ Playlists</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("screens")}>📺 Manage TVs & Groups</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("live")}>🚨 Emergency / Group Push</button>
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
                <th style={{ padding: "10px" }}>Group</th>
                <th style={{ padding: "10px" }}>Short URL</th>
                <th style={{ padding: "10px" }}>Playlist</th>
                <th style={{ padding: "10px" }}>Status</th>
                <th style={{ padding: "10px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.screens.map((screen, idx) => {
                const shortUrl = `${getServerOrigin()}/tv/${screen.shortCode || idx + 1}`;
                return (
                  <tr key={screen.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: "600" }}>{screen.name}</td>
                    <td style={{ padding: "10px" }}><span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "4px", fontSize: "12px" }}>{screen.group || "General"}</span></td>
                    <td style={{ padding: "10px", fontSize: "12px", color: "#2563eb" }}>{shortUrl}</td>
                    <td style={{ padding: "10px" }}>{data.playlists.find(p => p.id === screen.playlistId)?.name || "No Playlist"}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", background: screen.status === "online" ? "#dcfce7" : "#fee2e2", color: screen.status === "online" ? "#15803d" : "#b91c1c" }}>
                        {screen.status || "offline"}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <button
                        onClick={() => window.open(shortUrl, "_blank", "noopener,noreferrer")}
                        style={{ padding: "6px 12px", background: "#10b981", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
                      >
                        ▶ Watch
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

/* ================= 1. AREAS MODULE ================= */
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

/* ================= 2. SCREENS MODULE (GROUPS + ORIENTATION + FIT + REMOTE RELOAD) ================= */
function Screens({ data, reload }) {
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", areaId: "", shortCode: "", group: "General", orientation: "0", fitMode: "contain" });

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
    setForm({ name: "", areaId: "", shortCode: String(data.screens.length + 1), group: "General", orientation: "0", fitMode: "contain" });
    setOpen(true);
  }

  function openEdit(sc) {
    setEditId(sc.id);
    setForm({
      name: sc.name,
      areaId: sc.areaId || "",
      shortCode: sc.shortCode || "",
      group: sc.group || "General",
      orientation: sc.orientation || "0",
      fitMode: sc.fitMode || "contain",
    });
    setOpen(true);
  }

  async function saveScreen() {
    if (!form.name.trim()) return alert("TV Name ఇవ్వండి.");
    const next = editId
      ? data.screens.map(s =>
          s.id === editId
            ? {
                ...s,
                name: form.name.trim(),
                areaId: form.areaId,
                shortCode: form.shortCode.trim() || s.shortCode,
                group: form.group.trim() || "General",
                orientation: form.orientation,
                fitMode: form.fitMode,
              }
            : s
        )
      : [
          ...data.screens,
          {
            id: `tv_${Date.now()}`,
            shortCode: form.shortCode.trim() || String(data.screens.length + 1),
            name: form.name.trim(),
            areaId: form.areaId,
            group: form.group.trim() || "General",
            orientation: form.orientation,
            fitMode: form.fitMode,
            status: "offline",
            lastSeen: null,
            playlistId: null,
            createdAt: new Date().toISOString(),
          },
        ];
    await api("/screens", { method: "PUT", body: JSON.stringify(next) });
    setOpen(false);
    await reload();
  }

  async function assignPlaylist(screenId, playlistId) {
    const next = data.screens.map(s => s.id === screenId ? { ...s, playlistId: playlistId || null } : s);
    await api("/screens", { method: "PUT", body: JSON.stringify(next) });
    await reload();
  }

  async function triggerRemoteReload(screen) {
    await api(`/screens/${encodeURIComponent(screen.id)}/reload`, { method: "POST" });
    alert(`"${screen.name}" టీవీకి రిమోట్ రీలోడ్ కమాండ్ పంపబడింది!`);
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
        <button onClick={openNew} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add TV Manually</button>
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
                Group: <b>{screen.group || "General"}</b> • Rotation: <b>{screen.orientation || "0"}°</b> • {data.areas.find(a => a.id === screen.areaId)?.name || "Remote"}
              </p>

              <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: "6px", marginBottom: "10px", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#1d4ed8", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis" }}>{shortUrl}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(shortUrl); alert("Short Player URL కాపీ అయింది!"); }}
                  style={{ padding: "2px 6px", background: "#fff", border: "1px solid
