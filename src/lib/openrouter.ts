import { AzureOpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { SYSTEM_PROMPT } from "./system-prompt";
import type { Message } from "./db";

const client = new AzureOpenAI({
  apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview",
  endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? "",
  apiKey: process.env.AZURE_OPENAI_API_KEY ?? "",
});

const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-5.4-mini";

export async function generateReply(history: Message[]): Promise<string> {
  const messages: ChatCompletionMessageParam[] = history.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));

  const response = await client.chat.completions.create({
    model: DEPLOYMENT,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    max_completion_tokens: 800,
  });

  return (
    response.choices[0]?.message?.content?.trim() ??
    "Lo siento, no pude generar una respuesta."
  );
}
