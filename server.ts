import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("justo.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS acts (
    id TEXT PRIMARY KEY,
    title TEXT,
    type TEXT,
    court TEXT,
    chamber TEXT,
    caseNumber TEXT,
    parties TEXT,
    date TEXT,
    lawyer TEXT,
    summary TEXT,
    originalTextSnippet TEXT,
    isFulfilled INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    lawyerName TEXT,
    actsCount INTEGER,
    data TEXT, -- JSON string
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Ensure chamber column exists in existing database
try {
  db.exec("ALTER TABLE acts ADD COLUMN chamber TEXT");
} catch (e) {
  // Column already exists
}

// Supabase sync (optional)
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes for Acts
  app.get("/api/acts", (req, res) => {
    const acts = db.prepare("SELECT * FROM acts ORDER BY createdAt DESC").all();
    res.json(acts.map((act: any) => ({ ...act, isFulfilled: !!act.isFulfilled })));
  });

  app.post("/api/acts", async (req, res) => {
    const acts = req.body;
    const insert = db.prepare(`
      INSERT OR REPLACE INTO acts (id, title, type, court, chamber, caseNumber, parties, date, lawyer, summary, originalTextSnippet, isFulfilled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((data) => {
      for (const act of data) {
        insert.run(
          act.id,
          act.title,
          act.type,
          act.court,
          act.chamber,
          act.caseNumber,
          act.parties,
          act.date,
          act.lawyer,
          act.summary,
          act.originalTextSnippet,
          act.isFulfilled ? 1 : 0
        );
      }
    });

    transaction(acts);

    // Sync to Supabase if available
    if (supabase) {
      try {
        await supabase.from('acts').upsert(acts.map((a: any) => ({
          ...a,
          isFulfilled: !!a.isFulfilled,
          createdAt: a.createdAt || new Date().toISOString()
        })));
      } catch (e) {
        console.error("Supabase sync error (acts):", e);
      }
    }

    res.json({ success: true });
  });

  // API Routes for Reports
  app.get("/api/reports", (req, res) => {
    const reports = db.prepare("SELECT * FROM reports ORDER BY createdAt DESC").all();
    res.json(reports.map((r: any) => ({ ...r, data: JSON.parse(r.data) })));
  });

  app.post("/api/reports", async (req, res) => {
    const { id, lawyerName, actsCount, data } = req.body;
    db.prepare(`
      INSERT INTO reports (id, lawyerName, actsCount, data)
      VALUES (?, ?, ?, ?)
    `).run(id, lawyerName, actsCount, JSON.stringify(data));

    // Sync to Supabase if available
    if (supabase) {
      try {
        await supabase.from('reports').insert([{
          id,
          lawyerName,
          actsCount,
          data
        }]);
      } catch (e) {
        console.error("Supabase sync error (reports):", e);
      }
    }

    res.json({ success: true });
  });

  app.patch("/api/acts/:id", (req, res) => {
    const { id } = req.params;
    const { isFulfilled } = req.body;
    db.prepare("UPDATE acts SET isFulfilled = ? WHERE id = ?").run(isFulfilled ? 1 : 0, id);
    res.json({ success: true });
  });

  app.delete("/api/acts/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM acts WHERE id = ?").run(id);
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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
