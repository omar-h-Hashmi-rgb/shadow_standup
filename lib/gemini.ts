import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

const API_KEYS = [
  process.env.GEMINI_API_KEY!,
  process.env.GEMINI_SECOND_API_KEY!,
].filter(Boolean);

let currentKeyIndex = 0;

function getGenAI(): GoogleGenerativeAI {
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  return new GoogleGenerativeAI(key);
}

export function getModel(modelName: string = "gemini-2.5-flash"): GenerativeModel {
  return getGenAI().getGenerativeModel({ model: modelName });
}

export async function generateWithFallback(
  prompt: string,
  options?: { temperature?: number; responseMimeType?: string }
): Promise<string> {
  const attempts = API_KEYS.length;
  let lastError: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    const keyIndex = (currentKeyIndex + i) % API_KEYS.length;
    const genAI = new GoogleGenerativeAI(API_KEYS[keyIndex]);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: options?.temperature ?? 0.1,
        responseMimeType: options?.responseMimeType ?? "application/json",
      },
    });

    try {
      const result = await model.generateContent(prompt);
      currentKeyIndex = keyIndex;
      return result.response.text();
    } catch (error: any) {
      lastError = error;
      console.error(`Gemini key ${keyIndex} failed:`, error.message);
      continue;
    }
  }

  throw new Error(`All Gemini API keys failed. Last error: ${lastError?.message}`);
}

export const model = getModel();
