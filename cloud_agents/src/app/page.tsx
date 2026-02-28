"use client";

import { useEffect, useState } from "react";
import { getAuthUrl, API_KEY_STORAGE } from "../lib/pollinations-auth";
import { fetchTextModels, type TextModel } from "../lib/models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Send, Trash2 } from "lucide-react";

type TaskOutputMode = "auto" | "web" | "markdown";

type GeneratedTaskFiles = {
  indexHtml: string;
  styleCss: string;
  scriptJs: string;
  markdown: string;
  outputMode: TaskOutputMode;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdown(markdown: string) {
  const escaped = escapeHtml(markdown.trim());
  return escaped
    .replace(/^###\s+(.*)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.*)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^\s*[-*]\s+(.*)$/gm, "<li>$1</li>")
    .replace(/(?:<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n+/g, "<br /><br />");
}

function normalizeOutputMode(rawMode: string | undefined): TaskOutputMode | undefined {
  if (!rawMode) {
    return undefined;
  }
  if (rawMode === "web" || rawMode === "markdown" || rawMode === "auto") {
    return rawMode;
  }
  if (rawMode === "md" || rawMode === "markdown-only" || rawMode === "document") {
    return "markdown";
  }
  return undefined;
}

function inferOutputModeFromFiles(files: Pick<GeneratedTaskFiles, "indexHtml" | "styleCss" | "scriptJs" | "markdown">): TaskOutputMode {
  const markdown = files.markdown ?? "";
  const indexHtml = files.indexHtml ?? "";
  const styleCss = files.styleCss ?? "";
  const scriptJs = files.scriptJs ?? "";

  const hasMarkdown = markdown.trim().length > 0;
  const hasWebCode =
    indexHtml.trim().length > 0 || styleCss.trim().length > 0 || scriptJs.trim().length > 0;

  if (hasMarkdown && !hasWebCode) {
    return "markdown";
  }
  return "web";
}

function isLikelyProseTask(taskText: string): boolean {
  const normalized = taskText.toLowerCase();
  const proseSignals = [
    /\bpoem\b/,
    /\bpoetry\b/,
    /\bstory\b/,
    /\bessay\b/,
    /\bletter\b/,
    /\bsummary\b/,
    /\bexplain\b/,
    /\bdocumentation\b/,
    /\bdocument\b/,
    /\bcontent\b/,
    /\bmarkdown\b/,
  ];

  const webSignals = [
    /\bweb\s*page\b/,
    /\bwebsite\b/,
    /\blanding\b/,
    /\bui\b/,
    /\bapp\b/,
    /\bcomponent\b/,
    /\binteractive\b/,
    /\bhtml\b/,
    /\bcss\b/,
    /\bjavascript\b/,
    /\bcss\/?js\b/,
    /\bbuild\s+.*(page|app|site)\b/,
  ];

  if (webSignals.some((re) => re.test(normalized))) {
    return false;
  }

  return proseSignals.some((re) => re.test(normalized));
}

function resolveOutputMode(mode: TaskOutputMode, files: Pick<GeneratedTaskFiles, "indexHtml" | "styleCss" | "scriptJs" | "markdown">) {
  return mode === "auto" ? inferOutputModeFromFiles(files) : mode;
}

function resolveAutoModeFromPrompt(mode: TaskOutputMode, taskText: string): TaskOutputMode {
  if (mode === "auto" && isLikelyProseTask(taskText)) {
    return "markdown";
  }
  return mode;
}

function buildMarkdownPreviewSrcDoc(markdown: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charSet="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 18px;
        font-family: Georgia, serif;
        line-height: 1.5;
        background: #fff;
      }
      h1,
      h2,
      h3 {
        line-height: 1.3;
        margin-top: 1.2em;
      }
      pre {
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 12px;
        overflow-x: auto;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      .markdown {
        max-width: 860px;
        margin: 0 auto;
      }
    </style>
  </head>
  <body>
    <main class="markdown">
      ${renderMarkdown(markdown)}
    </main>
  </body>
</html>`;
}

function buildTaskPreviewSrcDoc(files: GeneratedTaskFiles, mode: TaskOutputMode = "web") {
  const effectiveMode = resolveOutputMode(mode, files);

  if (effectiveMode === "markdown") {
    return buildMarkdownPreviewSrcDoc(files.markdown);
  }

  const indexHtml = files.indexHtml ?? "";
  const styleCss = files.styleCss ?? "";
  const scriptJs = files.scriptJs ?? "";

  if (/<\s*html[\s>]/i.test(indexHtml)) {
    const includesHead = /<head[\s>]/i.test(indexHtml);
    const hasHeadClose = /<\/head>/i.test(indexHtml);
    const hasBodyClose = /<\/body>/i.test(indexHtml);

    let withStyles = indexHtml;
    let withScripts = withStyles;

    if (styleCss.trim()) {
      if (hasHeadClose) {
        withStyles = withStyles.replace(/<\/head>/i, `<style>${styleCss}</style></head>`);
      } else if (includesHead) {
        withStyles = withStyles.replace(/<head[^>]*>/i, (match) => `${match}<style>${styleCss}</style>`);
      } else if (/<body[\s>]/i.test(withStyles)) {
        withStyles = withStyles.replace(/(<body[^>]*>)/i, (match) => `<head><style>${styleCss}</style></head>${match}`);
      } else {
        withStyles = `<!DOCTYPE html><html><head><style>${styleCss}</style></head>${withStyles}</html>`;
      }
    }

    if (scriptJs.trim()) {
      if (hasBodyClose) {
        withScripts = withStyles.replace(/<\/body>/i, `<script>${scriptJs}</script></body>`);
      } else {
        withScripts = `${withStyles}<script>${scriptJs}</script>`;
      }
    } else {
      withScripts = withStyles;
    }

    return withScripts;
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charSet="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${styleCss}</style>
  </head>
  <body>
    ${indexHtml}
    <script>
      ${scriptJs}
    </script>
  </body>
</html>`;
}

function buildTaskPreviewWindowHtml(params: {
  prompt: string;
  model: string;
  taskId: number;
  srcDoc: string;
  zipUrl: string;
}) {
  const promptText = params.prompt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const modelText = params.model
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeSrcDoc = JSON.stringify(params.srcDoc)
    .replace(/<\/script/gi, "<\\/script")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charSet="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Task Preview ${params.taskId}</title>
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        background: #E6FFEB;
      }
      .topbar {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid #C8E6C9;
        background: #F9F3FF;
      }
      .meta {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 12px;
        line-height: 1.3;
        color: #2E2E2E;
      }
      .meta .prompt {
        font-weight: 600;
      }
      .model {
        color: #5a5a5a;
      }
      .download-btn {
        border: 1px solid #1A5319;
        background: #2E2E2E;
        color: #fff;
        border-radius: 9999px;
        padding: 8px 12px;
        font-weight: 600;
        text-decoration: none;
      }
      .preview-frame {
        display: block;
        width: 100%;
        height: calc(100vh - 84px);
        border: none;
        background: white;
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <div class="meta">
        <div class="prompt">Prompt: ${promptText}</div>
        <div class="model">Model: ${modelText}</div>
      </div>
      <a class="download-btn" href="${params.zipUrl}" download="task-${params.taskId}-preview.zip">
        Download as ZIP
      </a>
    </header>
    <iframe id="preview-frame" class="preview-frame" sandbox="allow-scripts"></iframe>
    <script>
      const frame = document.getElementById("preview-frame");
      frame.srcdoc = ${safeSrcDoc};
    </script>
  </body>
</html>`;
}

function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function concatBytes(parts: Array<Uint8Array>): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function makeCrc32Table(): number[] {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrc32Table();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBlob(files: Array<{ name: string; content: string }>): Blob {
  const fileEntries = files.map((file) => ({
      name: file.name,
      nameBytes: toBytes(file.name),
      contentBytes: toBytes(file.content),
      crc: 0,
      size: 0,
    }))
    .map((file) => {
      const crc = crc32(file.contentBytes);
      return { ...file, crc, size: file.contentBytes.length };
    });

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of fileEntries) {
    const localHeader = new Uint8Array(30 + file.nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, file.crc, true);
    localView.setUint32(18, file.size, true);
    localView.setUint32(22, file.size, true);
    localView.setUint16(26, file.nameBytes.length, true);
    localHeader.set(file.nameBytes, 30);
    locals.push(localHeader);
    locals.push(file.contentBytes);

    const centralHeader = new Uint8Array(46 + file.nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, file.crc, true);
    centralView.setUint32(20, file.size, true);
    centralView.setUint32(24, file.size, true);
    centralView.setUint16(28, file.nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(file.nameBytes, 46);
    centrals.push(centralHeader);

    offset += localHeader.length + file.size;
  }

  const centralDirectory = concatBytes(centrals);
  const centralSize = centralDirectory.length;
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, fileEntries.length, true);
  endView.setUint16(10, fileEntries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...locals, centralDirectory, endHeader], { type: "application/zip" });
}

function buildTaskZipUrl(task: StoredTask): string {
  const html = task.files?.indexHtml ?? "";
  const css = task.files?.styleCss ?? "";
  const js = task.files?.scriptJs ?? "";
  const markdown = task.files?.markdown ?? "";
  const effectiveMode = task.files ? resolveOutputMode(task.outputMode, task.files) : task.outputMode;
  const zipEntries =
    effectiveMode === "markdown"
      ? [
          { name: "content.md", content: markdown },
          { name: "README.txt", content: `Prompt: ${task.text}\nModel: ${task.model}\nMode: markdown\n` },
        ]
      : [
          { name: "index.html", content: html },
          { name: "style.css", content: css },
          { name: "script.js", content: js },
          { name: "README.txt", content: `Prompt: ${task.text}\nModel: ${task.model}\n` },
        ];
  const zipBlob = buildZipBlob(zipEntries);
  return URL.createObjectURL(zipBlob);
}

type StoredTask = {
  id: number;
  text: string;
  createdAt: string;
  model: string;
  outputMode: TaskOutputMode;
  files?: GeneratedTaskFiles;
  status?: "ready" | "error" | "generating";
  errorMessage?: string;
};

const TASK_DB_NAME = "cloud-agents";
const TASK_DB_VERSION = 2;
const TASK_STORE_NAME = "tasks";
const POLLINATIONS_CHAT_URL = "https://gen.pollinations.ai/v1/chat/completions";
const DEFAULT_MODEL = "openai-large";

function openTasksDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TASK_DB_NAME, TASK_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TASK_STORE_NAME)) {
        db.createObjectStore(TASK_STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadTasksFromDb(): Promise<StoredTask[]> {
  const db = await openTasksDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TASK_STORE_NAME, "readonly");
    const store = tx.objectStore(TASK_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result as Array<
        Omit<StoredTask, "id"> & {
          id?: number;
          files?: GeneratedTaskFiles;
          generated?: GeneratedTaskFiles;
        }
      >;
      const tasks = records
        .map((task) => ({
          id: task.id ?? 0,
          text: task.text ?? "",
          createdAt: task.createdAt ?? new Date().toISOString(),
          model: task.model ?? DEFAULT_MODEL,
          outputMode: sanitizeTaskOutputMode(task.outputMode ?? "auto"),
          files: normalizeGeneratedFiles((task.files ?? task.generated) as Partial<GeneratedTaskFiles> | undefined),
          status: task.status ?? "ready",
          errorMessage: task.errorMessage,
        }))
        .sort((a, b) => {
          return b.createdAt.localeCompare(a.createdAt);
        });
      resolve(tasks);
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

async function saveTaskToDb(task: Omit<StoredTask, "id">): Promise<StoredTask> {
  const db = await openTasksDb();
  const payload = {
    ...task,
    createdAt: task.createdAt ?? new Date().toISOString(),
    model: task.model ?? DEFAULT_MODEL,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(TASK_STORE_NAME, "readwrite");
    const store = tx.objectStore(TASK_STORE_NAME);
    const request = store.add(payload);

    request.onsuccess = () => {
      resolve({
        id: request.result as number,
        ...payload,
      });
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

function getStoredApiKey(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(API_KEY_STORAGE);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\u00A0/g, " ");
}

function parseGeneratedFiles(raw: string): GeneratedTaskFiles {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const jsonCandidate = normalizeWhitespace(
    fenced ?? (firstBrace !== -1 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : raw.trim()),
  );
  try {
    const parsed = JSON.parse(jsonCandidate) as {
      outputMode?: string;
      indexHtml?: string;
      styleCss?: string;
      scriptJs?: string;
      markdown?: string;
      index?: string;
      styles?: string;
      script?: string;
      md?: string;
      ["index.html"]?: string;
      ["style.css"]?: string;
      ["script.js"]?: string;
      ["content.md"]?: string;
      ["README.md"]?: string;
      files?: {
        indexHtml?: string;
        styleCss?: string;
        scriptJs?: string;
        markdown?: string;
      };
    };
    const indexedFromFiles = parsed.files ?? {};
    const indexHtml = parsed.indexHtml || indexedFromFiles.indexHtml || parsed.index || parsed["index.html"] || "";
    const styleCss = parsed.styleCss || indexedFromFiles.styleCss || parsed.styles || parsed["style.css"] || "";
    const scriptJs = parsed.scriptJs || indexedFromFiles.scriptJs || parsed.script || parsed["script.js"] || "";
    const markdown =
        parsed.markdown ||
        indexedFromFiles.markdown ||
        parsed.md ||
        parsed["content.md"] ||
        parsed["README.md"] ||
        "";
    const outputMode = resolveOutputMode(
      normalizeOutputMode(parsed.outputMode) ?? "auto",
      {
        indexHtml,
        styleCss,
        scriptJs,
        markdown,
      },
    );

    return {
      indexHtml,
      styleCss,
      scriptJs,
      markdown,
      outputMode,
    };
  } catch {
    throw new Error("AI response did not include valid JSON output.");
  }
}

function sanitizeTaskOutputMode(mode?: string): TaskOutputMode {
  if (mode === "web" || mode === "markdown" || mode === "auto") {
    return mode;
  }
  return "auto";
}

function normalizeGeneratedFiles(
  rawFiles: Partial<GeneratedTaskFiles> | undefined,
): GeneratedTaskFiles | undefined {
  if (!rawFiles) {
    return undefined;
  }

  const indexHtml = rawFiles.indexHtml ?? "";
  const styleCss = rawFiles.styleCss ?? "";
  const scriptJs = rawFiles.scriptJs ?? "";
  const markdown = rawFiles.markdown ?? "";
  const parsedMode = sanitizeTaskOutputMode(rawFiles.outputMode ?? "");
  const outputMode = parsedMode === "auto" ? inferOutputModeFromFiles({ indexHtml, styleCss, scriptJs, markdown }) : parsedMode;

  return {
    indexHtml,
    styleCss,
    scriptJs,
    markdown,
    outputMode,
  };
}

function unescapeJsonString(value: string) {
  return value.replace(/\\(["\\/bfnrt])/g, (_match, char) => {
    const map: Record<string, string> = {
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
    };
    return map[char] ?? char;
  });
}

function extractPartialJsonField(raw: string, field: keyof GeneratedTaskFiles): string | null {
  const key = `"${field}"`;
  const start = raw.indexOf(key);
  if (start === -1) {
    return null;
  }

  const colon = raw.indexOf(":", start + key.length);
  if (colon === -1) {
    return null;
  }

  let quoteStart = raw.indexOf('"', colon);
  if (quoteStart === -1) {
    return null;
  }

  quoteStart += 1;
  let escaped = false;
  let i = quoteStart;
  while (i < raw.length) {
    const char = raw[i];
    if (char === "\\" && !escaped) {
      escaped = true;
      i += 1;
      continue;
    }

    if (char === '"' && !escaped) {
      const encoded = raw.slice(quoteStart, i);
      return unescapeJsonString(encoded);
    }

    escaped = false;
    i += 1;
  }

  return unescapeJsonString(raw.slice(quoteStart));
}

function buildStreamingFiles(raw: string): Partial<GeneratedTaskFiles> {
  const indexHtml = extractPartialJsonField(raw, "indexHtml");
  const styleCss = extractPartialJsonField(raw, "styleCss");
  const scriptJs = extractPartialJsonField(raw, "scriptJs");
  const markdown = extractPartialJsonField(raw, "markdown");
  const outputMode = extractPartialJsonField(raw, "outputMode");
  const files: Partial<GeneratedTaskFiles> = {};
  if (indexHtml !== null) files.indexHtml = indexHtml;
  if (styleCss !== null) files.styleCss = styleCss;
  if (scriptJs !== null) files.scriptJs = scriptJs;
  if (markdown !== null) files.markdown = markdown;
  if (outputMode !== null) {
    const normalized = normalizeOutputMode(outputMode) ?? "auto";
    files.outputMode = normalized;
  }
  return files;
}

async function generateTaskFiles(
  taskText: string,
  selectedModel: string,
  outputMode: TaskOutputMode,
  onProgress?: (raw: string) => void,
): Promise<GeneratedTaskFiles> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    throw new Error("Missing BYOP API key. Please sign in again.");
  }

  const payload = {
    model: selectedModel,
    stream: true,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          outputMode === "auto"
            ? 'You are a web and markdown assistant. Return ONLY strict JSON with keys "outputMode", "indexHtml", "styleCss", "scriptJs", and "markdown". outputMode must be "web" or "markdown". For plain text tasks (poems, stories, letters, explanations, essays, docs, summaries), choose markdown. For explicit web/app UI tasks, choose web.'
            : outputMode === "markdown"
              ? 'You are a markdown assistant. Return ONLY strict JSON with key "markdown".'
              : 'You are a web coding assistant. Return ONLY strict JSON with keys "indexHtml", "styleCss", and "scriptJs".',
      },
      {
        role: "user",
        content:
          outputMode === "auto"
            ? `Choose the best output format for this request. If it is text-oriented (poem, story, note, guide, essay, email, letter, summary), return markdown. If it is a website/component request, return web: ${taskText}.`
            : outputMode === "markdown"
              ? `Create a markdown document for: ${taskText}.`
              : `Build this task as a web page and only provide code: ${taskText}.`,
      },
    ],
  };

  const res = await fetch(POLLINATIONS_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Model request failed (${res.status}): ${text}`);
  }
  if (!res.body) {
    throw new Error("Model response has no body.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let collected = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n");
    buffer = chunks.pop() ?? "";

    for (const rawLine of chunks) {
      const line = rawLine.trim();
      if (!line.startsWith("data: ")) {
        continue;
      }
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        return parseGeneratedFiles(collected);
      }

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const nextChunk = parsed.choices?.[0]?.delta?.content;
        if (nextChunk) {
          collected += nextChunk;
        onProgress?.(collected);
        }
      } catch {
        continue;
      }
    }
  }

  return parseGeneratedFiles(collected);
}

