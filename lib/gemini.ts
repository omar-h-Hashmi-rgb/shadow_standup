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
  model: "gemini-3.8-flash",
});

export async function generateWithFallback(
  prompt: string,
  options?: {
    temperature?: number;
    responseMimeType?: string;
    maxOutputTokens?: number;
  }
): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i < clients.length; i++) {
    try {
      const genModel = clients[i].getGenerativeModel({
        model: "gemini-3.8-flash",
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
          // Cap output so a long response cannot be cut off mid-string, which
          // would make JSON.parse fail and silently degrade to canned text.
          maxOutputTokens: options?.maxOutputTokens ?? 4096,
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
