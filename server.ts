import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURACIÓN DE BASE DE DATOS (SQLite) ---
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
const dbPath = path.join(dataDir, "bajotierra.sqlite");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    cantidad_personas INTEGER NOT NULL,
    sala TEXT NOT NULL,
    estado TEXT DEFAULT 'pendiente',
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
// -----------------------------------------------

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware to parse JSON bodies (increased limit for base64 images)
  app.use(express.json({ limit: "50mb" }));

  // API Routes for Reservations
  app.get("/api/reservas", (req, res) => {
    try {
      const stmt = db.prepare("SELECT * FROM reservas ORDER BY fecha, hora");
      const reservas = stmt.all();
      res.json(reservas);
    } catch (error) {
      console.error("Error fetching reservas:", error);
      res.status(500).json({ error: "Error al obtener reservas" });
    }
  });

  app.post("/api/reservas", (req, res) => {
    try {
      const { nombre, telefono, fecha, hora, cantidad_personas, sala } = req.body;
      const stmt = db.prepare(
        "INSERT INTO reservas (nombre, telefono, fecha, hora, cantidad_personas, sala) VALUES (?, ?, ?, ?, ?, ?)"
      );
      const info = stmt.run(nombre, telefono, fecha, hora, cantidad_personas, sala);
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (error) {
      console.error("Error creating reserva:", error);
      res.status(500).json({ error: "Error al crear la reserva" });
    }
  });

  // API Route for Gemini Chat
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, userMessage, systemInstruction } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured on the server.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let responseText = "";

      if (userMessage.image) {
        const base64Data = userMessage.image.split(",")[1];
        const mimeType = userMessage.image.split(";")[0].split(":")[1];
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType } },
              { text: userMessage.text || "Extraé la info clave de este flyer o decime de qué trata." }
            ]
          },
          config: {
            systemInstruction: systemInstruction,
          }
        });
        responseText = response.text || "No pude procesar la imagen, che.";
      } else {
        const properChat = ai.chats.create({
            model: "gemini-3-flash-preview",
            config: {
                systemInstruction: systemInstruction,
            }
        });
        
        for (const msg of messages) {
            if (msg.role === "user") {
                await properChat.sendMessage({ message: msg.text });
            }
        }
        
        const chatResponse = await properChat.sendMessage({ message: userMessage.text });
        responseText = chatResponse.text || "Hubo un error de conexión en el subsuelo.";
      }

      res.json({ text: responseText });
    } catch (error) {
      console.error("Error generating response:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
