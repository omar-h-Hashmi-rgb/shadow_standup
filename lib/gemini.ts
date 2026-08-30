import { GoogleGenerativeAI } from "@google/generative-ai";

const keys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
].filter((key): key is string => Boolean(key));

if (keys.length === 0) {
  throw new Error(
    "No Gemini API key found. Please add GEMINI_API_KEY to .env.local"
  );
}

const clients = keys.map((key) => new GoogleGenerativeAI(key));

export const model = clients[0].getGenerativeModel({
  model: "gemini-3.6-flash",
});

export async function generateWithFallback(
  prompt: string,
  options?: {
    temperature?: number;
    responseMimeType?: string;
  }
): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i < clients.length; i++) {
    try {
      const genModel = clients[i].getGenerativeModel({
        model: "gemini-3.6-flash",
      });

      const result = await genModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: options?.temperature ?? 0.1,
          ...(options?.responseMimeType && {
            responseMimeType: options.responseMimeType,
          }),
        },
      });

      return result.response.text();
    } catch (error: any) {
      console.error(
        `Gemini key ${i + 1} failed:`,
        error?.message || error
      );

      lastError = error;

      if (i < clients.length - 1) {
        console.log("Trying next Gemini key...");
      }
    }
  }

  throw lastError || new Error("All Gemini API keys failed.");
}
