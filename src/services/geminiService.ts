import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface AnalysisResult {
  name: string;
  frames: string[];
  confidence: number;
  notes?: string;
}

export const analyzeScoreboard = async (base64Data: string): Promise<AnalysisResult> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `Analyze this bowling scoreboard image. 
            The image is taken from a screen in a bowling center and may contain reflections, glare, or low contrast.
            
            TASKS:
            1. Identify the grid structure of the scoreboard.
            2. Locate the player's row.
            3. Extract the player name.
            4. Extract the scores for all 10 frames.
            
            NOTATION RULES:
            - 'X' for a strike.
            - '/' for a spare (e.g., '9/' means 9 pins then a spare).
            - Numbers for pin counts (e.g., '81' for 8 then 1).
            - '-' for a miss (e.g., '9-' for 9 then miss).
            - 'S' prefix for a split (e.g., 'S71' for a split where 7 and 1 pins were hit).
            - For the 10th frame, provide all 2 or 3 rolls (e.g., 'XXX', '9/X', '81').
            
            VALIDATION:
            - Be extremely careful with reflections that might look like numbers or symbols.
            - Cross-reference the frame scores with the cumulative total if visible to ensure accuracy.
            - If a frame is blurry, use the surrounding context and cumulative score to infer the most likely value.
            
            Return ONLY a JSON object:
            {
              "name": "Player Name",
              "frames": ["X", "9/", "S71", ..., "XXX"],
              "confidence": 0.95,
              "notes": "Optional notes about image quality or specific frames that were hard to read."
            }`,
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Data,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          frames: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            minItems: 10,
            maxItems: 10,
          },
          confidence: { 
            type: Type.NUMBER,
            description: "Confidence score from 0 to 1, where 1 is absolute certainty."
          },
          notes: { type: Type.STRING },
        },
        required: ["name", "frames", "confidence"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    console.error("Gemini Response Error: Empty text", response);
    throw new Error("No response from AI");
  }
  
  try {
    // Clean potential markdown code blocks if the model included them despite the config
    const cleanedJson = text.replace(/```json\n?/, "").replace(/\n?```/, "").trim();
    return JSON.parse(cleanedJson);
  } catch (err) {
    console.error("JSON Parse Error:", err, "Raw Text:", text);
    throw new Error("Failed to parse scoreboard data. Please try a clearer photo.");
  }
};
