import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";

export interface Tool {
  name: string;
  usage: string;
  description: string;
  execute(args: string): Promise<string>;
}

function runShell(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      cwd: process.cwd(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      const out = stdout.trim();
      const err = stderr.trim();
      if (code !== 0) {
        resolve(`exit ${code}${err ? `\nstderr: ${err}` : ""}${out ? `\nstdout: ${out}` : ""}`);
      } else {
        resolve(out || "(no output)");
      }
    });
    child.on("error", (e) => reject(e));
  });
}

const tools: Record<string, Tool> = {
  shell: {
    name: "shell",
    usage: "/run shell <command>",
    description: "Run a terminal command. Use for: mkdir, touch, cat, ls, wc -l, echo, etc.",
    async execute(args) {
      const cmd = args.trim();
      if (!cmd) return "Usage: /run shell <command>";
      return runShell(cmd);
    },
  },
  now: {
    name: "now",
    usage: "/run now",
    description: "Returns current local and UTC timestamp.",
    async execute() {
      const now = new Date();
      return `Local: ${now.toLocaleString()}\nUTC: ${now.toISOString()}`;
    },
  },
  hash: {
    name: "hash",
    usage: "/run hash <text>",
    description: "Calculates SHA-256 of the text and returns the digest.",
    async execute(args) {
      const value = args.trim() || "polly-cli";
      return createHash("sha256").update(value).digest("hex");
    },
  },
  uuid: {
    name: "uuid",
    usage: "/run uuid",
    description: "Creates a random RFC4122 UUID for your notes.",
    async execute() {
      return randomUUID();
    },
  },
  lines: {
    name: "lines",
    usage: "/run lines <text>",
    description: "Counts characters, words, and lines in input text.",
    async execute(args) {
      const text = args.trim() || "";
      const charCount = text.length;
      const wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      const lineCount = text ? text.split("\n").length : 0;
      return `characters=${charCount}, words=${wordCount}, lines=${lineCount}`;
    },
  },
};

export function listTools(): Tool[] {
  return Object.values(tools);
}

export function getTool(name: string): Tool | undefined {
  return tools[name];
}
