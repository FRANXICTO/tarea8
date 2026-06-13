import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up server-side Gemini client with recommended user-agent
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Parse incoming payloads
app.use(express.json({ limit: "20mb" }));

// 1. Accessibility API (Object Recognition & OCR)
app.post("/api/ai/accessibility", async (req, res) => {
  const { image, mode } = req.body;
  if (!image) {
    return res.status(400).json({ error: "Falta la imagen para procesar." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    // Elegant simulation if no API Key is provided
    setTimeout(() => {
      if (mode === "objects") {
        return res.json({
          text: "Simulación local: Se detecta una mesa de madera, una taza blanca y una silla en el centro del espacio."
        });
      } else {
        return res.json({
          text: "Simulación local OCR: Bienvenidos al Laboratorio de Automatización e IA, piso dos."
        });
      }
    }, 1000);
    return;
  }

  try {
    const base64Data = image.split(",")[1] || image;
    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data,
      },
    };

    let prompt = "";
    if (mode === "objects") {
      prompt = "Identifica los objetos cotidianos más destacados en esta imagen. Devuelve una lista corta de objetos detectados en español, ordenados de más cercano/central a lejano. Por ejemplo: 'un vaso de agua en el centro, una laptop detrás, y una silla a la derecha'. Sé muy breve, descriptivo e interactivo. Optimizado para ser leído por un sintetizador de voz a una persona con discapacidad visual.";
    } else {
      prompt = "Extrae todo el texto legible e impreso en esta imagen (letreros, etiquetas, páginas, carteles). Devuelve únicamente la transcripción fiel del texto en español para que sea leído al usuario en voz alta por síntesis de voz. Si no se puede leer texto coherente, responde exactamente: 'No se detectó ningún texto claro en la imagen'.";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, { text: prompt }] },
    });

    res.json({ text: response.text || "No se obtuvo respuesta de la IA." });
  } catch (error: any) {
    console.error("Error en API de Accesibilidad:", error);
    res.status(500).json({ error: "Error procesando la imagen: " + error.message });
  }
});

// 2. Math OCR API
app.post("/api/ai/math-ocr", async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: "Falta la imagen de la expresión matemática." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    // simulation if no API key is set
    setTimeout(() => {
      return res.json({ expression: "(4 + 8) / 3" });
    }, 1200);
    return;
  }

  try {
    const base64Data = image.split(",")[1] || image;
    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data,
      },
    };

    const prompt = "Analiza esta imagen y extrae de forma ultra precisa la expresión aritmética/matemática. Devuelve EXCLUSIVAMENTE la fórmula aritmética sin ningún espacio, texto explicativo ni adornos, por ejemplo: '(4+8)/3' u '8*3-5'. Asegúrate de corregir 'x' o 'X' por '*' y barras de fracción inclinadas por '/'. Asegúrate de que solo contenga números enteros, decimales y los caracteres +, -, *, /, (, y ). Si no detectas una fórmula matemática coherente, devuelve el mensaje de error: 'ERROR_NO_MATH_FOUND'.";

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, { text: prompt }] },
    });

    const parsedExpr = response.text ? response.text.trim() : "";
    if (parsedExpr.includes("ERROR_NO_MATH_FOUND")) {
      return res.status(422).json({ error: "No se identificó ninguna operación matemática válida en la captura." });
    }

    res.json({ expression: parsedExpr });
  } catch (error: any) {
    console.error("Error en Math OCR API:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Translation API
app.post("/api/ai/translate", async (req, res) => {
  const { text, sourceLang, targetLang } = req.body;
  if (!text) {
    return res.status(400).json({ error: "No hay texto para traducir." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    // Local fallback/simulation if no key is configured
    setTimeout(() => {
      let mockTransl = "";
      if (targetLang.toLowerCase().includes("en")) {
        mockTransl = `[Simulado] ${text} (Translated dynamically)`;
      } else if (targetLang.toLowerCase().includes("es")) {
        mockTransl = `[Simulado] ${text} (Traducido dinámicamente)`;
      } else {
        mockTransl = `[Simulado] ${text} (Translation to ${targetLang})`;
      }
      return res.json({ translation: mockTransl });
    }, 800);
    return;
  }

  try {
    const prompt = `Traduce el siguiente fragmento del idioma de origen (${sourceLang}) al idioma de destino (${targetLang}) de forma natural y contextual (no traducción literal palabra por palabra). Conserva el sentido coloquial o formal y los signos de puntuación correspondientes.
    
Texto original:
"${text}"

Devuelve ÚNICAMENTE la traducción resultante limpia, sin comentarios extras, explicaciones ni barras de depuración.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ translation: response.text ? response.text.trim() : "" });
  } catch (error: any) {
    console.error("Error en API de Traducción:", error);
    res.status(500).json({ error: error.message });
  }
});

// API health check
app.get("/api/health", (req, res) => {
  const isKeyActive = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  res.json({ 
    status: "ok", 
    geminiKeyConfigured: isKeyActive,
    time: new Date().toISOString()
  });
});

// Serve frontend assets using Vite dev middleware in development or direct static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}/`);
  });
}

startServer();