function tryParseGeneratedFiles(raw: string): GeneratedTaskFiles | null {
  try {
    return parseGeneratedFiles(raw);
  } catch {
    return null;
  }
}

async function deleteTaskFromDb(id: number): Promise<void> {
  const db = await openTasksDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(TASK_STORE_NAME, "readwrite");
    const store = tx.objectStore(TASK_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

type View = "create" | "tasks";
const TASK_PREVIEW_LENGTH = 140;

export default function Home() {
  const [hasKey, setHasKey] = useState(false);
  const [view, setView] = useState<View>("create");
  const [taskInput, setTaskInput] = useState("");
  const [models, setModels] = useState<TextModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [submittedTasks, setSubmittedTasks] = useState<StoredTask[]>([]);
  const [expandedTaskIds, setExpandedTaskIds] = useState<number[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [outputMode, setOutputMode] = useState<TaskOutputMode>("auto");
  const [taskIdPendingDelete, setTaskIdPendingDelete] = useState<number | null>(null);

  useEffect(() => {
    setHasKey(!!(typeof window !== "undefined" && localStorage.getItem(API_KEY_STORAGE)));
  }, []);

  useEffect(() => {
    loadTasksFromDb().then((tasks) => {
      setSubmittedTasks(tasks);
    });
  }, []);

  useEffect(() => {
    if (view === "create" && models.length === 0) {
      setModelsLoading(true);
      fetchTextModels()
        .then((m) => {
          setModels(m);
          if (m.length > 0 && !m.some((x) => x.name === selectedModel)) {
            setSelectedModel(m[0]!.name);
          }
        })
        .catch(() => setModels([]))
        .finally(() => setModelsLoading(false));
    }
  }, [view, models.length]);

  const handleLogin = () => {
    const callbackUrl = typeof window !== "undefined" ? `${window.location.origin}/callback` : "";
    if (callbackUrl) {
      window.location.href = getAuthUrl(callbackUrl);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(API_KEY_STORAGE);
    setHasKey(false);
  };

  const handleSubmitTask = async () => {
    const trimmed = taskInput.trim();
    if (!trimmed) {
      return;
    }

    const requestedMode = resolveAutoModeFromPrompt(outputMode, trimmed);
    const startedAt = new Date().toISOString();
    const tempTaskId = -Date.now();
    const optimisticTask: StoredTask = {
      id: tempTaskId,
      text: trimmed,
      createdAt: startedAt,
      model: selectedModel,
      outputMode: requestedMode,
      status: "generating",
    };

    setSubmitStatus("submitting");
    setSubmitError(null);
    setTaskInput("");
    setView("tasks");
    setSubmittedTasks((current) => [optimisticTask, ...current]);

    try {
      const generatedFiles = await generateTaskFiles(trimmed, selectedModel, requestedMode, (raw) => {
        const streaming = buildStreamingFiles(raw);
        setSubmittedTasks((current) =>
          current.map((task) =>
            task.id === tempTaskId
              ? {
                  ...task,
                  files: {
                    ...task.files,
                    ...streaming,
                    ...(tryParseGeneratedFiles(raw) ?? {}),
                  },
                  outputMode:
                    requestedMode === "auto" && streaming.outputMode && streaming.outputMode !== "auto"
                      ? streaming.outputMode
                      : requestedMode,
                }
              : task,
          ),
        );
      });
      const finalMode = resolveOutputMode(requestedMode, generatedFiles);
      const savedTask = await saveTaskToDb({
        text: trimmed,
        createdAt: startedAt,
        model: selectedModel,
        outputMode: finalMode,
        files: generatedFiles,
        status: "ready",
      });
      setSubmittedTasks((current) =>
        current.map((task) => (task.id === tempTaskId ? { ...savedTask, status: "ready" } : task)),
      );
      setSubmitStatus("done");
      setTimeout(() => {
        setSubmitStatus("idle");
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate code.";
      setSubmittedTasks((current) =>
        current.map((task) =>
          task.id === tempTaskId
            ? {
                ...task,
                status: "error",
                errorMessage: message,
              }
            : task,
        ),
      );
      setSubmitError(message);
      setSubmitStatus("idle");
    }
  };

  const submitButtonLabel =
    submitStatus === "submitting"
      ? "Generating in background..."
      : submitStatus === "done"
        ? "Submitted"
        : "Submit Task";

  const openTaskPreview = (item: StoredTask) => {
    if (!item.files) {
      return;
    }
    const effectiveMode = resolveOutputMode(item.outputMode, item.files);
    const zipUrl = buildTaskZipUrl(item);
    const previewSrcDoc = buildTaskPreviewSrcDoc(item.files, effectiveMode);
    const previewWindowUrl = URL.createObjectURL(
      new Blob(
        [
          buildTaskPreviewWindowHtml({
            prompt: item.text,
            model: item.model ?? DEFAULT_MODEL,
            taskId: item.id,
            srcDoc: previewSrcDoc,
            zipUrl,
          }),
        ],
        { type: "text/html" },
      ),
    );

    const previewWindow = window.open(previewWindowUrl, "_blank");
    if (!previewWindow) {
      window.alert("Preview blocked by browser popup blocker.");
      URL.revokeObjectURL(zipUrl);
      return;
    }
    previewWindow.focus();
    setTimeout(() => URL.revokeObjectURL(previewWindowUrl), 3000);
    setTimeout(() => {
      URL.revokeObjectURL(zipUrl);
    }, 300_000);
  };

  const handleRequestDeleteTask = (id: number) => {
    setTaskIdPendingDelete(id);
  };

  const handleCancelDelete = () => {
    setTaskIdPendingDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (taskIdPendingDelete === null) {
      return;
    }

    await deleteTaskFromDb(taskIdPendingDelete);
    setSubmittedTasks((current) => current.filter((task) => task.id !== taskIdPendingDelete));
    setExpandedTaskIds((current) => current.filter((taskId) => taskId !== taskIdPendingDelete));
    setTaskIdPendingDelete(null);
  };

  const toggleTaskExpanded = (id: number) => {
    setExpandedTaskIds((current) =>
      current.includes(id) ? current.filter((taskId) => taskId !== id) : [...current, id],
    );
  };

  if (!hasKey) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#E6FFEB] p-8 sm:p-24">
        <div className="w-full max-w-md rounded-2xl bg-[#F9F3FF] p-10 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-[#2E2E2E]">Cloud Agents</h1>
          <p className="mb-8 text-[#5a5a5a]">Sign in to continue.</p>
          <button
            onClick={handleLogin}
            className="w-full rounded-full bg-[#2E2E2E] px-6 py-3 font-medium text-white transition-colors hover:bg-[#1a1a1a]"
          >
            Login with Pollinations
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#E6FFEB]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[#C8E6C9] bg-[#F9F3FF] p-6">
        <h2 className="mb-6 text-lg font-bold text-[#2E2E2E]">Cloud Agents</h2>
        <nav className="flex flex-col gap-2">
          <button
            onClick={() => setView("create")}
            className={`rounded-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
              view === "create" ? "bg-[#1A5319] text-white" : "text-[#2E2E2E] hover:bg-[#DDD3EB]/50"
            }`}
          >
            Create Task
          </button>
          <button
            onClick={() => setView("tasks")}
            className={`rounded-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
              view === "tasks" ? "bg-[#1A5319] text-white" : "text-[#2E2E2E] hover:bg-[#DDD3EB]/50"
            }`}
          >
            View Tasks
          </button>
        </nav>
        <button
          onClick={handleLogout}
          className="mt-auto w-full rounded-full border border-[#DDD3EB] bg-transparent px-4 py-2.5 text-left text-sm font-medium text-[#5a5a5a] transition-colors hover:bg-[#F0EBF5]"
        >
          Logout
        </button>
      </aside>
      <main className="flex-1 p-8">
        {view === "create" && (
          <>
            <div className="rounded-2xl bg-[#F9F3FF] p-8 shadow-sm">
              <h3 className="mb-6 text-xl font-bold text-[#2E2E2E]">Create Task</h3>
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-[#2E2E2E]">Task</label>
                <input
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Describe your task..."
                  className="w-full rounded-xl border border-[#DDD3EB] bg-white px-4 py-3 text-[#2E2E2E] placeholder-[#8b8b8b] focus:border-[#1A5319] focus:outline-none focus:ring-1 focus:ring-[#1A5319]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#2E2E2E]">Model</label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-full" disabled={modelsLoading}>
                    <SelectValue placeholder={modelsLoading ? "Loading models..." : "Select model"} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.name} value={m.name} title={m.description}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleSubmitTask}
                  disabled={!taskInput.trim() || submitStatus === "submitting"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E2E2E] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:bg-[#A5A5A5]"
                >
                  <Send className="h-4 w-4" />
                  {submitButtonLabel}
                </button>
                {submitError && <p className="mt-2 text-sm text-[#B91C1C]">{submitError}</p>}
              </div>
            </div>
            <details className="mt-6 rounded-xl border border-[#DDD3EB] bg-[#F9F3FF] px-4 py-3 transition-all duration-150">
              <summary className="list-none cursor-pointer text-sm font-medium text-[#2E2E2E]">More</summary>
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-[#2E2E2E]">Output mode</label>
                <Select value={outputMode} onValueChange={(value) => setOutputMode(value as TaskOutputMode)}>
                  <SelectTrigger className="w-full" disabled={submitStatus === "submitting"}>
                    <SelectValue placeholder="Select output mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="web">HTML/CSS/JS</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </details>
          </>
        )}
        {view === "tasks" && (
          <div className="rounded-2xl bg-[#F9F3FF] p-8 shadow-sm">
            <h3 className="mb-4 text-xl font-bold text-[#2E2E2E]">View Tasks</h3>
            {submitStatus === "done" && (
              <p className="mb-3 text-sm text-[#1A5319]">Task submitted and code generated.</p>
            )}
            {submittedTasks.length > 0 ? (
              <ul className="space-y-2">
                {submittedTasks.map((item) => {
                  const isExpanded = expandedTaskIds.includes(item.id);
                  const isLong = item.text.length > TASK_PREVIEW_LENGTH;
                  const shownText = isExpanded || !isLong ? item.text : `${item.text.slice(0, TASK_PREVIEW_LENGTH)}…`;
                  const canToggle = isLong;
                  const hasFiles = !!item.files;
                  const resolvedMode = item.files
                    ? resolveOutputMode(item.outputMode, item.files)
                    : resolveOutputMode("auto", {
                        indexHtml: "",
                        styleCss: "",
                        scriptJs: "",
                        markdown: "",
                      });
                  const isGenerating = item.status === "generating";

                  return (
                    <li
                      key={item.id}
                      className="space-y-3 rounded-lg border border-[#DDD3EB] bg-white px-4 py-3 text-sm text-[#2E2E2E]"
                    >
                      <p>{shownText}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-[#7a7a7a]">
                          {new Date(item.createdAt).toLocaleString()} • model: {item.model ?? DEFAULT_MODEL} •{" "}
                          {item.status === "error" ? "failed" : item.status === "generating" ? "generating" : "generated"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-[#DDD3EB] px-2 py-1 text-[11px] font-medium text-[#5a5a5a]">
                            {resolvedMode === "markdown" ? "Markdown" : "HTML/CSS/JS"}
                          </span>
                          {hasFiles && (
                            <button
                              type="button"
                              onClick={() => openTaskPreview(item)}
                              className="inline-flex items-center gap-1 rounded-md border border-[#DDD3EB] px-2 py-1 text-[11px] font-medium text-[#5a5a5a] transition-colors hover:bg-[#f3f3f3]"
                            >
                              <ChevronDown className="h-3.5 w-3.5" /> Open preview
                            </button>
                          )}
                          {canToggle && (
                            <button
                              type="button"
                              onClick={() => toggleTaskExpanded(item.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-[#DDD3EB] px-2 py-1 text-[11px] font-medium text-[#5a5a5a] transition-colors hover:bg-[#f3f3f3]"
                            >
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              {isExpanded ? "View less" : "View more"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRequestDeleteTask(item.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-100"
                            title="Delete task"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                      {item.errorMessage && <p className="text-sm text-[#B91C1C]">{item.errorMessage}</p>}
                      {!hasFiles && isGenerating && <p className="text-sm text-[#5a5a5a]">Waiting for generated output...</p>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[#5a5a5a]">Your tasks will appear here.</p>
            )}
          </div>
        )}
        {taskIdPendingDelete !== null && (
          <div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4"
            onClick={handleCancelDelete}
          >
            <div className="w-full max-w-sm rounded-2xl border border-[#DDD3EB] bg-[#F9F3FF] p-6 shadow-xl">
              <h4 className="mb-2 text-lg font-bold text-[#2E2E2E]">Delete task</h4>
              <p className="mb-6 text-sm text-[#5a5a5a]">
                {`Are you sure you want to delete "${submittedTasks.find((task) => task.id === taskIdPendingDelete)?.text ?? ""}"?`}
              </p>
              <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="rounded-full border border-[#DDD3EB] bg-white px-4 py-2 text-sm font-medium text-[#2E2E2E] transition-colors hover:bg-[#F3EFFF]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="rounded-full bg-[#B91C1C] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#991B1B]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
