import express from "express";
import cors from "cors";
import multer from "multer";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const JWT_SECRET = process.env.JWT_SECRET || "tv-ad-manager-pro-secret-2026";
const DEFAULT_ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASSWORD || "admin123";
const DEFAULT_RECOVERY_PIN = process.env.RECOVERY_PIN || "123456";

// Permanent Media Storage (Cloudinary)
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUD_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET || "";

// Permanent Database Storage (GitHub Auto-Sync OR Upstash Redis)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO = process.env.GITHUB_REPO || ""; // e.g., "telugufocustv/TV-ADS--ads-cloud"
const GITHUB_DB_PATH = process.env.GITHUB_DB_PATH || "cloud-backup/tv-database.json";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const PUBLIC_DIR = path.join(__dirname, "public");
const DIST_DIR = path.join(__dirname, "dist");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const COLLECTION_NAMES = [
  "areas",
  "screens",
  "ads",
  "playlists",
  "schedules",
  "devices",
  "playback",
  "franchises",
  "clients",
  "billings",
  "tickers",
  "socials",
  "users",
  "settings"
];

const defaults = {
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
  settings: [
    {
      id: "main_settings",
      recoveryPin: DEFAULT_RECOVERY_PIN,
      emergencyActive: false,
      emergencyText: "",
      emergencyBg: "#dc2626",
      tickerBg: "#b91c1c",
      tickerColor: "#ffffff",
      tickerSpeed: 22
    }
  ]
};

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readData(name) {
  const file = filePath(name);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaults[name] || [], null, 2), "utf8");
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return defaults[name] || [];
  }
}

let cloudSyncTimer = null;

function writeData(name, data, skipCloudPush = false) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf8");
  if (!skipCloudPush) {
    scheduleCloudBackup();
  }
}

function makeId(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(4).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function getISTTimeInfo() {
  const utcMs = Date.now();
  const istDate = new Date(utcMs + 330 * 60 * 1000);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = dayNames[istDate.getUTCDay()];
  const minutes = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
  return { today, minutes, istString: istDate.toISOString() };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hashHex] = String(stored || "").split(":");
    if (scheme !== "scrypt" || !salt || !hashHex) return false;
    const actual = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hashHex, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function ensureUsersInitialized() {
  let users = readData("users");
  if (!Array.isArray(users) || users.length === 0) {
    users = [
      {
        id: "user_admin_1",
        username: DEFAULT_ADMIN_USER,
        passwordHash: hashPassword(DEFAULT_ADMIN_PASS),
        role: "Super Admin",
        createdAt: now()
      }
    ];
    writeData("users", users, true);
  }
  return users;
}

function getSystemSettings() {
  let list = readData("settings");
  if (!Array.isArray(list) || list.length === 0) {
    list = defaults.settings;
    writeData("settings", list, true);
  }
  return list[0];
}

// ==================== PERMANENT CLOUD DB SYNC (NEVER LOSE DATA) ====================
function getFullSnapshot() {
  const snap = { savedAt: now() };
  for (const name of COLLECTION_NAMES) {
    snap[name] = readData(name);
  }
  return snap;
}

function applySnapshot(snap) {
  if (!snap || typeof snap !== "object") return false;
  for (const name of COLLECTION_NAMES) {
    if (Array.isArray(snap[name])) {
      writeData(name, snap[name], true);
    }
  }
  return true;
}

async function pushSnapshotToCloud() {
  const snapshot = getFullSnapshot();
  const jsonText = JSON.stringify(snapshot);

  // 1. Upstash Redis REST API
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      await fetch(`${UPSTASH_URL.replace(/\/+$/, "")}/set/tv_ad_manager_db`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: jsonText
      });
    } catch (e) {
      console.error("Upstash sync error:", e.message);
    }
  }

  // 2. GitHub Repository File Sync (Zero cost, permanent JSON storage)
  if (GITHUB_TOKEN && GITHUB_REPO) {
    try {
      const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_DB_PATH}`;
      let sha = undefined;
      const getResp = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "TV-Ad-Manager-Pro"
        }
      });
      if (getResp.ok) {
        const existing = await getResp.json();
        sha = existing.sha;
      }

      const contentBase64 = Buffer.from(jsonText, "utf8").toString("base64");
      await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "TV-Ad-Manager-Pro"
        },
        body: JSON.stringify({
          message: `Auto-sync TV Ad Manager DB (${new Date().toISOString()})`,
          content: contentBase64,
          ...(sha ? { sha } : {})
        })
      });
    } catch (e) {
      console.error("GitHub DB sync error:", e.message);
    }
  }
}

function scheduleCloudBackup() {
  if (!UPSTASH_URL && !GITHUB_TOKEN) return;
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    pushSnapshotToCloud();
  }, 2500);
}

async function restoreSnapshotFromCloudOnBoot() {
  // Try Upstash first
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const resp = await fetch(`${UPSTASH_URL.replace(/\/+$/, "")}/get/tv_ad_manager_db`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
      });
      if (resp.ok) {
        const body = await resp.json();
        if (body && body.result) {
          const parsed = typeof body.result === "string" ? JSON.parse(body.result) : body.result;
          if (applySnapshot(parsed)) {
            console.log("Restored permanent DB from Upstash Redis.");
            return;
          }
        }
      }
    } catch (e) {
      console.error("Upstash boot restore failed:", e.message);
    }
  }

  // Try GitHub DB Backup
  if (GITHUB_TOKEN && GITHUB_REPO) {
    try {
      const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_DB_PATH}`;
      const resp = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "TV-Ad-Manager-Pro"
        }
      });
      if (resp.ok) {
        const fileData = await resp.json();
        if (fileData && fileData.content) {
          const decoded = Buffer.from(fileData.content, "base64").toString("utf8");
          const parsed = JSON.parse(decoded);
          if (applySnapshot(parsed)) {
            console.log("Restored permanent DB from GitHub Cloud Backup.");
          }
        }
      }
    } catch (e) {
      console.error("GitHub boot restore failed:", e.message);
    }
  }
}

