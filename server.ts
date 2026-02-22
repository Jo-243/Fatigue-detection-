import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("wellbeing.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    role TEXT, -- 'student' or 'it_worker'
    daily_limit_minutes INTEGER DEFAULT 360
  );

  CREATE TABLE IF NOT EXISTS guardians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    app_name TEXT,
    duration_seconds INTEGER
  );

  CREATE TABLE IF NOT EXISTS fatigue_assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    fatigue_score INTEGER,
    recommendation TEXT
  );

  CREATE TABLE IF NOT EXISTS routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT,
    activity TEXT,
    completed INTEGER DEFAULT 0
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/user", (req, res) => {
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    res.json(user || { name: "Guest", role: "it_worker", daily_limit_minutes: 360 });
  });

  app.post("/api/user", (req, res) => {
    const { name, role, daily_limit_minutes } = req.body;
    db.prepare("DELETE FROM users").run();
    db.prepare("INSERT INTO users (name, role, daily_limit_minutes) VALUES (?, ?, ?)").run(name, role, daily_limit_minutes);
    res.json({ success: true });
  });

  app.get("/api/guardians", (req, res) => {
    const guardians = db.prepare("SELECT * FROM guardians").all();
    res.json(guardians);
  });

  app.post("/api/guardians", (req, res) => {
    const { name, phone, email } = req.body;
    db.prepare("INSERT INTO guardians (name, phone, email) VALUES (?, ?, ?)").run(name, phone, email);
    res.json({ success: true });
  });

  app.get("/api/usage", (req, res) => {
    const logs = db.prepare("SELECT * FROM usage_logs ORDER BY timestamp DESC LIMIT 100").all();
    res.json(logs);
  });

  app.post("/api/usage", (req, res) => {
    const { app_name, duration_seconds } = req.body;
    db.prepare("INSERT INTO usage_logs (app_name, duration_seconds) VALUES (?, ?)").run(app_name, duration_seconds);
    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const totalToday = db.prepare("SELECT SUM(duration_seconds) as total FROM usage_logs WHERE timestamp >= date('now')").get();
    res.json({ total_seconds: totalToday.total || 0 });
  });

  app.get("/api/routines", (req, res) => {
    const routines = db.prepare("SELECT * FROM routines ORDER BY time ASC").all();
    res.json(routines);
  });

  app.post("/api/routines", (req, res) => {
    const { time, activity } = req.body;
    db.prepare("INSERT INTO routines (time, activity) VALUES (?, ?)").run(time, activity);
    res.json({ success: true });
  });

  app.delete("/api/routines/:id", (req, res) => {
    db.prepare("DELETE FROM routines WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.patch("/api/routines/:id", (req, res) => {
    const { completed } = req.body;
    db.prepare("UPDATE routines SET completed = ? WHERE id = ?").run(completed ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
