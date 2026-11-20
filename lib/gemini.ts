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

// The 3.x flash models currently answer 503 (overloaded) for this key, which
// surfaces as a multi-minute "hang" because the SDK retries with backoff.
// 2.5-flash responds reliably and is the safe default.
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export const model = clients[0].getGenerativeModel({
  model: DEFAULT_GEMINI_MODEL,
});

export async function generateWithFallback(
  prompt: string,
  options?: {
    temperature?: number;
    responseMimeType?: string;
    maxOutputTokens?: number;
    /** Per-attempt upstream timeout. Without an AbortSignal a stalled call hangs forever. */
    timeoutMs?: number;
    /** Gemini model id. Must start with "gemini-"; anything else uses the default. */
    model?: string;
  }
): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i < clients.length; i++) {
    try {
      // Previously every gemini* request was hard-coded to one model, so the
      // model picker silently did nothing for any other Gemini choice.
      const modelId =
        options?.model && options.model.startsWith("gemini-")
          ? options.model
          : DEFAULT_GEMINI_MODEL;
      const genModel = clients[i].getGenerativeModel({ model: modelId });

      const result = await genModel.generateContent(
        {
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
        },
        // Without this the SDK never creates an AbortSignal, so a stalled
        // Google connection leaves the calling route pending forever.
        // 30s: the 3.x models answer 503 quickly, but the SDK's retry backoff
        // can stretch a single attempt well past a minute.
        { timeout: options?.timeoutMs ?? 30000 }
      );

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
