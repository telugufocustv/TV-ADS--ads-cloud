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
    } catch {
      // Keep the HTTP status message.
    }
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
};

function AdminApp() {
  const [token, setToken] = useState(localStorage.getItem("tam_token"));
  const [page, setPage] = useState("dashboard");
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const result = await api("/state");
      setData({
        ...emptyData,
        ...result,
        // Load custom offline/extended modules from local cache if not on backend yet
        franchises: result.franchises || JSON.parse(localStorage.getItem("tam_franchises") || "[]"),
        clients: result.clients || JSON.parse(localStorage.getItem("tam_clients") || "[]"),
        billings: result.billings || JSON.parse(localStorage.getItem("tam_billings") || "[]"),
        tickers: result.tickers || JSON.parse(localStorage.getItem("tam_tickers") || "[]"),
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
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadData();
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

  const currentTitle =
    NAV.find(([key]) => key === page)?.[1] || "Dashboard";

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
              Central Multi-City Remote TV Controller • Tirupati Hub
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn secondary" onClick={loadData} style={{ padding: "8px 16px", cursor: "pointer", borderRadius: "6px" }}>
              ↻ Refresh
            </button>
            <button className="btn danger" onClick={() => { localStorage.removeItem("tam_token"); setToken(null); }} style={{ padding: "8px 16px", cursor: "pointer", borderRadius: "6px", background: "#ef4444", color: "#fff", border: "none" }}>
              Logout
            </button>
          </div>
        </div>

        {error && <div className="notice" style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "15px" }}>{error}</div>}

        {page === "dashboard" && <Dashboard counts={counts} data={data} setPage={setPage} />}
        {page === "areas" && <Areas data={data} setData={setData} />}
        {page === "screens" && <Screens data={data} setData={setData} />}
        {page === "ads" && <Ads data={data} setData={setData} />}
        {page === "playlists" && <Playlists data={data} setData={setData} />}
        {page === "schedules" && <Schedules data={data} setData={setData} />}
        {page === "live" && <LiveCenter data={data} />}
        {page === "franchise" && <Franchise data={data} setData={setData} />}
        {page === "crm" && <CRM data={data} setData={setData} />}
        {page === "billing" && <Billing data={data} setData={setData} />}
        {page === "news" && <FlashNews data={data} setData={setData} />}
        {page === "social" && <SocialMedia />}
        {page === "marketing" && <MarketingLeads />}
        {page === "aitools" && <AITools />}
        {page === "reports" && <Reports data={data} />}
        {page === "settings" && <Settings reload={loadData} />}
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

      if (!result?.token) {
        throw new Error("Server login responseలో token లేదు.");
      }
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
            placeholder="https://your-tunnel.loca.lt"
          />
        </div>

        <div className="field" style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Username</label>
          <input
            type="text"
            value="admin"
            disabled
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f1f5f9" }}
          />
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

        <p className="small muted" style={{ textAlign: "center", marginTop: "15px", fontSize: "12px", color: "#94a3b8" }}>
          Default setup: admin / admin123
        </p>
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
        <p style={{ margin: "0 0 15px", color: "#64748b", fontSize: "14px" }}>
          మీరు తిరుపతి ఇంట్లో నుంచే హైదరాబాద్, వైజాగ్, విజయవాడ వంటి వేర్వేరు నగరాల్లోని TV స్క్రీన్లను నేరుగా కంట్రోల్ చేయవచ్చు.
        </p>

        <div className="actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("ads")}>+ Advertisement</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("playlists")}>▶ Playlist</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("screens")}>📺 Manage TVs</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("live")}>🔴 Live Status</button>
          <button className="btn" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }} onClick={() => setPage("news")}>📰 Flash News Ticker</button>
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
                <th style={{ padding: "10px" }}>City / Area</th>
                <th style={{ padding: "10px" }}>Assigned Playlist</th>
                <th style={{ padding: "10px" }}>Status</th>
                <th style={{ padding: "10px" }}>Live Action</th>
              </tr>
            </thead>
            <tbody>
              {data.screens.map((screen) => (
                <tr key={screen.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px", fontWeight: "600" }}>{screen.name}</td>
                  <td style={{ padding: "10px" }}>{data.areas.find(a => a.id === screen.areaId)?.name || "Remote TV"}</td>
                  <td style={{ padding: "10px" }}>{data.playlists.find(p => p.id === screen.playlistId)?.name || "No Playlist"}</td>
                  <td style={{ padding: "10px" }}>
                    <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", background: screen.status === "online" ? "#dcfce7" : "#fee2e2", color: screen.status === "online" ? "#15803d" : "#b91c1c" }}>
                      {screen.status || "offline"}
                    </span>
                  </td>
                  <td style={{ padding: "10px" }}>
                    <button
                      onClick={() => {
                        const url = `${getServerOrigin()}/?player=${encodeURIComponent(screen.id)}`;
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      style={{ padding: "6px 12px", background: "#10b981", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
                    >
                      ▶ Watch / Launch
                    </button>
                  </td>
                </tr>
              ))}
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
function Areas({ data, setData }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", state: "" });

  async function save() {
    if (!form.name.trim()) return alert("Area Name ఇవ్వండి.");
    const newArea = {
      id: `area_${Date.now()}`,
      name: form.name.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      active: true,
    };
    const next = [...data.areas, newArea];
    try {
      await api("/areas", { method: "PUT", body: JSON.stringify(next) });
      setData({ ...data, areas: next });
      setForm({ name: "", city: "", state: "" });
      setOpen(false);
    } catch (err) {
      alert(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("ఈ Areaను తొలగించాలా?")) return;
    const next = data.areas.filter(a => a.id !== id);
    try {
      await api("/areas", { method: "PUT", body: JSON.stringify(next) });
      setData({ ...data, areas: next });
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>📍 Cities & Operational Areas ({data.areas.length})</h2>
        <button onClick={() => setOpen(true)} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add New Area / City</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "15px" }}>
        {data.areas.map(area => (
          <div key={area.id} style={{ border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 5px" }}>{area.name}</h3>
            <p style={{ margin: "0 0 10px", color: "#64748b", fontSize: "13px" }}>{area.city} {area.state && `(${area.state})`}</p>
            <button onClick={() => remove(area.id)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Delete</button>
          </div>
        ))}
      </div>

      {open && (
        <Modal title="Add Area / City" close={() => setOpen(false)}>
          <Field label="Area Name (e.g. Hyderabad Hitech City / Tirupati Center)" value={form.name} set={v => setForm({ ...form, name: v })} />
          <Field label="City (e.g. Tirupati, Hyderabad, Vizag)" value={form.city} set={v => setForm({ ...form, city: v })} />
          <Field label="State" value={form.state} set={v => setForm({ ...form, state: v })} />
          <button className="btn" onClick={save} style={{ marginTop: "15px", width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px" }}>Save Area</button>
        </Modal>
      )}
    </div>
  );
}

/* ================= 2. SCREENS MODULE ================= */
function Screens({ data, setData }) {
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", areaId: "" });

  async function loadPending() {
    try {
      const result = await api("/pair/pending");
      setPending(result);
    } catch {
      setPending([]);
    }
  }

  useEffect(() => { loadPending(); }, []);

  async function pairDevice(device) {
    const name = prompt("TV Screen Name", device.deviceName || "TV Screen");
    if (!name) return;
    const areaId = data.areas[0]?.id || "";
    const result = await api("/pair/approve", {
      method: "POST",
      body: JSON.stringify({ pairCode: device.pairCode, name, areaId }),
    });
    setData({ ...data, screens: [...data.screens, result] });
    await loadPending();
  }

  async function createManualScreen() {
    if (!form.name.trim()) return alert("TV Name ఇవ్వండి.");
    const newScreen = {
      id: `tv_${Date.now()}`,
      name: form.name.trim(),
      areaId: form.areaId,
      status: "offline",
      lastSeen: null,
      playlistId: null,
      createdAt: new Date().toISOString(),
    };
    const next = [...data.screens, newScreen];
    try {
      await api("/screens", { method: "PUT", body: JSON.stringify(next) });
      setData({ ...data, screens: next });
      setForm({ name: "", areaId: "" });
      setOpen(false);
    } catch (err) {
      alert(err.message);
    }
  }

  async function assignPlaylist(screenId, playlistId) {
    const next = data.screens.map(s => s.id === screenId ? { ...s, playlistId: playlistId || null } : s);
    try {
      await api("/screens", { method: "PUT", body: JSON.stringify(next) });
      setData({ ...data, screens: next });
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeScreen(id) {
    if (!confirm("ఈ TV Screen ను తీసివేయాలా?")) return;
    const next = data.screens.filter(s => s.id !== id);
    try {
      await api("/screens", { method: "PUT", body: JSON.stringify(next) });
      setData({ ...data, screens: next });
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ marginBottom: "20px", padding: "15px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
        <h3 style={{ margin: "0 0 8px" }}>🔗 Remote Android TV Pairing</h3>
        <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#64748b" }}>
          వేరే ఊర్లోని TV / Smart Box లో బ్రౌజర్‌లో <b>{getServerOrigin()}/player</b> ఓపెన్ చేస్తే వచ్చే 6-digit Code ను ఇక్కడ చూడవచ్చు.
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
        <button onClick={() => setOpen(true)} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add TV Manually</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px" }}>
        {data.screens.map(screen => (
          <div key={screen.id} style={{ border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{screen.name}</h3>
              <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", background: screen.status === "online" ? "#dcfce7" : "#fee2e2", color: screen.status === "online" ? "#15803d" : "#b91c1c" }}>
                {screen.status || "offline"}
              </span>
            </div>
            <p style={{ margin: "5px 0 10px", color: "#64748b", fontSize: "13px" }}>Location: {data.areas.find(a => a.id === screen.areaId)?.name || "Remote"}</p>
            
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

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => {
                  const url = `${getServerOrigin()}/?player=${encodeURIComponent(screen.id)}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                style={{ flex: 1, padding: "6px", background: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
              >
                ▶ Play TV
              </button>
              <button onClick={() => removeScreen(screen.id)} style={{ padding: "6px 12px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Modal title="Add TV Screen Manually" close={() => setOpen(false)}>
          <Field label="TV Name (e.g. Hyderabad Mall 1st Floor)" value={form.name} set={v => setForm({ ...form, name: v })} />
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>City / Area</label>
            <select value={form.areaId} onChange={e => setForm({ ...form, areaId: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
              <option value="">Select Area</option>
              {data.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn" onClick={createManualScreen} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px" }}>Save TV</button>
        </Modal>
      )}
    </div>
  );
}

/* ================= 3. ADS MODULE ================= */
function Ads({ data, setData }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", duration: 10, file: null });
  const [busy, setBusy] = useState(false);

  async function saveAdvertisement() {
    if (!form.name.trim()) return alert("Ad Name ఇవ్వండి.");
    if (!form.file) return alert("File ఎంపిక చేయండి.");
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", form.file);
      const uploaded = await api("/upload", { method: "POST", body: formData });
      const advertisement = {
        id: `ad_${Date.now()}`,
        name: form.name.trim(),
        duration: Number(form.duration) || 10,
        ...uploaded,
        createdAt: new Date().toISOString(),
      };
      const next = [...data.ads, advertisement];
      await api("/ads", { method: "PUT", body: JSON.stringify(next) });
      setData({ ...data, ads: next });
      setForm({ name: "", duration: 10, file: null });
      setOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAdvertisement(ad) {
    if (!confirm("ఈ advertisement ను తొలగించాలా?")) return;
    const next = data.ads.filter(item => item.id !== ad.id);
    try {
      await api("/ads", { method: "PUT", body: JSON.stringify(next) });
      if (ad.fileKey) {
        try { await api(`/upload/${encodeURIComponent(ad.fileKey)}`, { method: "DELETE" }); } catch {}
      }
      setData({ ...data, ads: next });
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>🎞 Advertisements Media Library ({data.ads.length})</h2>
        <button onClick={() => setOpen(true)} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Upload Video / Banner</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "15px" }}>
        {data.ads.map(ad => (
          <div key={ad.id} style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "15px" }}>{ad.name}</h3>
            <div style={{ width: "100%", height: "140px", background: "#000", borderRadius: "6px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {ad.fileType?.startsWith("video/") ? (
                <video src={mediaUrl(ad.fileUrl)} style={{ maxWidth: "100%", maxHeight: "100%" }} controls preload="metadata" />
              ) : (
                <img src={mediaUrl(ad.fileUrl)} alt={ad.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              )}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
              Duration: {ad.duration || 10}s • {ad.fileType}
            </div>
            <button onClick={() => deleteAdvertisement(ad)} style={{ marginTop: "10px", padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", width: "100%" }}>
              Delete Ad
            </button>
          </div>
        ))}
      </div>

      {open && (
        <Modal title="Upload Advertisement" close={() => !busy && setOpen(false)}>
          <Field label="Ad / Client Title" value={form.name} set={v => setForm({ ...form, name: v })} />
          <Field label="Image Duration (seconds)" type="number" value={form.duration} set={v => setForm({ ...form, duration: v })} />
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Select Video (MP4) or Image (PNG/JPG)</label>
            <input type="file" accept="video/mp4,video/webm,image/jpeg,image/png,image/webp" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} />
          </div>
          <button className="btn" disabled={busy} onClick={saveAdvertisement} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px" }}>
            {busy ? "Uploading..." : "Upload & Save to Cloud"}
          </button>
        </Modal>
      )}
    </div>
  );
}

/* ================= 4. PLAYLISTS MODULE ================= */
function Playlists({ data, setData }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", adIds: [] });

  function toggleAd(adId, checked) {
    setForm(curr => ({
      ...curr,
      adIds: checked ? [...curr.adIds, adId] : curr.adIds.filter(id => id !== adId),
    }));
  }

  async function savePlaylist() {
    if (!form.name.trim()) return alert("Playlist Name ఇవ్వండి.");
    if (form.adIds.length === 0) return alert("కనీసం ఒక Ad ఎంపిక చేయండి.");
    const playlist = {
      id: `pl_${Date.now()}`,
      name: form.name.trim(),
      adIds: form.adIds,
      createdAt: new Date().toISOString(),
    };
    const next = [...data.playlists, playlist];
    try {
      await api("/playlists", { method: "PUT", body: JSON.stringify(next) });
      setData({ ...data, playlists: next });
      setForm({ name: "", adIds: [] });
      setOpen(false);
    } catch (err) {
      alert(err.message);
    }
  }

  async function removePlaylist(id) {
    if (!confirm("ఈ Playlist ను తొలగించాలా?")) return;
    const next = data.playlists.filter(p => p.id !== id);
    try {
      await api("/playlists", { method: "PUT", body: JSON.stringify(next) });
      setData({ ...data, playlists: next });
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>▶ TV Playlists ({data.playlists.length})</h2>
        <button onClick={() => setOpen(true)} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Create New Playlist</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px" }}>
        {data.playlists.map(pl => (
          <div key={pl.id} style={{ border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 5px" }}>{pl.name}</h3>
            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#64748b" }}>{pl.adIds.length} Advertisements in Loop</p>
            <div style={{ fontSize: "12px", background: "#f8fafc", padding: "8px", borderRadius: "4px", marginBottom: "10px", maxHeight: "100px", overflowY: "auto" }}>
              {pl.adIds.map((aid, idx) => (
                <div key={aid}>{idx + 1}. {data.ads.find(a => a.id === aid)?.name || "Ad"}</div>
              ))}
            </div>
            <button onClick={() => removePlaylist(pl.id)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Delete Playlist</button>
          </div>
        ))}
      </div>

      {open && (
        <Modal title="Create New Playlist" close={() => setOpen(false)}>
          <Field label="Playlist Name (e.g. Hyderabad Prime Loop)" value={form.name} set={v => setForm({ ...form, name: v })} />
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Select Ads for this Loop</label>
            {data.ads.length === 0 ? <p style={{ fontSize: "13px", color: "#b91c1c" }}>ముందుగా కొన్ని Ads అప్‌లోడ్ చేయండి.</p> : (
              data.ads.map(ad => (
                <label key={ad.id} style={{ display: "block", margin: "6px 0", fontSize: "13px" }}>
                  <input type="checkbox" checked={form.adIds.includes(ad.id)} onChange={e => toggleAd(ad.id, e.target.checked)} /> {ad.name}
                </label>
              ))
            )}
          </div>
          <button className="btn" onClick={savePlaylist} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px" }}>Save Playlist</button>
        </Modal>
      )}
    </div>
  );
}

/* ================= 5. SCHEDULES MODULE ================= */
function Schedules({ data, setData }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", screenId: "", playlistId: "", start: "09:00", end: "21:00" });

  function toMinutes(time) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  async function saveSchedule() {
    if (!form.name.trim() || !form.screenId || !form.playlistId) return alert("దయచేసి అన్ని వివరాలు పూరించండి.");
    const schedule = {
      id: `sc_${Date.now()}`,
      name: form.name.trim(),
      screenId: form.screenId,
      playlistId: form.playlistId,
      start: toMinutes(form.start),
      end: toMinutes(form.end),
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      active: true,
    };
    const next = [...data.schedules, schedule];
    try {
      await api("/schedules", { method: "PUT", body: JSON.stringify(next) });
      setData({ ...data, schedules: next });
      setOpen(false);
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeSchedule(id) {
    if (!confirm("ఈ Schedule ను తొలగించాలా?")) return;
    const next = data.schedules.filter(s => s.id !== id);
    try {
      await api("/schedules", { method: "PUT", body: JSON.stringify(next) });
      setData({ ...data, schedules: next });
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>🕒 Automated Time Schedules ({data.schedules.length})</h2>
        <button onClick={() => setOpen(true)} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add Schedule</button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ padding: "10px" }}>Schedule Name</th>
            <th style={{ padding: "10px" }}>Target TV</th>
            <th style={{ padding: "10px" }}>Playlist</th>
            <th style={{ padding: "10px" }}>Active Hours</th>
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
              <td style={{ padding: "10px" }}>
                <button onClick={() => removeSchedule(sc.id)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {open && (
        <Modal title="Add Broadcast Schedule" close={() => setOpen(false)}>
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
              <label style={{ fontSize: "13px" }}>Start Time</label>
              <input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} style={{ width: "100%", padding: "8px" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "13px" }}>End Time</label>
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
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>
        Monitor all remote screens live from your home and push immediate alerts or override loops.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px" }}>
        {data.screens.map(screen => (
          <div key={screen.id} style={{ border: "2px solid #e2e8f0", padding: "15px", borderRadius: "10px", background: screen.status === "online" ? "#f0fdf4" : "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{screen.name}</h3>
              <span style={{ fontSize: "12px", color: screen.status === "online" ? "#15803d" : "#991b1b", fontWeight: "bold" }}>
                {screen.status === "online" ? "● LIVE STREAMING" : "○ OFFLINE"}
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "6px 0" }}>Last Heartbeat: {screen.lastSeen ? new Date(screen.lastSeen).toLocaleTimeString() : "Never"}</p>
            <div style={{ marginTop: "10px" }}>
              <button
                onClick={() => {
                  const url = `${getServerOrigin()}/?player=${encodeURIComponent(screen.id)}`;
                  window.open(url, "_blank");
                }}
                style={{ width: "100%", padding: "8px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
              >
                🖥 Remote Screen Monitor
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= 7. FRANCHISE MODULE ================= */
function Franchise({ data, setData }) {
  const [franchises, setFranchises] = useState(data.franchises || []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", phone: "", commission: "20%" });

  function saveFranchise() {
    if (!form.name.trim()) return alert("Franchise Partner Name ఇవ్వండి.");
    const item = { id: `fr_${Date.now()}`, ...form };
    const next = [...franchises, item];
    setFranchises(next);
    localStorage.setItem("tam_franchises", JSON.stringify(next));
    setData({ ...data, franchises: next });
    setOpen(false);
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>🏢 Franchise Partners Management</h2>
        <button onClick={() => setOpen(true)} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add Franchise Partner</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "15px" }}>
        {franchises.map(fr => (
          <div key={fr.id} style={{ border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 5px" }}>{fr.name}</h3>
            <p style={{ margin: "0 0 5px", fontSize: "13px", color: "#64748b" }}>City: {fr.city}</p>
            <p style={{ margin: "0 0 5px", fontSize: "13px", color: "#64748b" }}>Phone: {fr.phone}</p>
            <span style={{ fontSize: "12px", background: "#e0f2fe", color: "#0369a1", padding: "3px 8px", borderRadius: "4px" }}>Revenue Share: {fr.commission}</span>
          </div>
        ))}
      </div>

      {open && (
        <Modal title="Add City Franchise Partner" close={() => setOpen(false)}>
          <Field label="Partner Name" value={form.name} set={v => setForm({ ...form, name: v })} />
          <Field label="Operational City (e.g. Hyderabad / Vizag)" value={form.city} set={v => setForm({ ...form, city: v })} />
          <Field label="Phone Number" value={form.phone} set={v => setForm({ ...form, phone: v })} />
          <Field label="Commission / Revenue Share" value={form.commission} set={v => setForm({ ...form, commission: v })} />
          <button className="btn" onClick={saveFranchise} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", marginTop: "10px" }}>Save Partner</button>
        </Modal>
      )}
    </div>
  );
}

/* ================= 8. CRM MODULE ================= */
function CRM({ data, setData }) {
  const [clients, setClients] = useState(data.clients || []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", business: "", phone: "", budget: "" });

  function saveClient() {
    if (!form.name.trim()) return alert("Client Name ఇవ్వండి.");
    const item = { id: `cl_${Date.now()}`, ...form };
    const next = [...clients, item];
    setClients(next);
    localStorage.setItem("tam_clients", JSON.stringify(next));
    setData({ ...data, clients: next });
    setOpen(false);
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>👥 Advertisers & Clients (CRM)</h2>
        <button onClick={() => setOpen(true)} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add Advertiser</button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ padding: "10px" }}>Client Name</th>
            <th style={{ padding: "10px" }}>Business / Brand</th>
            <th style={{ padding: "10px" }}>Phone</th>
            <th style={{ padding: "10px" }}>Monthly Budget</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(cl => (
            <tr key={cl.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px", fontWeight: "600" }}>{cl.name}</td>
              <td style={{ padding: "10px" }}>{cl.business}</td>
              <td style={{ padding: "10px" }}>{cl.phone}</td>
              <td style={{ padding: "10px", color: "#16a34a", fontWeight: "bold" }}>₹{cl.budget}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {open && (
        <Modal title="Add New Advertiser Client" close={() => setOpen(false)}>
          <Field label="Client Name" value={form.name} set={v => setForm({ ...form, name: v })} />
          <Field label="Shop / Business Name" value={form.business} set={v => setForm({ ...form, business: v })} />
          <Field label="Phone Number" value={form.phone} set={v => setForm({ ...form, phone: v })} />
          <Field label="Monthly Contract (₹)" value={form.budget} set={v => setForm({ ...form, budget: v })} />
          <button className="btn" onClick={saveClient} style={{ width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", marginTop: "10px" }}>Save Client</button>
        </Modal>
      )}
    </div>
  );
}

/* ================= 9. BILLING MODULE ================= */
function Billing({ data, setData }) {
  const [billings, setBillings] = useState(data.billings || []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client: "", amount: "", status: "Paid", date: new Date().toISOString().split("T")[0] });

  function saveInvoice() {
    if (!form.client.trim()) return alert("Client Name ఇవ్వండి.");
    const item = { id: `inv_${Date.now()}`, ...form };
    const next = [...billings, item];
    setBillings(next);
    localStorage.setItem("tam_billings", JSON.stringify(next));
    setData({ ...data, billings: next });
    setOpen(false);
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>💰 Invoices & Billing Management</h2>
        <button onClick={() => setOpen(true)} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Generate Invoice</button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ padding: "10px" }}>Client</th>
            <th style={{ padding: "10px" }}>Amount</th>
            <th style={{ padding: "10px" }}>Date</th>
            <th style={{ padding: "10px" }}>Payment Status</th>
          </tr>
        </thead>
        <tbody>
          {billings.map(inv => (
            <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px", fontWeight: "600" }}>{inv.client}</td>
              <td style={{ padding: "10px", fontWeight: "bold" }}>₹{inv.amount}</td>
              <td style={{ padding: "10px" }}>{inv.date}</td>
              <td style={{ padding: "10px" }}>
                <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "12px", background: inv.status === "Paid" ? "#dcfce7" : "#fee2e2", color: inv.status === "Paid" ? "#15803d" : "#b91c1c" }}>
                  {inv.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {open && (
        <Modal title="Create Invoicing Entry" close={() => setOpen(false)}>
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

/* ================= 10. NEWS & FLASH TICKERS ================= */
function FlashNews({ data, setData }) {
  const [tickers, setTickers] = useState(data.tickers || []);
  const [text, setText] = useState("");

  function addTicker() {
    if (!text.trim()) return;
    const next = [...tickers, { id: `tk_${Date.now()}`, text: text.trim(), active: true }];
    setTickers(next);
    localStorage.setItem("tam_tickers", JSON.stringify(next));
    setData({ ...data, tickers: next });
    setText("");
  }

  function removeTicker(id) {
    const next = tickers.filter(t => t.id !== id);
    setTickers(next);
    localStorage.setItem("tam_tickers", JSON.stringify(next));
    setData({ ...data, tickers: next });
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2 style={{ margin: "0 0 10px" }}>📰 Flash News & Bottom Screen Tickers</h2>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "15px" }}>
        టీవీ స్క్రీన్ల క్రింద స్క్రోల్ అయ్యే బ్రేకింగ్ న్యూస్, ఆఫర్స్ మరియు ప్రకటనల సమాచారం.
      </p>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="ఉదాహరణ: 50% స్పెషల్ డిస్కౌంట్ ఆఫర్ అందుబాటులో ఉంది..."
          style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
        />
        <button onClick={addTicker} style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>+ Add Scroll Ticker</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {tickers.map(tk => (
          <div key={tk.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#f8fafc", borderRadius: "8px", borderLeft: "4px solid #ef4444" }}>
            <span>📢 {tk.text}</span>
            <button onClick={() => removeTicker(tk.id)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer" }}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= 11. SOCIAL MEDIA SYNC ================= */
function SocialMedia() {
  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2>📱 Social Media & YouTube Live Integration</h2>
      <p style={{ color: "#64748b", fontSize: "14px" }}>
        Connect your YouTube channels (Telugu Focus TV News, Pentanna TV) to auto-broadcast breaking bulletins or promo songs to all TVs.
      </p>
      <div style={{ border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px", marginTop: "15px" }}>
        <h3 style={{ margin: "0 0 5px" }}>Auto-Sync YouTube Short / Live Streams</h3>
        <p style={{ fontSize: "13px", color: "#64748b" }}>Enter YouTube Channel / Video URL to sync with remote TV network</p>
        <input type="text" placeholder="https://youtube.com/watch?v=..." style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "10px" }} />
        <button style={{ padding: "8px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>Sync Video to All Screens</button>
      </div>
    </div>
  );
}

/* ================= 12. MARKETING & LEADS ================= */
function MarketingLeads() {
  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2>📢 Local Digital Marketing & Lead Generation</h2>
      <p style={{ color: "#64748b", fontSize: "14px" }}>
        Manage QR code scans from TVs and track customer engagement across Tirupati, Hyderabad, and Vijayawada.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginTop: "15px" }}>
        <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
          <div style={{ fontSize: "13px", color: "#64748b" }}>QR Scans Today</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2563eb", marginTop: "5px" }}>128</div>
        </div>
        <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
          <div style={{ fontSize: "13px", color: "#64748b" }}>Customer Enquiries</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#16a34a", marginTop: "5px" }}>34</div>
        </div>
        <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
          <div style={{ fontSize: "13px", color: "#64748b" }}>Ad Conversion Rate</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#9333ea", marginTop: "5px" }}>4.8%</div>
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
    setGeneratedAd(`🌟 30-Second Commercial Script for ${prompt}:\n\n[Scene 1 - 0 to 5s]: Eye-catching visual with bold Telugu typography introducing ${prompt}.\n[Scene 2 - 5 to 20s]: Highlights special festive discounts, prime location, and trusted quality.\n[Scene 3 - 20 to 30s]: Strong Call to Action: 'Visit today or Call Now! Scan the QR code on TV.'`);
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2>🤖 AI Ad Script & Headline Generator</h2>
      <p style={{ color: "#64748b", fontSize: "14px" }}>
        AI-assisted tool to write quick Tollywood-style catchy slogans and commercial scripts for local advertisers.
      </p>

      <div style={{ marginTop: "15px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Shop / Business Name & Offer:</label>
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="ఉదాహరణ: తిరుపతి లక్ష్మి జ్యువెలర్స్ - దసరా 20% డిస్కౌంట్ ఆఫర్"
          style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "10px" }}
        />
        <button onClick={generateScript} style={{ padding: "10px 20px", background: "#9333ea", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>Generate Ad Script</button>
      </div>

      {generatedAd && (
        <div style={{ marginTop: "20px", padding: "15px", background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "8px", whiteSpace: "pre-line", fontSize: "14px" }}>
          {generatedAd}
        </div>
      )}
    </div>
  );
}

/* ================= 14. REPORTS MODULE ================= */
function Reports({ data }) {
  const rows = useMemo(() => {
    const counts = {};
    for (const playback of data.playback) {
      const key = playback.adId || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([adId, plays]) => ({
      adId,
      name: data.ads.find(ad => ad.id === adId)?.name || adId,
      plays,
    }));
  }, [data]);

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2>📊 Live Ad Proof of Play Reports</h2>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "15px" }}>
        ప్రతి ప్రకటన రిమోట్ టీవీలలో ఎన్నిసార్లు ప్రసారమైందో ఖచ్చితమైన సమాచారం.
      </p>

      {rows.length === 0 ? (
        <div style={{ color: "#94a3b8" }}>ఇంకా playback reporting నమోదు కాలేదు. టీవీ ఆన్ చేసి యాడ్స్ ప్లే చేయగానే ఇక్కడ కనిపిస్తాయి.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "10px" }}>Advertisement</th>
              <th style={{ padding: "10px" }}>Total Play Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.adId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px", fontWeight: "600" }}>{row.name}</td>
                <td style={{ padding: "10px", color: "#2563eb", fontWeight: "bold" }}>{row.plays} times</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ================= 15. SETTINGS MODULE ================= */
function Settings({ reload }) {
  async function downloadBackup() {
    try {
      const backup = await api("/backup");
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "tv-ad-manager-backup.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
      <h2>⚙ Central Management System Settings</h2>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>
        Server Configuration, Cloud Tunnel Sync, and Database Backup.
      </p>

      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={downloadBackup} style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
          📥 Download Full Data Backup
        </button>
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
      <div style={{ background: "#fff", padding: "25px", borderRadius: "12px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto" }}>
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

/* ================= TV PLAYER MODE ================= */
function getPlayerScreenId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("player") || params.get("screen") || "";
}

function PlayerMode({ screenId }) {
  const [state, setState] = useState({ loading: true, error: "", screen: null, playlist: null, ads: [] });
  const [index, setIndex] = useState(0);

  async function loadPlayer() {
    if (!screenId) return;
    try {
      const result = await api(`/tv/${encodeURIComponent(screenId)}/player`);
      const ads = Array.isArray(result.ads) ? result.ads : Array.isArray(result.playlist?.ads) ? result.playlist.ads : [];
      setState({ loading: false, error: "", screen: result.screen || null, playlist: result.playlist || null, ads });
    } catch (err) {
      setState(curr => ({ ...curr, loading: false, error: err.message || "Failed to load TV ads." }));
    }
  }

  useEffect(() => {
    loadPlayer();
    const timer = setInterval(loadPlayer, 15000);
    return () => clearInterval(timer);
  }, [screenId]);

  if (state.loading) return <div style={{ background: "#000", color: "#fff", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Connecting to Tirupati Central Hub...</div>;
  if (!state.ads.length) return <div style={{ background: "#000", color: "#fff", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>No ads assigned to this TV screen yet.</div>;

  const ad = state.ads[index % state.ads.length];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <PlayerAd ad={ad} onFinished={() => setIndex(i => (i + 1) % state.ads.length)} />
    </div>
  );
}

function PlayerAd({ ad, onFinished }) {
  useEffect(() => {
    if (ad.fileType?.startsWith("video/")) return;
    const timer = setTimeout(onFinished, (ad.duration || 10) * 1000);
    return () => clearTimeout(timer);
  }, [ad, onFinished]);

  if (ad.fileType?.startsWith("video/")) {
    return <video src={mediaUrl(ad.fileUrl)} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} onEnded={onFinished} />;
  }
  return <img src={mediaUrl(ad.fileUrl)} alt={ad.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
}

export default function AppRoot() {
  const playerId = getPlayerScreenId();
  if (playerId) return <PlayerMode screenId={playerId} />;
  return <AdminApp />;
}