function syncAllRelations() {
  const areas = readData("areas");
  const screens = readData("screens");
  const ads = readData("ads");
  const playlists = readData("playlists");
  const schedules = readData("schedules");

  const validAdIds = new Set(ads.map(a => String(a.id)));
  const validPlaylistIds = new Set(playlists.map(p => String(p.id)));
  const validScreenIds = new Set(screens.map(s => String(s.id)));
  const validAreaIds = new Set(areas.map(a => String(a.id)));

  const syncedPlaylists = playlists.map(pl => ({
    ...pl,
    adIds: (pl.adIds || []).filter(id => validAdIds.has(String(id)))
  }));
  writeData("playlists", syncedPlaylists, true);

  const syncedScreens = screens.map((sc, idx) => ({
    ...sc,
    shortCode: sc.shortCode || String(idx + 1),
    group: sc.group || "General",
    orientation: sc.orientation || "0",
    fitMode: sc.fitMode || "contain",
    areaId: sc.areaId && validAreaIds.has(String(sc.areaId)) ? sc.areaId : "",
    playlistId: sc.playlistId && validPlaylistIds.has(String(sc.playlistId)) ? sc.playlistId : null
  }));
  writeData("screens", syncedScreens, true);

  const syncedSchedules = schedules.filter(
    sch => validScreenIds.has(String(sch.screenId)) && validPlaylistIds.has(String(sch.playlistId))
  );
  writeData("schedules", syncedSchedules, true);
}

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "Origin"]
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(PUBLIC_DIR));
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Login required" });
  }
  try {
    req.user = jwt.verify(header.substring(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "TV AD MANAGER PRO",
    cloudMedia: Boolean(CLOUD_NAME && CLOUD_KEY && CLOUD_SECRET),
    cloudDatabase: Boolean((GITHUB_TOKEN && GITHUB_REPO) || (UPSTASH_URL && UPSTASH_TOKEN)),
    istTime: getISTTimeInfo(),
    time: now()
  });
});

