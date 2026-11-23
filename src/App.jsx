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

function extractYouTubeId(url) {
  const raw = String(url || "").trim();
  const match = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

const NAV = [
  ["dashboard", "🏠 Dashboard"],
  ["areas", "📍 Areas"],
  ["screens", "📺 TV Screens"],
  ["ads", "🎞 Advertisements"],
  ["playlists", "▶ Playlists"],
  ["schedules", "🕒 Schedules"],
  ["live", "🔴 Live Center"],
  ["franchise", "🏢 Franchise"],
  ["crm", "👥 Clients / CRM"],
  ["billing", "💰 Billing & Invoices"],
  ["news", "📰 Flash News & Tickers"],
  ["social", "📱 Social Media Sync"],
  ["marketing", "📢 Marketing & Leads"],
  ["aitools", "🤖 AI Tools"],
  ["reports", "📊 Reports"],
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
  cloudEnabled: false,
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
      const autoRefresh = setInterval(() => loadData(true), 20000);
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

  const counts = {
    areas: data.areas.length,
    screens: data.screens.length,
    ads: data.ads.length,
    playlists: data.playlists.length,
    online: data.screens.filter((screen) => screen.status === "online").length,
    franchises: (data.franchises || []).length,
    clients: (data.clients || []).length,
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
              Central Multi-City Remote TV Controller • Tirupati Hub • {data.cloudEnabled ? "☁️ Permanent Cloud Storage Active" : "⚠ Local Ephemeral Storage"}
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
        {page === "live" && <LiveCenter data={data} />}
        {page === "franchise" && <Franchise data={data} reload={() => loadData(true)} />}
        {page === "crm" && <CRM data={data} reload={() => loadData(true)} />}
        {page === "billing" && <Billing data={data} reload={() => loadData(true)} />}
        {page === "news" && <FlashNews data={data} reload={() => loadData(true)} />}
        {page === "social" && <SocialMedia data={data} reload={() => loadData(true)} />}
        {page === "marketing" && <MarketingLeads data={data} />}
        {page === "aitools" && <AITools />}
        {page === "reports" && <Reports data={data} reload={() => loadData(true)} />}
        {page === "settings" && <Settings reload={() => loadData(false)} cloudEnabled={data.cloudEnabled} />}
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [serverUrl, setServerUrl] = useState(
    localStorage.getItem("tam_server_url") || window.location.origin
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const cleanedServerUrl = serverUrl.trim().replace(/\/+$/, "");
    localStorage.setItem("tam_server_url", cleanedServerUrl || window.location.origin);
    setBusy(true);

    try {
      const result = await api("/login", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password }),
      });
      if (!result?.token) throw new Error("Server login responseలో token లేదు.");
      onLogin(result.token);
    } catch (err) {
      const message = err?.message || "Unable to connect to server.";
      setError(
        message.includes("Unexpected token") || message.includes("JSON")
          ? "Server URL సరైనది కాదు లేదా API స్పందించడం లేదు."
          : message
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e3a8a" }}>
      <form className="loginbox" onSubmit={submit} style={{ background: "#fff", padding: "35px", borderRadius: "16px", width: "100%", maxWidth: "420px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
        <h1 style={{ fontSize: "22px", textAlign: "center", margin: "0 0 5px", color: "#0f172a" }}>📺 TV AD MANAGER PRO</h1>
        <p className="muted" style={{ textAlign: "center", margin: "0 0 20px", color: "#64748b", fontSize: "14px" }}>Central Web / Android Remote Login</p>

        <div className="field" style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Server URL</label>
          <input
            type="text"
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>

        <div className="field" style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Username</label>
          <input type="text" value="admin" disabled style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f1f5f9" }} />
        </div>

        <div className="field" style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            placeholder="admin123"
            autoFocus
          />
        </div>

        {error && <div className="notice" style={{ padding: "10px", background: "#fef3c7", color: "#92400e", borderRadius: "8px", marginBottom: "15px", fontSize: "13px" }}>{error}</div>}

        <button className="btn" style={{ width: "100%", padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }} disabled={busy}>
          {busy ? "Connecting..." : "Login"}
        </button>
      </form>
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
        <StatCard icon="👥" title="Clients" value={counts.clients} />
        <StatCard icon="🏢" title="Franchises" value={counts.franchises} />
        <StatCard icon="📊" title="Total Plays" value={counts.plays} />
      </div>

      <div className="panel" style={{ background: "#fff", padding: "20px", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: "18px" }}>Remote TV Network Control Hub</h2>
        <div className="actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("ads")}>+ Advertisement</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("playlists")}>▶ Playlist</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("screens")}>📺 Manage TVs</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("live")}>🔴 Live Status</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("news")}>📰 Flash News Ticker</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("reports")}>📊 Live Reports</button>
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

/* ================= 1. AREAS MODULE (ADD / EDIT / DELETE) ================= */
function Areas({ data, reload }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", city: "", state: "" });

  function openNew() {
    setEditId(null);
    setForm({ name: "", city: "", state: "" });
    setOpen(true);
  }

  function openEdit(area) {
    setEditId(area.id);
    setForm({ name: area.name, city: area.city || "", state: area.state || "" });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return alert("Area Name ఇవ్వండి.");
    let next;
    if (editId) {
      next = data.areas.map(a => a.id === editId ? { ...a, name: form.name.trim(), city: form.city.trim(), state: form.state.trim() } : a);
    } else {
      next = [...data.areas, { id: `area_${Date.now()}`, name: form.name.trim(), city: form.city.trim(), state: form.state.trim(), active: true }];
    }
    try {
      await api("/areas", { method: "PUT", body: JSON.stringify(next) });
      setOpen(false);
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("ఈ Areaను తొలగించాలా?")) return;
    try {
      await api("/areas", { method: "PUT", body: JSON.stringify(data.areas.filter(a => a.id !== id)) });
      await reload();
    } catch (err) {
      alert(err.message);
    }
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

/* ================= 2. SCREENS MODULE (ADD / EDIT / DELETE / SHORT URL) ================= */
function Screens({ data, reload }) {
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", areaId: "", shortCode: "" });

  async function loadPending() {
    try {
      setPending(await api("/pair/pending"));
    } catch {
      setPending([]);
    }
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
    setForm({ name: "", areaId: "", shortCode: String(data.screens.length + 1) });
    setOpen(true);
  }

  function openEdit(sc) {
    setEditId(sc.id);
    setForm({ name: sc.name, areaId: sc.areaId || "", shortCode: sc.shortCode || "" });
    setOpen(true);
  }

  async function saveScreen() {
    if (!form.name.trim()) return alert("TV Name ఇవ్వండి.");
    let next;
    if (editId) {
      next = data.screens.map(s =>
        s.id === editId ? { ...s, name: form.name.trim(), areaId: form.areaId, shortCode: form.shortCode.trim() || s.shortCode } : s
      );
    } else {
      next = [...data.screens, {
        id: `tv_${Date.now()}`,
        shortCode: form.shortCode.trim() || String(data.screens.length + 1),
        name: form.name.trim(),
        areaId: form.areaId,
        status: "offline",
        lastSeen: null,
        playlistId: null,
        createdAt: new Date().toISOString(),
      }];
    }
    try {
      await api("/screens", { method: "PUT", body: JSON.stringify(next) });
      setOpen(false);
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function assignPlaylist(screenId, playlistId) {
    const next = data.screens.map(s => s.id === screenId ? { ...s, playlistId: playlistId || null } : s);
    try {
      await api("/screens", { method: "PUT", body: JSON.stringify(next) });
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeScreen(id) {
    if (!confirm("ఈ TV Screen ను తీసివేయాలా?")) return;
    try {
      await api("/screens", { method: "PUT", body: JSON.stringify(data.screens.filter(s => s.id !== id)) });
      await reload();
    } catch (err) {
      alert(err.message);
    }
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
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
              <p style={{ margin: "5px 0", color: "#64748b", fontSize: "13px" }}>Location: {data.areas.find(a => a.id === screen.areaId)?.name || "Remote"}</p>

              <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: "6px", marginBottom: "10px", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#1d4ed8", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis" }}>{shortUrl}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(shortUrl); alert("Short Player URL కాపీ అయింది!"); }}
                  style={{ padding: "2px 6px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}
                >
                  Copy
                </button>
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label style={{ fontSize: "12px", color: "#475569", display: "block", marginBottom: "4px" }}>Select Playlist to Play:</label>
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
                <button
                  onClick={() => window.open(shortUrl, "_blank", "noopener,noreferrer")}
                  style={{ flex: 1, padding: "6px", background: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                >
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
        <Modal title={editId ? "Edit TV Screen" : "Add TV Screen Manually"} close={() => setOpen(false)}>
          <Field label="TV Name" value={form.name} set={v => setForm({ ...form, name: v })} />
          <Field label="Short TV Code / Number (e.g. 1, 2, hyd1)" value={form.shortCode} set={v => setForm({ ...form, shortCode: v })} />
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

/* ================= 3. ADS MODULE (UPLOAD / EDIT DURATION / REPLACE FILE / DELETE) ================= */
function Ads({ data, reload }) {
  const [open, setOpen] = useState(false);
  const [editAd, setEditAd] = useState(null);
  const [form, setForm] = useState({ name: "", duration: 10, file: null });
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditAd(null);
    setForm({ name: "", duration: 10, file: null });
    setOpen(true);
  }

  function openEditModal(ad) {
    setEditAd(ad);
    setForm({ name: ad.name, duration: ad.duration || 10, file: null });
    setOpen(true);
  }

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

      let next;
      if (editAd) {
        next = data.ads.map(item =>
          item.id === editAd.id
            ? {
                ...item,
                name: form.name.trim(),
                duration: Number(form.duration) || 10,
                ...uploadedData,
                updatedAt: new Date().toISOString(),
              }
            : item
        );
      } else {
        const advertisement = {
          id: `ad_${Date.now()}`,
          name: form.name.trim(),
          duration: Number(form.duration) || 10,
          ...uploadedData,
          createdAt: new Date().toISOString(),
        };
        next = [...data.ads, advertisement];
      }

      await api("/ads", { method: "PUT", body: JSON.stringify(next) });
      setForm({ name: "", duration: 10, file: null });
      setEditAd(null);
      setOpen(false);
      await reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAdvertisement(ad) {
    if (!confirm(`"${ad.name}" యాడ్‌ను శాశ్వతంగా డిలీట్ చేయాలా? (ఇది అన్ని Playlists నుండి కూడా తొలగిపోతుంది)`)) return;
    try {
      await api("/ads", { method: "PUT", body: JSON.stringify(data.ads.filter(item => item.id !== ad.id)) });
      if (ad.fileKey && !ad.permanent && !ad.isSocial) {
        try { await api(`/upload/${encodeURIComponent(ad.fileKey)}`, { method: "DELETE" }); } catch {}
      }
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>🎞 Advertisements Media Library ({data.ads.length})</h2>
        <button onClick={openNew} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Upload Video / Banner</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "15px" }}>
        {data.ads.map(ad => (
          <div key={ad.id} style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "15px" }}>{ad.name}</h3>
            <div style={{ width: "100%", height: "140px", background: "#000", borderRadius: "6px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "12px" }}>
              {ad.isSocial ? (
                <div style={{ textAlign: "center", padding: "10px" }}>
                  <div style={{ fontSize: "24px" }}>📱</div>
                  <div>{ad.platform || "Social Media"} Live/Video</div>
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
              <button
                onClick={() => openEditModal(ad)}
                style={{ flex: 1, padding: "6px 8px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
              >
                ✏️ Edit / Replace
              </button>
              <button
                onClick={() => deleteAdvertisement(ad)}
                style={{ padding: "6px 10px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
              >
                🗑 Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Modal title={editAd ? "Edit Ad / Duration / Replace Media" : "Upload Advertisement"} close={() => !busy && setOpen(false)}>
          <Field label="Ad / Client Title" value={form.name} set={v => setForm({ ...form, name: v })} />
          <Field label="Display Duration (seconds)" type="number" value={form.duration} set={v => setForm({ ...form, duration: v })} />
          {!editAd?.isSocial && (
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                {editAd ? "Replace Video / Image (Optional - మార్చాలనుకుంటేనే ఎంచుకోండి)" : "Select Video (MP4) or Image (PNG/JPG)"}
              </label>
              <input type="file" accept="video/mp4,video/webm,image/jpeg,image/png,image/webp" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} />
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

/* ================= 4. PLAYLISTS MODULE (EDIT / UNLIMITED ADS / INLINE DURATION & DELETE) ================= */
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

  function openCreateModal() {
    setEditingId(null);
    setForm({ name: "", adIds: [] });
    setOpen(true);
  }

  function openEditModal(pl) {
    setEditingId(pl.id);
    setForm({
      name: pl.name,
      adIds: Array.isArray(pl.adIds) ? [...pl.adIds] : [],
    });
    setOpen(true);
  }

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

  async function savePlaylist() {
    if (!form.name.trim()) return alert("Playlist Name ఇవ్వండి.");
    if (form.adIds.length === 0) return alert("కనీసం ఒక Ad ఎంపిక చేయండి.");

    let next;
    if (editingId) {
      next = data.playlists.map(pl =>
        pl.id === editingId
          ? { ...pl, name: form.name.trim(), adIds: form.adIds, updatedAt: new Date().toISOString() }
          : pl
      );
    } else {
      next = [...data.playlists, {
        id: `pl_${Date.now()}`,
        name: form.name.trim(),
        adIds: form.adIds,
        createdAt: new Date().toISOString(),
      }];
    }

    try {
      await api("/playlists", { method: "PUT", body: JSON.stringify(next) });
      setForm({ name: "", adIds: [] });
      setEditingId(null);
      setOpen(false);
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function removePlaylist(id) {
    if (!confirm("ఈ Playlist ను తొలగించాలా?")) return;
    try {
      await api("/playlists", { method: "PUT", body: JSON.stringify(data.playlists.filter(p => p.id !== id)) });
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>▶ TV Playlists ({data.playlists.length})</h2>
        <button onClick={openCreateModal} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Create New Playlist</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px" }}>
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
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => openEditModal(pl)}
                style={{ flex: 1, padding: "6px 10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
              >
                ✏️ Edit / Add Ads
              </button>
              <button
                onClick={() => removePlaylist(pl.id)}
                style={{ padding: "6px 10px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Modal
          title={editingId ? "Edit Playlist & Manage Ads" : "Create New Playlist"}
          close={() => { setOpen(false); setEditingId(null); }}
        >
          <Field label="Playlist Name" value={form.name} set={v => setForm({ ...form, name: v })} />
          <div style={{ marginBottom: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600" }}>
                Select Ads ({form.adIds.length} selected)
              </label>
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
                    <input
                      type="checkbox"
                      checked={form.adIds.includes(ad.id)}
                      onChange={e => toggleAd(ad.id, e.target.checked)}
                    />
                    <span style={{ flex: 1 }}>{ad.name}</span>
                    <button
                      type="button"
                      onClick={() => quickUpdateDuration(ad)}
                      title="Edit Duration"
                      style={{ fontSize: "11px", padding: "2px 6px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer" }}
                    >
                      ⏱ {ad.duration || 10}s
                    </button>
                    <button
                      type="button"
                      onClick={() => quickDeleteAd(ad)}
                      title="Delete Ad Permanently"
                      style={{ fontSize: "11px", padding: "2px 6px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer" }}
                    >
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

/* ================= 5. SCHEDULES MODULE (IST TIME / ADD / EDIT / DELETE) ================= */
function Schedules({ data, reload }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", screenId: "", playlistId: "", start: "09:00", end: "21:00" });

  function toMinutes(time) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  function openNew() {
    setEditId(null);
    setForm({ name: "", screenId: "", playlistId: "", start: "09:00", end: "21:00" });
    setOpen(true);
  }

  function openEdit(sc) {
    setEditId(sc.id);
    setForm({
      name: sc.name,
      screenId: sc.screenId,
      playlistId: sc.playlistId,
      start: formatMinutes(sc.start),
      end: formatMinutes(sc.end),
    });
    setOpen(true);
  }

  async function saveSchedule() {
    if (!form.name.trim() || !form.screenId || !form.playlistId) return alert("దయచేసి అన్ని వివరాలు పూరించండి.");
    let next;
    if (editId) {
      next = data.schedules.map(sc =>
        sc.id === editId
          ? { ...sc, name: form.name.trim(), screenId: form.screenId, playlistId: form.playlistId, start: toMinutes(form.start), end: toMinutes(form.end) }
          : sc
      );
    } else {
      next = [...data.schedules, {
        id: `sc_${Date.now()}`,
        name: form.name.trim(),
        screenId: form.screenId,
        playlistId: form.playlistId,
        start: toMinutes(form.start),
        end: toMinutes(form.end),
        days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        active: true,
      }];
    }
    try {
      await api("/schedules", { method: "PUT", body: JSON.stringify(next) });
      setOpen(false);
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeSchedule(id) {
    if (!confirm("ఈ Schedule ను తొలగించాలా?")) return;
    try {
      await api("/schedules", { method: "PUT", body: JSON.stringify(data.schedules.filter(s => s.id !== id)) });
      await reload();
    } catch (err) {
      alert(err.message);
    }
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

/* ================= 6. LIVE CENTER MODULE ================= */
function LiveCenter({ data }) {
  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2 style={{ margin: "0 0 10px" }}>🔴 Live TV Broadcast Center</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px" }}>
        {data.screens.map((screen, idx) => {
          const shortUrl = `${getServerOrigin()}/tv/${screen.shortCode || idx + 1}`;
          return (
            <div key={screen.id} style={{ border: "2px solid #e2e8f0", padding: "15px", borderRadius: "10px", background: screen.status === "online" ? "#f0fdf4" : "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>{screen.name}</h3>
                <span style={{ fontSize: "12px", color: screen.status === "online" ? "#15803d" : "#991b1b", fontWeight: "bold" }}>
                  {screen.status === "online" ? "● LIVE STREAMING" : "○ OFFLINE"}
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "6px 0" }}>Last Heartbeat: {screen.lastSeen ? new Date(screen.lastSeen).toLocaleTimeString() : "Never"}</p>
              <button
                onClick={() => window.open(shortUrl, "_blank")}
                style={{ width: "100%", padding: "8px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", marginTop: "8px" }}
              >
                🖥 Remote Screen Monitor
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= 7. FRANCHISE MODULE (ADD / EDIT / DELETE) ================= */
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

/* ================= 8. CRM MODULE (ADD / EDIT / DELETE) ================= */
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

/* ================= 9. BILLING MODULE (ADD / EDIT / DELETE) ================= */
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

/* ================= 10. NEWS & FLASH TICKERS (SCROLLS ON TOP OF VIDEO/PHOTO IN TV PLAYER) ================= */
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
      <h2 style={{ margin: "0 0 6px" }}>📰 Flash News & Bottom Screen Tickers</h2>
      <p style={{ color: "#16a34a", fontSize: "13px", marginBottom: "15px" }}>
        ఇక్కడ యాడ్ చేసిన స్క్రోలింగ్ వార్తలు అన్ని టీవీ స్క్రీన్లపై వీడియో మరియు ఫోటో యాడ్స్ క్రింద లైవ్‌లో స్క్రోల్ అవుతాయి.
      </p>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="ఉదాహరణ: 50% స్పెషల్ డిస్కౌంట్ ఆఫర్ అందుబాటులో ఉంది..."
          style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
        />
        <button onClick={saveTicker} style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
          {editId ? "Update Ticker" : "+ Add Scroll Ticker"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {(data.tickers || []).map(tk => (
          <div key={tk.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#f8fafc", borderRadius: "8px", borderLeft: "4px solid #ef4444" }}>
            <span>📢 {tk.text}</span>
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

/* ================= 11. SOCIAL MEDIA & LIVE LINKS INTEGRATION ================= */
function SocialMedia({ data, reload }) {
  const [form, setForm] = useState({ title: "", platform: "YouTube", url: "", duration: 30, targetScreenId: "" });

  const platforms = [
    "YouTube / YouTube Live",
    "Facebook Video / Live",
    "Instagram Reels / Video",
    "X (Twitter) Video",
    "Vimeo",
    "Dailymotion",
    "Direct MP4 / HLS Live Stream (.m3u8)"
  ];

  async function addSocialAd() {
    if (!form.title.trim() || !form.url.trim()) return alert("Title మరియు Social Media Video URL ఇవ్వండి.");

    // Create as an Ad in Ads Library so it can be added to any playlist & tracked in reports
    const newAd = {
      id: `ad_soc_${Date.now()}`,
      name: `[${form.platform.split(" ")[0]}] ${form.title.trim()}`,
      duration: Number(form.duration) || 30,
      fileUrl: form.url.trim(),
      fileType: "social/stream",
      platform: form.platform,
      isSocial: true,
      createdAt: new Date().toISOString(),
    };

    const nextAds = [...data.ads, newAd];
    await api("/ads", { method: "PUT", body: JSON.stringify(nextAds) });

    // If user selected a target TV, automatically add to that TV's playlist or create one
    if (form.targetScreenId) {
      const targetScreen = data.screens.find(s => s.id === form.targetScreenId);
      if (targetScreen) {
        if (targetScreen.playlistId) {
          const nextPl = data.playlists.map(p =>
            p.id === targetScreen.playlistId ? { ...p, adIds: [...p.adIds, newAd.id] } : p
          );
          await api("/playlists", { method: "PUT", body: JSON.stringify(nextPl) });
        } else {
          const newPl = { id: `pl_${Date.now()}`, name: `${targetScreen.name} Live Loop`, adIds: [newAd.id], createdAt: new Date().toISOString() };
          await api("/playlists", { method: "PUT", body: JSON.stringify([...data.playlists, newPl]) });
          const nextSc = data.screens.map(s => s.id === targetScreen.id ? { ...s, playlistId: newPl.id } : s);
          await api("/screens", { method: "PUT", body: JSON.stringify(nextSc) });
        }
      }
    }

    setForm({ title: "", platform: "YouTube", url: "", duration: 30, targetScreenId: "" });
    alert("సోషల్ మీడియా వీడియో యాడ్ విజయవంతంగా జోడించబడింది!");
    await reload();
  }

  async function removeSocialAd(id) {
    if (!confirm("ఈ సోషల్ మీడియా వీడియోను తొలగించాలా?")) return;
    await api("/ads", { method: "PUT", body: JSON.stringify(data.ads.filter(a => a.id !== id)) });
    await reload();
  }

  const socialAds = data.ads.filter(a => a.isSocial);

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2>📱 Social Media & Live Video Integration</h2>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "15px" }}>
        YouTube, Facebook, Instagram, X, Vimeo, Dailymotion లేదా డైరెక్ట్ లైవ్ లింక్‌లను యాడ్ చేసి ఏ టీవీలో కావాలంటే ఆ టీవీలో లైవ్ చేయవచ్చు.
      </p>

      <div style={{ background: "#f8fafc", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Social Platform</label>
            <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              {platforms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Video / Channel Title</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="ఉదా: Telugu Focus TV Live" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Play Duration (Seconds)</label>
            <input type="number" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Push Directly to TV (Optional)</label>
            <select value={form.targetScreenId} onChange={e => setForm({ ...form, targetScreenId: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              <option value="">Save to Ads Library Only</option>
              {data.screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: "10px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Social Video / Live URL</label>
          <input type="text" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=... లేదా Facebook/Instagram/MP4 లింక్" style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
        </div>

        <button onClick={addSocialAd} style={{ marginTop: "12px", padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>
          + Add Social Video & Broadcast
        </button>
      </div>

      <h3 style={{ margin: "0 0 10px" }}>Connected Social Media Streams ({socialAds.length})</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
        {socialAds.map(sa => (
          <div key={sa.id} style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "8px" }}>
            <div style={{ fontWeight: "bold", fontSize: "14px" }}>{sa.name}</div>
            <div style={{ fontSize: "12px", color: "#2563eb", margin: "4px 0", wordBreak: "break-all" }}>{sa.fileUrl}</div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>Duration: {sa.duration}s</div>
            <button onClick={() => removeSocialAd(sa.id)} style={{ padding: "4px 10px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>🗑 Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= 12. MARKETING & LEADS ================= */
function MarketingLeads({ data }) {
  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2>📢 Local Digital Marketing & Lead Generation</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginTop: "15px" }}>
        <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
          <div style={{ fontSize: "13px", color: "#64748b" }}>Active TV Screens</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2563eb", marginTop: "5px" }}>{data.screens.length}</div>
        </div>
        <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
          <div style={{ fontSize: "13px", color: "#64748b" }}>Total Ad Impressions (Plays)</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#16a34a", marginTop: "5px" }}>{data.playback.length}</div>
        </div>
        <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
          <div style={{ fontSize: "13px", color: "#64748b" }}>Active Advertisers</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#9333ea", marginTop: "5px" }}>{data.clients.length}</div>
        </div>
      </div>
    </div>
  );
}

/* ================= 13. AI TOOLS MODULE ================= */
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
      <input
        type="text"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Shop / Business Name & Offer..."
        style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "10px" }}
      />
      <button onClick={generateScript} style={{ padding: "10px 20px", background: "#9333ea", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>Generate Ad Script</button>
      {generatedAd && <div style={{ marginTop: "20px", padding: "15px", background: "#faf5ff", borderRadius: "8px", whiteSpace: "pre-line" }}>{generatedAd}</div>}
    </div>
  );
}

/* ================= 14. REPORTS MODULE (LIVE PROOF OF PLAY + ALL MODULE SUMMARY) ================= */
function Reports({ data, reload }) {
  const rows = useMemo(() => {
    const map = {};
    for (const play of data.playback || []) {
      const key = play.adId || play.adName || "unknown";
      if (!map[key]) {
        map[key] = {
          adId: key,
          name: data.ads.find(a => a.id === key)?.name || play.adName || key,
          plays: 0,
          lastScreen: play.screenName || play.screenId || "-",
          lastPlayedAt: play.createdAt,
        };
      }
      map[key].plays += 1;
      map[key].lastScreen = play.screenName || play.screenId || map[key].lastScreen;
      map[key].lastPlayedAt = play.createdAt;
    }
    return Object.values(map);
  }, [data]);

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <div>
          <h2 style={{ margin: 0 }}>📊 Live Ad Proof of Play & System Reports</h2>
          <small style={{ color: "#64748b" }}>టీవీలో యాడ్ ప్లే అయిన ప్రతిసారీ ఇక్కడ ఆటోమేటిక్‌గా అప్‌డేట్ అవుతుంది</small>
        </div>
        <button onClick={reload} style={{ padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>↻ Refresh Live Data</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginBottom: "20px" }}>
        <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px" }}><b>Total Plays:</b> {data.playback.length}</div>
        <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px" }}><b>TV Screens:</b> {data.screens.length}</div>
        <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px" }}><b>Total Ads:</b> {data.ads.length}</div>
        <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px" }}><b>Playlists:</b> {data.playlists.length}</div>
        <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px" }}><b>Schedules:</b> {data.schedules.length}</div>
        <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px" }}><b>Tickers:</b> {data.tickers.length}</div>
      </div>

      <h3 style={{ margin: "0 0 10px" }}>Advertisement Proof of Play Log</h3>
      {rows.length === 0 ? (
        <div style={{ color: "#94a3b8", padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
          ఇంకా playback reporting నమోదు కాలేదు. టీవీ ప్లేయర్ లింక్ ఓపెన్ చేసి యాడ్ ప్లే అవ్వగానే ఇక్కడ లైవ్ కౌంట్ కనిపిస్తుంది.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px", marginBottom: "25px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "10px" }}>Advertisement</th>
              <th style={{ padding: "10px" }}>Total Play Count</th>
              <th style={{ padding: "10px" }}>Last Played TV</th>
              <th style={{ padding: "10px" }}>Last Played Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.adId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px", fontWeight: "600" }}>{row.name}</td>
                <td style={{ padding: "10px", color: "#2563eb", fontWeight: "bold" }}>{row.plays} times</td>
                <td style={{ padding: "10px" }}>{row.lastScreen}</td>
                <td style={{ padding: "10px", fontSize: "12px", color: "#64748b" }}>{row.lastPlayedAt ? new Date(row.lastPlayedAt).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.playback.length > 0 && (
        <>
          <h3 style={{ margin: "0 0 10px" }}>Recent Live Play History (Last 15)</h3>
          <div style={{ maxHeight: "220px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "8px" }}>Time</th>
                  <th style={{ padding: "8px" }}>TV Screen</th>
                  <th style={{ padding: "8px" }}>Ad Played</th>
                </tr>
              </thead>
              <tbody>
                {[...data.playback].reverse().slice(0, 15).map(item => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px" }}>{new Date(item.createdAt).toLocaleTimeString()}</td>
                    <td style={{ padding: "8px" }}>{item.screenName || item.screenId}</td>
                    <td style={{ padding: "8px", fontWeight: "600" }}>{item.adName || item.adId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ================= 15. SETTINGS MODULE ================= */
function Settings({ reload, cloudEnabled }) {
  const [restoring, setRestoring] = useState(false);

  async function downloadBackup() {
    try {
      const backup = await api("/backup");
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tv-ad-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
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
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2>⚙ Central Management System Settings & Auto-Sync</h2>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "15px" }}>
        Storage Status: <b>{cloudEnabled ? "☁️ Permanent Cloudinary Active" : "⚠ Render Local (Add Cloudinary keys in Render Environment for permanent media storage)"}</b>
      </p>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={downloadBackup} style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>
          📥 Download Setup Backup (.json)
        </button>

        <label style={{ padding: "10px 20px", background: "#10b981", color: "#fff", borderRadius: "6px", cursor: "pointer", fontWeight: "600", display: "inline-block" }}>
          {restoring ? "Restoring..." : "📤 Restore Setup File (.json)"}
          <input type="file" accept=".json,application/json" onChange={restoreBackup} style={{ display: "none" }} disabled={restoring} />
        </label>
      </div>
    </div>
  );
}

function Field({ label, value, set, type = "text" }) {
  return (
    <div style={{ marginBottom: "15px" }}>
      <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => set(e.target.value)}
        style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
      />
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

/* ================= TV PLAYER MODE (SHORT URL / AUDIO / SCROLLING TICKER / LIVE PROOF OF PLAY) ================= */
function getPlayerScreenId() {
  // Support clean short URLs like /tv/1 or /tv/tv_12345
  const pathMatch = window.location.pathname.match(/^\/tv\/([^/]+)/i);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);

  const params = new URLSearchParams(window.location.search);
  return params.get("player") || params.get("screen") || "";
}

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

  if (state.loading) return <div style={{ background: "#000", color: "#fff", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Connecting to Tirupati Central Hub...</div>;
  if (!state.ads.length) return <div style={{ background: "#000", color: "#fff", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>No ads assigned to this TV screen yet.</div>;

  const tickerText = state.tickers.map(t => `📢 ${t.text}`).join("     •     ");

  return (
    <div
      onClick={() => {
        if (muted) setMuted(false);
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }}
      style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
    >
      <PlayerAd
        ad={currentAd}
        muted={muted}
        onUnmuteRequest={() => setMuted(true)}
        onFinished={() => setIndex(i => (i + 1) % state.ads.length)}
      />

      {muted && (
        <button
          onClick={(e) => { e.stopPropagation(); setMuted(false); }}
          style={{ position: "fixed", top: "15px", right: "15px", zIndex: 50, padding: "8px 14px", background: "rgba(0,0,0,0.75)", color: "#fff", border: "1px solid #fff", borderRadius: "20px", cursor: "pointer", fontSize: "13px" }}
        >
          🔇 Tap for Audio
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

function PlayerAd({ ad, muted, onUnmuteRequest, onFinished }) {
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
        key={ad.id + ad.fileUrl}
        src={mediaUrl(ad.fileUrl)}
        autoPlay
        muted={muted}
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        onPlay={(e) => {
          // If browser blocks unmuted autoplay, fallback to muted so video still plays without freezing
          if (e.target.paused) {
            onUnmuteRequest();
          }
        }}
        onEnded={onFinished}
      />
    );
  }

  return <img src={mediaUrl(ad.fileUrl)} alt={ad.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
}

export default function AppRoot() {
  const playerId = getPlayerScreenId();
  if (playerId) return <PlayerMode screenId={playerId} />;
  return <AdminApp />;
}
