import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Initializing the Gemini model as requested (gemini-2.5-flash)
export const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