// ==================== LOGIN, CUSTOM CREDENTIALS & FORGOT PASSWORD ====================
app.post("/api/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const users = ensureUsersInitialized();

  const found = users.find(
    u => u.username.toLowerCase() === username.toLowerCase() && verifyPassword(password, u.passwordHash)
  );

  if (!found) {
    return res.status(401).json({ error: "యూజర్‌నేమ్ లేదా పాస్‌వర్డ్ తప్పుగా ఉంది." });
  }

  const token = jwt.sign(
    { id: found.id, role: found.role || "admin", username: found.username },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
  res.json({ token, username: found.username, role: found.role });
});

app.post("/api/forgot-password", (req, res) => {
  const recoveryPin = String(req.body?.recoveryPin || "").trim();
  const newUsername = String(req.body?.newUsername || "").trim();
  const newPassword = String(req.body?.newPassword || "").trim();

  if (!recoveryPin || !newUsername || !newPassword) {
    return res.status(400).json({ error: "Recovery PIN, కొత్త Username మరియు కొత్త Password అన్నీ ఇవ్వండి." });
  }

  const sys = getSystemSettings();
  const validPin = String(sys.recoveryPin || DEFAULT_RECOVERY_PIN);

  if (recoveryPin !== validPin && recoveryPin !== DEFAULT_RECOVERY_PIN) {
    return res.status(403).json({ error: "Recovery PIN తప్పుగా ఉంది!" });
  }

  const users = ensureUsersInitialized();
  users[0] = {
    ...users[0],
    username: newUsername,
    passwordHash: hashPassword(newPassword),
    updatedAt: now()
  };
  writeData("users", users);

  const token = jwt.sign(
    { id: users[0].id, role: users[0].role, username: users[0].username },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
  res.json({ ok: true, token, username: users[0].username });
});

app.post("/api/users/add", auth, (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "").trim();
  const role = String(req.body?.role || "Manager").trim();

  if (!username || !password) return res.status(400).json({ error: "Username & Password required" });
  const users = ensureUsersInitialized();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: "ఈ Username ఇప్పటికే ఉంది." });
  }

  users.push({
    id: makeId("usr"),
    username,
    passwordHash: hashPassword(password),
    role,
    createdAt: now()
  });
  writeData("users", users);
  res.json(users.map(({ passwordHash, ...safe }) => safe));
});

app.put("/api/users/:id", auth, (req, res) => {
  const users = ensureUsersInitialized();
  const idx = users.findIndex(u => String(u.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "User not found" });

  const { username, password, role } = req.body || {};
  if (username && username.trim()) users[idx].username = username.trim();
  if (password && password.trim()) users[idx].passwordHash = hashPassword(password.trim());
  if (role && role.trim()) users[idx].role = role.trim();
  users[idx].updatedAt = now();

  writeData("users", users);
  res.json(users.map(({ passwordHash, ...safe }) => safe));
});

app.delete("/api/users/:id", auth, (req, res) => {
  const users = ensureUsersInitialized();
  if (users.length <= 1) {
    return res.status(400).json({ error: "కనీసం ఒక Admin యూజర్ తప్పనిసరిగా ఉండాలి." });
  }
  const next = users.filter(u => String(u.id) !== String(req.params.id));
  writeData("users", next);
  res.json(next.map(({ passwordHash, ...safe }) => safe));
});

