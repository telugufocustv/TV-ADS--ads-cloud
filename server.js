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
  playback: []
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
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
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

function writeAuth(authData) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), "utf8");
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
  res.json({ ok: true, service: "TV AD MANAGER PRO", version: "2.0.0", time: now() });
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

app.post("/api/change-password", auth, (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  const username = String(req.body?.username || "").trim();
  const authData = readAuth();

  if (!verifyPassword(currentPassword, authData.passwordHash)) {
    return res.status(400).json({ error: "Current password is incorrect" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }
  if (username && username.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }

  const next = {
    username: username || authData.username,
    passwordHash: hashPassword(newPassword),
    updatedAt: now()
  };
  writeAuth(next);
  res.json({ ok: true, username: next.username });
});

app.get("/api/state", auth, (req, res) => {
  res.json({
    areas: readData("areas"),
    screens: readData("screens"),
    ads: readData("ads"),
    playlists: readData("playlists"),
    schedules: readData("schedules"),
    devices: readData("devices"),
    playback: readData("playback").slice(-5000)
  });
});

for (const name of ["areas", "screens", "ads", "playlists", "schedules"]) {
  app.put(`/api/${name}`, auth, (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: "Array expected" });
    }
    writeData(name, req.body);
    res.json(req.body);
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext}`);
  }
});

const allowedTypes = ["video/mp4", "video/webm", "image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, allowedTypes.includes(file.mimetype))
});

app.post("/api/upload", auth, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "MP4, WebM, JPG, PNG, WebP files only" });
  }
  res.json({
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    fileKey: req.file.filename,
    fileUrl: `/uploads/${req.file.filename}`
  });
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

app.get("/api/device/:deviceId/config", (req, res) => {
  const devices = readData("devices");
  const device = devices.find(d => String(d.deviceId) === String(req.params.deviceId));
  if (!device) return res.status(404).json({ paired: false });

  device.lastSeen = now();
  writeData("devices", devices);

  if (device.status !== "paired" || !device.screenId) {
    return res.json({ paired: false, pairCode: device.pairCode, deviceName: device.deviceName });
  }

  const screens = readData("screens");
  const ads = readData("ads");
  const playlists = readData("playlists");
  const schedules = readData("schedules");

  const screen = screens.find(s => String(s.id) === String(device.screenId));
  if (!screen) return res.status(404).json({ paired: false, error: "Screen not found" });

  screen.status = "online";
  screen.lastSeen = now();
  writeData("screens", screens);

  let playlistId = screen.playlistId || null;
  const date = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = dayNames[date.getDay()];
  const minutes = date.getHours() * 60 + date.getMinutes();

  const activeSchedules = schedules.filter(s => s.active && String(s.screenId) === String(screen.id));
  for (const schedule of activeSchedules) {
    const scheduleDays = Array.isArray(schedule.days) ? schedule.days : [];
    const start = Number(schedule.start || 0);
    const end = Number(schedule.end || 1440);
    const timeOK = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    const dayOK = scheduleDays.length === 0 || scheduleDays.includes(today);
    if (timeOK && dayOK) playlistId = schedule.playlistId;
  }

  const playlist = playlists.find(p => String(p.id) === String(playlistId));
  const playlistAds = (playlist?.adIds || [])
    .map(id => ads.find(ad => String(ad.id) === String(id)))
    .filter(Boolean);

  res.json({
    paired: true,
    screen,
    playlist: playlist ? { ...playlist, ads: playlistAds } : null,
    ads: playlistAds,
    serverTime: now(),
    heartbeatInterval: 15000
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
  const screenId = req.params.id;
  const screens = readData("screens");
  const screen = screens.find(s => String(s.id) === String(screenId));
  if (!screen) return res.status(404).json({ error: "TV Screen not found", screenId });

  const ads = readData("ads");
  const playlists = readData("playlists");
  const schedules = readData("schedules");

  let playlistId = screen.playlistId || null;
  const date = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = days[date.getDay()];
  const minutes = date.getHours() * 60 + date.getMinutes();

  const screenSchedules = schedules.filter(s => s.active && String(s.screenId) === String(screenId));
  for (const schedule of screenSchedules) {
    const scheduleDays = Array.isArray(schedule.days) ? schedule.days : [];
    const start = Number(schedule.start || 0);
    const end = Number(schedule.end || 1440);
    const timeOK = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    const dayOK = scheduleDays.length === 0 || scheduleDays.includes(today);
    if (timeOK && dayOK) playlistId = schedule.playlistId;
  }

  const playlist = playlists.find(p => String(p.id) === String(playlistId));
  const playerAds = (playlist?.adIds || [])
    .map(id => ads.find(ad => String(ad.id) === String(id)))
    .filter(ad => ad && (ad.fileUrl || ad.fileKey));

  screen.status = "online";
  screen.lastSeen = now();
  writeData("screens", screens);

  res.json({
    ok: true,
    screen,
    playlist: playlist ? { ...playlist, ads: playerAds } : null,
    ads: playerAds,
    serverTime: now(),
    heartbeatInterval: 15000
  });
});

app.post("/api/tv/:id/heartbeat", (req, res) => {
  const screens = readData("screens");
  const screen = screens.find(s => String(s.id) === String(req.params.id));
  if (!screen) return res.status(404).json({ error: "TV Screen not found" });

  screen.status = "online";
  screen.lastSeen = now();
  writeData("screens", screens);
  res.json({ ok: true, lastSeen: screen.lastSeen });
});

app.post("/api/tv/:id/playback", (req, res) => {
  const screens = readData("screens");
  const screen = screens.find(s => String(s.id) === String(req.params.id));
  if (!screen) return res.status(404).json({ error: "TV Screen not found" });

  const playback = readData("playback");
  const report = { id: makeId("play"), createdAt: now(), screenId: screen.id, ...req.body };
  playback.push(report);
  writeData("playback", playback.slice(-20000));

  screen.status = "online";
  screen.lastSeen = report.createdAt;
  writeData("screens", screens);
  res.json(report);
});

app.get("/api/backup", auth, (req, res) => {
  res.json({
    version: "2.0.0",
    createdAt: now(),
    areas: readData("areas"),
    screens: readData("screens"),
    ads: readData("ads"),
    playlists: readData("playlists"),
    schedules: readData("schedules")
  });
});

app.post("/api/restore", auth, (req, res) => {
  const backup = req.body || {};
  for (const name of ["areas", "screens", "ads", "playlists", "schedules"]) {
    if (Array.isArray(backup[name])) writeData(name, backup[name]);
  }
  res.json({ ok: true });
});

app.post("/api/clear", auth, (req, res) => {
  for (const name of ["areas", "screens", "ads", "playlists", "schedules", "playback"]) {
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
