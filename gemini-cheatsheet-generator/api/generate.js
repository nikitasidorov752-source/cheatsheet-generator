import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const outputSchema = {
  type: "object",
  properties: {
    sheets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          points: { type: "array", items: { type: "string" } },
          formulas: { type: "array", items: { type: "string" } },
          example: { type: "string" }
        },
        required: ["title", "category", "points", "formulas", "example"]
      }
    }
  },
  required: ["sheets"]
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается." });
  }

  try {
    const { prompt, detail } = req.body || {};

    if (detail && !["short", "long"].includes(detail)) {
      return res.status(400).json({ error: "Некорректный режим детализации." });
    }

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Пустой запрос." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "На сервере не настроена переменная GEMINI_API_KEY."
      });
    }

    // Защита от случайно огромных запросов.
    if (prompt.length > 50000) {
      return res.status(413).json({
        error: "Текст слишком большой. Сократи параграф и попробуй снова."
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.35,
        responseMimeType: "application/json",
        responseSchema: outputSchema
      }
    });

    let result;
    try {
      result = JSON.parse(response.text);
    } catch {
      return res.status(502).json({
        error: "Gemini вернул некорректный JSON."
      });
    }

    if (!result || !Array.isArray(result.sheets) || result.sheets.length === 0) {
      return res.status(502).json({
        error: "Gemini не вернул список шпаргалок."
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Gemini error:", error);
    return res.status(500).json({
      error: "Ошибка при обращении к Gemini API."
    });
  }
}
