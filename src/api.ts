import { buildChatEndpoint, MODEL_TO_POLLINATIONS } from "./config";
import type { ChatMessage, SurfConfig } from "./types";

function toPollinationsModel(display: string): string {
  return MODEL_TO_POLLINATIONS[display] ?? "openai-large";
}

async function* streamResponse(
  url: string,
  config: SurfConfig,
  body: Record<string, unknown>,
): AsyncGenerator<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string }; finish_reason?: string }[];
        };
        const content = json?.choices?.[0]?.delta?.content;
        if (content) yield content;
        if (json?.choices?.[0]?.finish_reason) return;
      } catch {}
    }
  }
}

export type ChatCallbacks = {
  onContent?: (chunk: string) => void;
};

export async function chatOnce(
  messages: ChatMessage[],
  config: SurfConfig,
  model: string,
  callbacks?: ChatCallbacks,
): Promise<string> {
  const url = buildChatEndpoint(config.baseUrl);
  const body = {
    model: toPollinationsModel(model),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: 0.4,
    stream: true,
  };
  let content = "";
  for await (const chunk of streamResponse(url, config, body)) {
    content += chunk;
    callbacks?.onContent?.(chunk);
  }
  return content.trim();
}
