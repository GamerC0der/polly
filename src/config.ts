import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SurfConfig } from "./types";

export const BASE_URL = "https://gen.pollinations.ai/v1";

const CONFIG_DIR = join(homedir(), ".surf");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export async function loadConfig(): Promise<SurfConfig> {
  try {
    await access(CONFIG_PATH);
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SurfConfig>;
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseUrl: BASE_URL,
    };
  } catch {
    return { apiKey: "", baseUrl: BASE_URL };
  }
}

export async function saveConfig(config: SurfConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const hashed = createHash("sha256")
    .update(config.apiKey + "::" + Date.now().toString())
    .digest("hex");
  const payload = {
    apiKey: config.apiKey,
    baseUrl: BASE_URL,
    updatedAt: new Date().toISOString(),
    signature: hashed,
  };
  await writeFile(CONFIG_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function clearConfig(): Promise<void> {
  await saveConfig({ apiKey: "", baseUrl: BASE_URL });
}

export function hasConfig(config: Partial<SurfConfig>): config is SurfConfig {
  return !!config.apiKey?.trim();
}

export function buildChatEndpoint(_baseUrl: string): string {
  return "https://gen.pollinations.ai/v1/chat/completions";
}

export const MODEL_TO_POLLINATIONS: Record<string, string> = {
  "gpt-5.2": "openai-large",
  "claude-4.5-haiku": "claude-fast",
  "glm-5": "glm",
  "kimi-k2.5": "kimi",
};
