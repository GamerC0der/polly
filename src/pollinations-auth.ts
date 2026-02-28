import { createServer } from "node:http";
import { platform } from "node:os";

const AUTH_URL = "https://enter.pollinations.ai/authorize";
const MODELS = "openai-large,claude-fast,glm,kimi";
const PERMISSIONS = "profile,balance";

function copyToClipboard(text: string): void {
  const args = platform() === "darwin" ? ["pbcopy"] : platform() === "win32" ? ["clip"] : ["xclip", "-selection", "clipboard"];
  try {
    const proc = Bun.spawn(args, { stdin: "pipe", stdio: ["pipe", "ignore", "ignore"] });
    proc.stdin?.write(text);
    proc.stdin?.end();
  } catch {}
}

const CALLBACK_HTML = `
<!DOCTYPE html>
<html>
<head><title>Polly - Connect</title></head>
<body style="font-family:system-ui;max-width:480px;margin:4rem auto;padding:2rem;text-align:center">
  <p id="msg">Completing sign-in...</p>
  <script>
    const hash = location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const apiKey = params.get('api_key');
    if (apiKey) {
      fetch('/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey })
      }).then(() => {
        document.getElementById('msg').textContent = 'Success! You can close this window and return to Polly.';
      }).catch(() => {
        document.getElementById('msg').textContent = 'Failed to save key. Please try again.';
      });
    } else {
      document.getElementById('msg').textContent = 'No API key received. Please try connecting again.';
    }
  </script>
</body>
</html>
`;

export function connectWithPollinations(onUrlReady?: (url: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const port = 34567 + Math.floor(Math.random() * 1000);
    const redirectUrl = `http://127.0.0.1:${port}`;
    const authLink = `${AUTH_URL}?redirect_url=${encodeURIComponent(redirectUrl)}&permissions=${PERMISSIONS}&models=${encodeURIComponent(MODELS)}`;

    onUrlReady?.(authLink);
    copyToClipboard(authLink);

    let resolved = false;
    const done = (key: string) => {
      if (resolved) return;
      resolved = true;
      server.close();
      resolve(key);
    };
    const fail = (err: Error) => {
      if (resolved) return;
      resolved = true;
      server.close();
      reject(err);
    };

    const server = createServer((req, res) => {
      if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(CALLBACK_HTML);
        return;
      }
      if (req.method === "POST" && req.url === "/key") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const data = JSON.parse(body) as { api_key?: string };
            const key = data?.api_key?.trim();
            if (key) {
              res.writeHead(200, { "Content-Type": "text/plain" });
              res.end("OK");
              done(key);
            } else {
              res.writeHead(400);
              res.end("Missing api_key");
            }
          } catch {
            res.writeHead(400);
            res.end("Invalid JSON");
          }
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });

    server.listen(port, "127.0.0.1");

    server.on("error", fail);
  });
}