app.get("/api/state", auth, (req, res) => {
  syncAllRelations();
  const users = ensureUsersInitialized().map(({ passwordHash, ...safe }) => safe);
  res.json({
    areas: readData("areas"),
    screens: readData("screens"),
    ads: readData("ads"),
    playlists: readData("playlists"),
    schedules: readData("schedules"),
    devices: readData("devices"),
    playback: readData("playback").slice(-15000),
    franchises: readData("franchises"),
    clients: readData("clients"),
    billings: readData("billings"),
    tickers: readData("tickers"),
    socials: readData("socials"),
    users,
    systemSettings: getSystemSettings(),
    cloudEnabled: Boolean(CLOUD_NAME && CLOUD_KEY && CLOUD_SECRET),
    dbPersistent: Boolean((GITHUB_TOKEN && GITHUB_REPO) || (UPSTASH_URL && UPSTASH_TOKEN))
  });
});

app.put("/api/system-settings", auth, (req, res) => {
  const current = getSystemSettings();
  const updated = { ...current, ...(req.body || {}), id: "main_settings", updatedAt: now() };
  writeData("settings", [updated]);
  res.json(updated);
});

for (const name of ["areas", "screens", "ads", "playlists", "schedules", "franchises", "clients", "billings", "tickers", "socials"]) {
  app.put(`/api/${name}`, auth, (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: "Array expected" });
    }
    writeData(name, req.body);
    syncAllRelations();
    scheduleCloudBackup();
    res.json(readData(name));
  });
}

// Broadcast to ALL TVs or a specific Group of TVs
app.post("/api/broadcast-all", auth, (req, res) => {
  const { playlistId, adId, group } = req.body || {};
  const screens = readData("screens");
  const playlists = readData("playlists");
  const ads = readData("ads");

  let targetPlaylistId = playlistId || null;

  if (!targetPlaylistId && adId) {
    const ad = ads.find(a => String(a.id) === String(adId));
    if (!ad) return res.status(404).json({ error: "Ad not found" });

    const newPl = {
      id: makeId("pl_all"),
      name: `Live Broadcast: ${ad.name}`,
      adIds: [ad.id],
      createdAt: now()
    };
    playlists.push(newPl);
    writeData("playlists", playlists);
    targetPlaylistId = newPl.id;
  }

  if (!targetPlaylistId) {
    return res.status(400).json({ error: "playlistId or adId required" });
  }

  let updatedCount = 0;
  const updatedScreens = screens.map(sc => {
    if (!group || group === "ALL" || sc.group === group) {
      updatedCount++;
      return { ...sc, playlistId: targetPlaylistId };
    }
    return sc;
  });

  writeData("screens", updatedScreens);
  res.json({ ok: true, count: updatedCount, playlistId: targetPlaylistId });
});

// Remote Reload Command (PosterBooking style screen reboot/refresh)
app.post("/api/screens/:id/reload", auth, (req, res) => {
  const screens = readData("screens");
  const updated = screens.map(sc =>
    String(sc.id) === String(req.params.id) ? { ...sc, reloadToken: Date.now() } : sc
  );
  writeData("screens", updated);
  res.json({ ok: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith("video/") || file.mimetype.startsWith("image/");
    cb(null, ok);
  }
});

async function uploadToCloudinary(localFilePath, mimeType) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "tv_ad_manager_pro";
  const signString = `folder=${folder}&timestamp=${timestamp}${CLOUD_SECRET}`;
  const signature = crypto.createHash("sha1").update(signString).digest("hex");

  const resourceType = mimeType.startsWith("video/") ? "video" : "image";
  const fileBuffer = fs.readFileSync(localFilePath);
  const blob = new Blob([fileBuffer], { type: mimeType });

  const form = new FormData();
  form.append("file", blob, path.basename(localFilePath));
  form.append("api_key", CLOUD_KEY);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
    method: "POST",
    body: form
  });
  const data = await resp.json();
  if (!resp.ok || !data.secure_url) {
    throw new Error(data?.error?.message || "Cloudinary upload failed");
  }
  return { url: data.secure_url, publicId: data.public_id };
}

