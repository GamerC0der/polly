export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface SurfConfig {
  apiKey: string;
  baseUrl: string;
}
