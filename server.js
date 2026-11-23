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

const JWT_SECRET = process.env.JWT_SECRET || "tv-ad-manager-pro-secret";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUD_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET || "";

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const PUBLIC_DIR = path.join(__dirname, "public");
const DIST_DIR = path.join(__dirname, "dist");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

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
  socials: []
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

function writeData(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf8");
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

function readAuth() {
  if (!fs.existsSync(AUTH_FILE)) {
    const initial = {
      username: process.env.ADMIN_USERNAME || "admin",
      passwordHash: hashPassword(ADMIN_PASSWORD),
      updatedAt: now()
    };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  try {
    const value = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    if (value && value.passwordHash) return value;
  } catch {}
  const fallback = {
    username: process.env.ADMIN_USERNAME || "admin",
    passwordHash: hashPassword(ADMIN_PASSWORD),
    updatedAt: now()
  };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(fallback, null, 2), "utf8");
  return fallback;
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
  writeData("playlists", syncedPlaylists);

  const syncedScreens = screens.map((sc, idx) => ({
    ...sc,
    shortCode: sc.shortCode || String(idx + 1),
    areaId: sc.areaId && validAreaIds.has(String(sc.areaId)) ? sc.areaId : "",
    playlistId: sc.playlistId && validPlaylistIds.has(String(sc.playlistId)) ? sc.playlistId : null
  }));
  writeData("screens", syncedScreens);

  const syncedSchedules = schedules.filter(
    sch => validScreenIds.has(String(sch.screenId)) && validPlaylistIds.has(String(sch.playlistId))
  );
  writeData("schedules", syncedSchedules);
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
    cloudStorage: Boolean(CLOUD_NAME && CLOUD_KEY && CLOUD_SECRET),
    istTime: getISTTimeInfo(),
    time: now()
  });
});

app.post("/api/login", (req, res) => {
  const username = String(req.body?.username || "admin");
  const password = String(req.body?.password || "");
  const authData = readAuth();

  if (username !== authData.username || !verifyPassword(password, authData.passwordHash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = jwt.sign({ role: "admin", username: authData.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, username: authData.username });
});

app.get("/api/state", auth, (req, res) => {
  syncAllRelations();
  res.json({
    areas: readData("areas"),
    screens: readData("screens"),
    ads: readData("ads"),
    playlists: readData("playlists"),
    schedules: readData("schedules"),
    devices: readData("devices"),
    playback: readData("playback").slice(-10000),
    franchises: readData("franchises"),
    clients: readData("clients"),
    billings: readData("billings"),
    tickers: readData("tickers"),
    socials: readData("socials"),
    cloudEnabled: Boolean(CLOUD_NAME && CLOUD_KEY && CLOUD_SECRET)
  });
});

for (const name of ["areas", "screens", "ads", "playlists", "schedules", "franchises", "clients", "billings", "tickers", "socials"]) {
  app.put(`/api/${name}`, auth, (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: "Array expected" });
    }
    writeData(name, req.body);
    syncAllRelations();
    res.json(readData(name));
  });
}

// Broadcast one ad or one playlist to ALL 100+ TVs simultaneously
app.post("/api/broadcast-all", auth, (req, res) => {
  const { playlistId, adId } = req.body || {};
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

  const updatedScreens = screens.map(sc => ({
    ...sc,
    playlistId: targetPlaylistId
  }));
  writeData("screens", updatedScreens);
  res.json({ ok: true, count: updatedScreens.length, playlistId: targetPlaylistId });
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
  writeData("screens", screens);

  const activeTickers = readData("tickers").filter(t => t.active !== false);

  return {
    screen,
    playlist: playlist ? { ...playlist, ads: playerAds } : null,
    ads: playerAds,
    activeSchedule,
    tickers: activeTickers
  };
}

app.get("/api/device/:deviceId/config", (req, res) => {
  const devices = readData("devices");
  const device = devices.find(d => String(d.deviceId) === String(req.params.deviceId));
  if (!device) return res.status(404).json({ paired: false });

  device.lastSeen = now();
  writeData("devices", devices);

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

app.post("/api/device/:deviceId/heartbeat", (req, res) => {
  const devices = readData("devices");
  const device = devices.find(d => String(d.deviceId) === String(req.params.deviceId));
  if (!device) return res.status(404).json({ error: "Device not registered" });

  device.lastSeen = now();
  writeData("devices", devices);

  if (device.screenId) {
    const screens = readData("screens");
    const screen = screens.find(s => String(s.id) === String(device.screenId));
    if (screen) {
      screen.status = "online";
      screen.lastSeen = device.lastSeen;
      writeData("screens", screens);
    }
  }
  res.json({ ok: true, lastSeen: device.lastSeen });
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

app.post("/api/tv/:id/heartbeat", (req, res) => {
  const screens = readData("screens");
  const screen = screens.find(
    s => String(s.id) === String(req.params.id) || String(s.shortCode) === String(req.params.id)
  );
  if (!screen) return res.status(404).json({ error: "TV Screen not found" });

  screen.status = "online";
  screen.lastSeen = now();
  writeData("screens", screens);
  res.json({ ok: true, lastSeen: screen.lastSeen });
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
  writeData("screens", screens);
  res.json(report);
});

app.get("/api/backup", auth, (req, res) => {
  res.json({
    version: "2.3.0",
    createdAt: now(),
    areas: readData("areas"),
    screens: readData("screens"),
    ads: readData("ads"),
    playlists: readData("playlists"),
    schedules: readData("schedules"),
    franchises: readData("franchises"),
    clients: readData("clients"),
    billings: readData("billings"),
    tickers: readData("tickers"),
    socials: readData("socials")
  });
});

app.post("/api/restore", auth, (req, res) => {
  const backup = req.body || {};
  for (const name of ["areas", "screens", "ads", "playlists", "schedules", "franchises", "clients", "billings", "tickers", "socials"]) {
    if (Array.isArray(backup[name])) writeData(name, backup[name]);
  }
  syncAllRelations();
  res.json({ ok: true });
});

app.post("/api/clear", auth, (req, res) => {
  for (const name of ["areas", "screens", "ads", "playlists", "schedules", "playback", "franchises", "clients", "billings", "tickers", "socials"]) {
    writeData(name, []);
  }
  res.json({ ok: true });
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TV AD MANAGER PRO running on port ${PORT}`);
});
