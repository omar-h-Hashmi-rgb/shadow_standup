import { groq } from "./groq";
import { HttpError } from "./http";

/**
 * Runs the review prompt against the selected model, with the same fallback
 * behaviour the Code Reviewer has always had: Gemini or a Groq-hosted model
 * first, then Groq's GPT OSS model if that fails.
 *
 * Extracted from the code-review route so every review scope shares it.
 */
export async function generateReviewText(args: {
  systemPrompt: string;
  userPrompt: string;
  model: string;
}): Promise<string> {
  const { systemPrompt, userPrompt, model } = args;
  const compactUserPrompt = userPrompt.slice(0, 20000);

  const groqComplete = async (modelId: string, prompt = userPrompt) => {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      model: modelId,
      temperature: 0.3,
    });
    return completion.choices[0]?.message?.content || "";
  };

  try {
    if (model.startsWith("gemini")) {
      // Imported lazily so a missing Gemini key only affects Gemini requests
      // (which then fall back to Groq) instead of breaking the whole route.
      const { model: geminiModel } = await import("./gemini");
      const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
      });
      return result.response.text();
    }
    return await groqComplete(model);
  } catch (aiError: unknown) {
    console.error("AI Model Failed, trying fallback...", aiError instanceof Error ? aiError.message : aiError);
    try {
      return await groqComplete("openai/gpt-oss-120b", compactUserPrompt);
    } catch (fallbackError: unknown) {
      console.error(
        "AI fallback failed:",
        fallbackError instanceof Error ? fallbackError.message : fallbackError
      );
      throw new HttpError("All AI models failed to respond.", 502);
    }
  }
}