app.post("/api/upload", auth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Please select a valid video or image file" });
  }

  try {
    if (CLOUD_NAME && CLOUD_KEY && CLOUD_SECRET) {
      const cloud = await uploadToCloudinary(req.file.path, req.file.mimetype);
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.json({
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        fileKey: cloud.publicId,
        fileUrl: cloud.url,
        permanent: true
      });
    }

    res.json({
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      fileKey: req.file.filename,
      fileUrl: `/uploads/${req.file.filename}`,
      permanent: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Upload error" });
  }
});

app.delete("/api/upload/:key", auth, (req, res) => {
  const safe = path.basename(req.params.key);
  const file = path.join(UPLOAD_DIR, safe);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

app.post("/api/device/register", (req, res) => {
  const deviceId = req.body?.deviceId;
  const deviceName = req.body?.deviceName || "TV Player";
  if (!deviceId) return res.status(400).json({ error: "deviceId required" });

  const devices = readData("devices");
  let device = devices.find(d => String(d.deviceId) === String(deviceId));

  if (!device) {
    device = {
      id: makeId("dev"),
      deviceId,
      deviceName,
      pairCode: String(Math.floor(100000 + Math.random() * 900000)),
      status: "pending",
      screenId: null,
      createdAt: now(),
      lastSeen: now()
    };
    devices.push(device);
  } else {
    device.lastSeen = now();
  }

  writeData("devices", devices);
  res.json({
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    paired: device.status === "paired",
    pairCode: device.pairCode,
    screenId: device.screenId
  });
});

function resolveScreenAndPlaylist(screenIdentifier) {
  const screens = readData("screens");
  const screen = screens.find(
    s =>
      String(s.id) === String(screenIdentifier) ||
      String(s.shortCode) === String(screenIdentifier) ||
      String(s.name).toLowerCase() === String(screenIdentifier).toLowerCase()
  );
  if (!screen) return null;

  const ads = readData("ads");
  const playlists = readData("playlists");
  const schedules = readData("schedules");
  const { today, minutes } = getISTTimeInfo();

  let playlistId = screen.playlistId || null;
  let activeSchedule = null;

  const screenSchedules = schedules.filter(
    s => s.active !== false && String(s.screenId) === String(screen.id)
  );

  for (const schedule of screenSchedules) {
    const scheduleDays = Array.isArray(schedule.days) ? schedule.days : [];
    const start = Number(schedule.start || 0);
    const end = Number(schedule.end || 1440);
    const timeOK = start <= end
      ? minutes >= start && minutes < end
      : minutes >= start || minutes < end;
    const dayOK = scheduleDays.length === 0 || scheduleDays.includes(today);
    if (timeOK && dayOK) {
      playlistId = schedule.playlistId;
      activeSchedule = schedule;
    }
  }

  const playlist = playlists.find(p => String(p.id) === String(playlistId));
  const playerAds = (playlist?.adIds || [])
    .map(id => ads.find(ad => String(ad.id) === String(id)))
    .filter(ad => ad && (ad.fileUrl || ad.fileKey));

  screen.status = "online";
  screen.lastSeen = now();
  writeData("screens", screens, true);

  const activeTickers = readData("tickers").filter(t => t.active !== false);
  const sys = getSystemSettings();

  return {
    screen,
    playlist: playlist ? { ...playlist, ads: playerAds } : null,
    ads: playerAds,
    activeSchedule,
    tickers: activeTickers,
    systemSettings: {
      emergencyActive: Boolean(sys.emergencyActive),
      emergencyText: sys.emergencyText || "",
      emergencyBg: sys.emergencyBg || "#dc2626",
      tickerBg: sys.tickerBg || "#b91c1c",
      tickerColor: sys.tickerColor || "#ffffff",
      tickerSpeed: Number(sys.tickerSpeed) || 22
    }
  };
}

app.get("/api/device/:deviceId/config", (req, res) => {
  const devices = readData("devices");
  const device = devices.find(d => String(d.deviceId) === String(req.params.deviceId));
  if (!device) return res.status(404).json({ paired: false });

  device.lastSeen = now();
  writeData("devices", devices, true);

  if (device.status !== "paired" || !device.screenId) {
    return res.json({ paired: false, pairCode: device.pairCode, deviceName: device.deviceName });
  }

  const resolved = resolveScreenAndPlaylist(device.screenId);
  if (!resolved) return res.status(404).json({ paired: false, error: "Screen not found" });

  res.json({
    paired: true,
    ...resolved,
    serverTime: now(),
    heartbeatInterval: 10000
  });
});

app.get("/api/pair/pending", auth, (req, res) => {
  res.json(readData("devices").filter(d => d.status === "pending"));
});

app.post("/api/pair/approve", auth, (req, res) => {
  const pairCode = String(req.body?.pairCode || "");
  const name = req.body?.name || "TV Screen";
  const areaId = req.body?.areaId || "";

  const devices = readData("devices");
  const device = devices.find(d => String(d.pairCode) === pairCode && d.status === "pending");
  if (!device) return res.status(404).json({ error: "Pairing code not found" });

  const screens = readData("screens");
  const screen = {
    id: makeId("tv"),
    shortCode: String(screens.length + 1),
    group: "General",
    orientation: "0",
    fitMode: "contain",
    name,
    areaId,
    deviceId: device.deviceId,
    status: "online",
    lastSeen: now(),
    playlistId: null,
    createdAt: now()
  };

  screens.push(screen);
  writeData("screens", screens);

  device.status = "paired";
  device.screenId = screen.id;
  device.lastSeen = now();
  writeData("devices", devices);

  res.json(screen);
});

app.get("/api/tv/:id/player", (req, res) => {
  const resolved = resolveScreenAndPlaylist(req.params.id);
  if (!resolved) {
    return res.status(404).json({ error: "TV Screen not found", screenId: req.params.id });
  }
  res.json({
    ok: true,
    ...resolved,
    serverTime: now(),
    heartbeatInterval: 10000
  });
});

app.post("/api/tv/:id/playback", (req, res) => {
  const screens = readData("screens");
  const areas = readData("areas");
  const screen = screens.find(
    s => String(s.id) === String(req.params.id) || String(s.shortCode) === String(req.params.id)
  );
  if (!screen) return res.status(404).json({ error: "TV Screen not found" });

  const area = areas.find(a => String(a.id) === String(screen.areaId));
  const playback = readData("playback");
  const report = {
    id: makeId("play"),
    createdAt: now(),
    screenId: screen.id,
    screenName: screen.name,
    areaName: area ? area.name : "Remote",
    ...req.body
  };
  playback.push(report);
  writeData("playback", playback.slice(-50000));

  screen.status = "online";
  screen.lastSeen = report.createdAt;
  writeData("screens", screens, true);
  res.json(report);
});

app.get("/api/backup", auth, (req, res) => {
  res.json({
    version: "3.0.0",
    ...getFullSnapshot()
  });
});

app.post("/api/restore", auth, (req, res) => {
  applySnapshot(req.body || {});
  syncAllRelations();
  scheduleCloudBackup();
  res.json({ ok: true });
});

app.post("/api/sync-cloud-now", auth, async (req, res) => {
  await pushSnapshotToCloud();
  res.json({ ok: true, time: now() });
});

app.get("/player", (req, res) => {
  const file = path.join(PUBLIC_DIR, "player.html");
  if (!fs.existsSync(file)) return res.status(404).send("player.html not found");
  res.sendFile(file);
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found", path: req.originalUrl });
});

app.use((req, res) => {
  const indexFile = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  res.status(404).send("Frontend build (dist/index.html) not found.");
});

app.use((error, req, res, next) => {
  console.error("SERVER ERROR:", error);
  res.status(500).json({ error: error.message || "Internal server error" });
});

// Boot sequence: Restore permanent DB first, then start listening
restoreSnapshotFromCloudOnBoot().finally(() => {
  ensureUsersInitialized();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TV AD MANAGER PRO v3.0 running on port ${PORT}`);
  });
});
