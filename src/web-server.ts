const PORT = 35066
const HOST = "127.0.0.1"

export type WebState = {
  messages: { role: string; content: string; toolCalls?: { cmd: string; result?: string; status: string }[] }[]
  model: string
  dir: string
  hasConfig: boolean
  inFlight: boolean
  placeholder?: string
  showHelpModal: boolean
  showConnectModal: boolean
  showCustomModelModal: boolean
  showModelSelectorModal: boolean
  connectAuthUrl?: string
  connectStatus?: "connecting" | "error"
  connectErrorMsg?: string
  theme: string
}

let server: ReturnType<typeof Bun.serve> | null = null
let getStatus: () => { dir: string; hasConfig: boolean } = () => ({
  dir: process.cwd(),
  hasConfig: false,
})
let getState: (() => WebState) | null = null
let onSubmit: ((text: string) => void) | null = null
let onWebAction: ((action: string, value?: string) => void) | null = null
const wsClients: Set<{ send: (data: string) => void }> = new Set()

export function broadcastState(state: WebState): void {
  const msg = JSON.stringify(state)
  for (const client of wsClients) {
    try {
      client.send(msg)
    } catch {}
  }
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Polly</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0a;--bg-panel:#141414;--bg-el:#1e1e1e;--border:#484848;--text:#eeeeee;--text-muted:#808080;--primary:#fab283;--secondary:#5c9cf5;--accent:#9d7cd8;--logo:#e5c07b;--warning:#f5a742;--overlay:rgba(10,10,10,0.95)}
body{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:14px;line-height:1.4;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column}
.app{display:flex;flex-direction:column;flex:1;min-height:0;padding:0 16px}
.header{display:flex;justify-content:flex-end;gap:16px;padding:8px 8px 0 0;flex-shrink:0;color:var(--text-muted)}
.main{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 0}
.main .prompt-wrap,.main .tips{width:100%;max-width:560px}
.logo-box{background:var(--bg-panel);border:1px solid var(--border);padding:8px 24px;margin-bottom:16px}
.logo-line{color:var(--logo);font-weight:bold;white-space:pre}
.prompt-wrap{position:relative;width:100%}
.prompt-box{border:1px solid var(--border);background:var(--bg-el);padding:8px 16px;width:100%}
.prompt-box textarea{width:100%;min-height:24px;max-height:96px;background:transparent;border:none;color:var(--text);font:inherit;resize:none;outline:none}
.prompt-box textarea::placeholder{color:var(--text-muted)}
.prompt-box textarea:disabled{opacity:0.7;cursor:not-allowed}
.prompt-footer{display:flex;gap:16px;padding-top:8px;color:var(--accent);font-size:12px}
.prompt-footer span:last-child{color:var(--text-muted)}
.ac-dropdown{position:absolute;top:100%;left:0;right:0;margin-top:4px;background:var(--bg-panel);border:1px solid var(--border);max-height:96px;overflow:auto;z-index:100}
.ac-item{padding:4px 8px;cursor:pointer}
.ac-item.sel{background:var(--primary);color:var(--bg)}
.tips{width:100%;margin-top:16px;display:flex;gap:4px;color:var(--warning)}
.tips .tip-muted{color:var(--text-muted)}
.session{flex:1;display:flex;flex-direction:column;min-height:0;padding:8px 16px}
.session-header{display:flex;justify-content:flex-end;gap:16px;padding:8px 16px 0 0;color:var(--text-muted);flex-shrink:0}
.messages{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px}
.msg{display:flex;flex-direction:column;padding:4px 8px 8px}
.msg-role{color:var(--primary);font-weight:bold}
.msg-role.polly{color:var(--secondary)}
.msg-content{color:var(--text);white-space:pre-wrap;word-break:break-word}
.msg-tool{padding-left:16px;padding:4px 0;color:var(--text-muted)}
.thinking{color:var(--text-muted);padding:4px 8px}
.prompt-area{padding:8px 0 8px;flex-shrink:0;width:100%}
body.session-active .session .prompt-wrap{max-width:none}
.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:var(--overlay);display:flex;align-items:center;justify-content:center;z-index:1000}
.modal-box{background:var(--bg-panel);border:1px solid var(--border);padding:16px;max-width:400px;width:90%}
.modal-title{color:var(--accent);font-weight:bold;margin-bottom:12px}
.modal-text{color:var(--text);margin:8px 0}
.modal-muted{color:var(--text-muted);margin-top:12px;font-size:12px}
.modal-input{width:100%;background:var(--bg-el);border:1px solid var(--border);color:var(--text);padding:8px;font:inherit;margin:8px 0}
.modal-list{max-height:120px;overflow:auto}
.modal-item{padding:8px;cursor:pointer;border-radius:2px}
.modal-item:hover,.modal-item.sel{background:var(--primary);color:var(--bg)}
.hidden{display:none}
</style>
</head>
<body>
<div class="app">
<div class="header"><span class="dir"></span><span class="config"></span><span>Polly</span></div>
<div class="main" id="home">
<div class="logo-box">
<pre class="logo-line">██████   ██████  ██      ██      ██    ██</pre>
<pre class="logo-line">██   ██ ██    ██ ██      ██       ██  ██</pre>
<pre class="logo-line">██████  ██    ██ ██      ██        ████</pre>
<pre class="logo-line">██      ██    ██ ██      ██         ██</pre>
<pre class="logo-line">██       ██████  ███████ ███████    ██</pre>
</div>
<div class="prompt-wrap">
<div class="ac-dropdown hidden" id="ac"></div>
<div class="prompt-box">
<textarea id="input" rows="1"></textarea>
<div class="prompt-footer"><span id="model">Polly</span><span>↵ send · Tab complete</span></div>
</div>
</div>
<div class="tips" id="tips"><span>● Tip</span><span class="tip-muted">Type /help for commands.</span></div>
</div>
<div class="session hidden" id="session">
<div class="session-header"><span class="dir"></span><span id="session-model">Polly</span></div>
<div class="messages" id="messages"></div>
<div class="thinking hidden" id="thinking">polly: thinking...</div>
<div class="prompt-area">
<div class="prompt-wrap">
<div class="ac-dropdown hidden" id="ac-session"></div>
<div class="prompt-box">
<textarea id="session-input" rows="1"></textarea>
<div class="prompt-footer"><span id="session-model-label">Polly</span><span>↵ send · Tab complete</span></div>
</div>
</div>
</div>
</div>
<div class="modal-overlay hidden" id="help-modal"><div class="modal-box"><div class="modal-title">Help</div><div class="modal-text">Use /model to switch models — type /model and Tab to autocomplete. Use /model custom for any model from enter.pollinations.ai</div><div class="modal-text">Run the polly cli in a folder in order to code in that folder.</div><div class="modal-text">The AI can run terminal commands: create files, folders, view content, line counts, etc.</div><div class="modal-text">Use /connect to connect with Pollinations (BYOP). /logout to disconnect.</div><div class="modal-text">Use /theme &lt;dark|warm|cool|minimal&gt; to switch themes.</div><div class="modal-text">Use /web to open a web UI clone at http://127.0.0.1:35066/</div><div class="modal-muted">Press Escape to close</div></div></div>
<div class="modal-overlay hidden" id="connect-modal"><div class="modal-box"><div class="modal-title">Connect with Pollinations</div><div class="modal-text" id="connect-msg">Auth URL copied to clipboard. Paste in browser, sign in, then return here.</div><div class="modal-muted" id="connect-url"></div><div class="modal-muted">Escape to close</div></div></div>
<div class="modal-overlay hidden" id="custom-modal"><div class="modal-box"><div class="modal-title">Custom Model</div><div class="modal-text">Find the model on enter.pollinations.ai !</div><input type="text" class="modal-input" id="custom-model-input" placeholder="e.g. minimax"/><div class="modal-muted">Enter to set · Escape to close</div></div></div>
<div class="modal-overlay hidden" id="model-selector-modal"><div class="modal-box"><div class="modal-title">Select Model</div><div class="modal-list" id="model-list"></div><div class="modal-muted">Enter to select · Escape to close</div></div></div>
<script>
(function(){
var COMMANDS=["connect","clear","help","model","quit","theme","web"];
var MODELS=["gpt-5.2","claude-4.5-haiku","glm-5","kimi-k2.5","custom"];
var THEMES=["dark","warm","cool","minimal"];
var THEME_COLORS={dark:{bg:"#0a0a0a",bgPanel:"#141414",bgEl:"#1e1e1e",border:"#484848",text:"#eeeeee",textMuted:"#808080",primary:"#fab283",secondary:"#5c9cf5",accent:"#9d7cd8",logo:"#e5c07b",warning:"#f5a742"},warm:{bg:"#282828",bgPanel:"#3c3836",bgEl:"#504945",border:"#665c54",text:"#ebdbb2",textMuted:"#928374",primary:"#83a598",secondary:"#d3869b",accent:"#8ec07c",logo:"#d79921",warning:"#fe8019"},cool:{bg:"#2E3440",bgPanel:"#3B4252",bgEl:"#434C5E",border:"#4C566A",text:"#ECEFF4",textMuted:"#8B95A7",primary:"#88C0D0",secondary:"#81A1C1",accent:"#8FBCBB",logo:"#EBCB8B",warning:"#D08770"},minimal:{bg:"#0d0d0d",bgPanel:"#1a1a1a",bgEl:"#262626",border:"#404040",text:"#e5e5e5",textMuted:"#737373",primary:"#d4d4d4",secondary:"#a3a3a3",accent:"#d4d4d4",logo:"#d4d4d4",warning:"#a3a3a3"}};
function applyTheme(name){var t=THEME_COLORS[name]||THEME_COLORS.dark;var r=document.documentElement.style;r.setProperty("--bg",t.bg);r.setProperty("--bg-panel",t.bgPanel);r.setProperty("--bg-el",t.bgEl);r.setProperty("--border",t.border);r.setProperty("--text",t.text);r.setProperty("--text-muted",t.textMuted);r.setProperty("--primary",t.primary);r.setProperty("--secondary",t.secondary);r.setProperty("--accent",t.accent);r.setProperty("--logo",t.logo);r.setProperty("--warning",t.warning);var m=t.bg.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);r.setProperty("--overlay",m?"rgba("+parseInt(m[1],16)+","+parseInt(m[2],16)+","+parseInt(m[3],16)+",0.95)":"rgba(10,10,10,0.95)")}
function filterCommands(q){q=q.toLowerCase().trim();return q?COMMANDS.filter(function(c){return c.startsWith(q)}):COMMANDS.slice()}
function filterModels(q){q=q.toLowerCase().trim();return q?MODELS.filter(function(m){return m.toLowerCase().includes(q)}):MODELS.slice()}
function filterThemes(q){q=q.toLowerCase().trim();return q?THEMES.filter(function(t){return t.startsWith(q)}):THEMES.slice()}
function getAc(val){var m=val.match(/^\\/model\\s+(.*)$/i);if(m)return{type:"model",matches:filterModels(m[1])};var t=val.match(/^\\/theme\\s+(.*)$/i);if(t)return{type:"theme",matches:filterThemes(t[1])};var c=val.match(/^\\/(\\S*)$/);if(c)return{type:"cmd",matches:filterCommands(c[1])};return null}
function renderAc(ac,sel,el){el.innerHTML="";el.classList.remove("hidden");ac.matches.forEach(function(m,i){var d=document.createElement("div");d.className="ac-item"+(i===sel?" sel":"");d.textContent=m;el.appendChild(d)})}
function applyComplete(inp,ac,sel){var val=inp.value;var before;if(ac.type==="model")before=val.replace(/\\/model\\s+.*$/i,"/model "+ac.matches[sel]+" ");else if(ac.type==="theme")before=val.replace(/\\/theme\\s+.*$/i,"/theme "+ac.matches[sel]+" ");else before=val.replace(/^\\/(\\S*)$/,"/"+ac.matches[sel]+" ");inp.value=before;inp.dispatchEvent(new Event("input",{bubbles:true}))}
var home=document.getElementById("home");var session=document.getElementById("session");var messages=document.getElementById("messages");var thinking=document.getElementById("thinking");
var input=document.getElementById("input");var sessionInput=document.getElementById("session-input");var acEl=document.getElementById("ac");var acSessionEl=document.getElementById("ac-session");var tipsEl=document.getElementById("tips");
var ws=null;
function connect(){var proto=location.protocol==="https:"?"wss:":"ws:";ws=new WebSocket(proto+"//"+location.host+"/ws");ws.onmessage=function(e){var s=JSON.parse(e.data);applyState(s)};ws.onclose=function(){setTimeout(connect,2000)};ws.onerror=function(){ws.close()}}
var MODELS_OPTIONS=["gpt-5.2","claude-4.5-haiku","glm-5","kimi-k2.5","custom"];
function sendAction(a,v){if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:"action",action:a,value:v}))}}
function applyState(s){applyTheme(s.theme||"dark");document.querySelectorAll(".dir").forEach(function(e){e.textContent=s.dir});document.querySelectorAll(".config").forEach(function(e){e.textContent=s.hasConfig?"● configured":"● run /connect to configure"});document.getElementById("model").textContent=s.model;document.getElementById("session-model").textContent=s.model;document.getElementById("session-model-label").textContent=s.model;var ph=s.placeholder||(s.hasConfig?"Ask Anything... Prompt Me!":"Connect with Pollinations first (see /help)");input.placeholder=ph;sessionInput.placeholder=ph;input.disabled=s.inFlight;sessionInput.disabled=s.inFlight;var histForThinking=s.messages.filter(function(m){return m.role!=="system"});var lastMsg=histForThinking[histForThinking.length-1];var showThinking=s.inFlight&&(!lastMsg||(lastMsg.role==="assistant"&&!(lastMsg.content||"").trim()));thinking.classList.toggle("hidden",!showThinking);document.getElementById("help-modal").classList.toggle("hidden",!s.showHelpModal);document.getElementById("connect-modal").classList.toggle("hidden",!s.showConnectModal);document.getElementById("custom-modal").classList.toggle("hidden",!s.showCustomModelModal);if(!s.showCustomModelModal){document.getElementById("custom-model-input").value=""}else{document.getElementById("custom-model-input").focus()}document.getElementById("model-selector-modal").classList.toggle("hidden",!s.showModelSelectorModal);if(s.showConnectModal){var cm=document.getElementById("connect-msg");var cu=document.getElementById("connect-url");cm.textContent=s.connectStatus==="error"?s.connectErrorMsg||"Connection failed":"Auth URL copied to clipboard. Paste in browser, sign in, then return here.";cu.textContent=s.connectAuthUrl||""}if(s.showModelSelectorModal){var ml=document.getElementById("model-list");var selIdx=MODELS_OPTIONS.indexOf(s.model);if(selIdx<0)selIdx=0;ml.innerHTML="";MODELS_OPTIONS.forEach(function(m,i){var d=document.createElement("div");d.className="modal-item"+(i===selIdx?" sel":"");d.textContent=m+(m===s.model?" (current)":"");d.onclick=function(){sendAction("selectModel",m)};d.dataset.idx=i;ml.appendChild(d)});window._modelSelIdx=selIdx}var hist=s.messages.filter(function(m){return m.role!=="system"});messages.innerHTML="";hist.forEach(function(m){var d=document.createElement("div");d.className="msg";var r=document.createElement("div");r.className="msg-role "+(m.role==="user"?"":"polly");r.textContent=m.role==="user"?"you":"polly";d.appendChild(r);var c=document.createElement("div");c.className="msg-content";c.textContent=m.content;d.appendChild(c);(m.toolCalls||[]).forEach(function(tc){var t=document.createElement("div");t.className="msg-tool";var line1=document.createElement("div");line1.textContent="terminal: $ "+tc.cmd;t.appendChild(line1);var line2=document.createElement("div");line2.textContent=tc.status==="running"?"Generating...":tc.result||"";line2.className="msg-content";t.appendChild(line2);d.appendChild(t)});messages.appendChild(d)});messages.scrollTop=messages.scrollHeight;if(hist.length>0){home.classList.add("hidden");session.classList.remove("hidden");document.body.classList.add("session-active")}else{home.classList.remove("hidden");session.classList.add("hidden");document.body.classList.remove("session-active")}}
function sendSubmit(text){if(!text.trim())return;if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:"submit",text:text.trim()}))}}
function setupAc(inp,acContainer){var acSel=0;function update(){var val=inp.value;var ac=getAc(val);if(!ac||!ac.matches.length){acContainer.classList.add("hidden");tipsEl.classList.remove("hidden");return}acSel=0;tipsEl.classList.add("hidden");renderAc(ac,0,acContainer)}
inp.oninput=function(){update();inp.style.height="auto";inp.style.height=Math.min(inp.scrollHeight,96)+"px"};
inp.onkeydown=function(e){var val=inp.value;var ac=getAc(val);var show=ac&&ac.matches.length;if(show){if(e.key==="Tab"){e.preventDefault();applyComplete(inp,ac,acSel);return}if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();applyComplete(inp,ac,acSel);sendSubmit(inp.value.trim());inp.value="";update();return}if(e.key==="ArrowDown"){e.preventDefault();acSel=(acSel+1)%ac.matches.length;renderAc(ac,acSel,acContainer);return}if(e.key==="ArrowUp"){e.preventDefault();acSel=(acSel-1+ac.matches.length)%ac.matches.length;renderAc(ac,acSel,acContainer);return}}if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendSubmit(inp.value.trim());inp.value="";inp.style.height="auto"}}
acContainer.onmousedown=function(e){var item=e.target.closest(".ac-item");if(!item)return;var ac=getAc(inp.value);if(!ac)return;e.preventDefault();var idx=Array.from(acContainer.children).indexOf(item);if(idx>=0){applyComplete(inp,ac,idx);inp.focus();update()}}}
setupAc(input,acEl);setupAc(sessionInput,acSessionEl);
sessionInput.oninput=function(){sessionInput.style.height="auto";sessionInput.style.height=Math.min(sessionInput.scrollHeight,96)+"px"};
document.addEventListener("keydown",function(e){if(e.key==="Escape"){sendAction("closeModal");return}var ms=document.getElementById("model-selector-modal");if(!ms.classList.contains("hidden")){if(e.key==="ArrowDown"){e.preventDefault();window._modelSelIdx=((window._modelSelIdx||0)+1)%MODELS_OPTIONS.length;var items=ms.querySelectorAll(".modal-item");items.forEach(function(it,i){it.classList.toggle("sel",i===window._modelSelIdx)});return}if(e.key==="ArrowUp"){e.preventDefault();window._modelSelIdx=((window._modelSelIdx||0)-1+MODELS_OPTIONS.length)%MODELS_OPTIONS.length;var items=ms.querySelectorAll(".modal-item");items.forEach(function(it,i){it.classList.toggle("sel",i===window._modelSelIdx)});return}if(e.key==="Enter"){e.preventDefault();sendAction("selectModel",MODELS_OPTIONS[window._modelSelIdx||0]);return}}});
document.getElementById("custom-model-input").onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();var v=this.value.trim();if(v){sendAction("setCustomModel",v)}this.value=""}if(e.key==="Escape"){e.preventDefault();e.stopPropagation();sendAction("closeModal")}};
connect();
})();
</script>
</body>
</html>`

export function startWebServer(opts?: {
  getStatus?: () => { dir: string; hasConfig: boolean }
  getState?: () => WebState
  onSubmit?: (text: string) => void
  onWebAction?: (action: string, value?: string) => void
}): boolean {
  if (opts?.getStatus) getStatus = opts.getStatus
  if (opts?.getState) getState = opts.getState
  if (opts?.onSubmit) onSubmit = opts.onSubmit
  if (opts?.onWebAction) onWebAction = opts.onWebAction
  if (server) return false
  server = Bun.serve({
    hostname: HOST,
    port: PORT,
    fetch(req, server) {
      const u = new URL(req.url)
      if (u.pathname === "/ws") {
        const ok = server.upgrade(req, { data: {} })
        return ok ? undefined : new Response("Expected WebSocket", { status: 400 })
      }
      if (u.pathname === "/status") {
        const s = getStatus()
        return new Response(JSON.stringify(s), { headers: { "Content-Type": "application/json" } })
      }
      if (u.pathname === "/" || !u.pathname.includes(".")) {
        return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
      }
      return new Response("Not found", { status: 404 })
    },
    websocket: {
      open(ws) {
        wsClients.add(ws)
        if (getState) {
          try {
            ws.send(JSON.stringify(getState()))
          } catch {}
        }
      },
      close(ws) {
        wsClients.delete(ws)
      },
      message(ws, msg) {
        try {
          const data = JSON.parse(msg as string)
          if (data.type === "submit" && typeof data.text === "string" && onSubmit) {
            onSubmit(data.text)
          } else if (data.type === "action" && onWebAction) {
            onWebAction(data.action, data.value)
          }
        } catch {}
      },
    },
  })
  return true
}

export function getWebUrl(): string {
  return `http://${HOST}:${PORT}/`
}
