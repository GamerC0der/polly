import { useTerminalDimensions, useRenderer, useKeyboard } from "@opentui/solid"
import { Switch, Match, createSignal, onMount } from "solid-js"
import { ThemeProvider, useTheme } from "./context/theme"
import { HelpModal } from "./component/help-modal"
import { ConnectModal } from "./component/connect-modal"
import { Home } from "./routes/home"
import { Session, type Message } from "./routes/session"
import { chatOnce } from "../api"
import { loadConfig, saveConfig, hasConfig, BASE_URL } from "../config"
import { getTool, listTools } from "../tools"
import type { SurfConfig } from "../types"

const DEFAULT_MODEL = "gpt-5.2"
const AVAILABLE_MODELS = ["gpt-5.2", "claude-4.5-haiku", "glm-5", "kimi-k2.5"] as const
const MAX_CONTEXT = 24

const systemPrompt = `
You are "Polly", a practical AI coding assistant. To run terminal commands, output them in this exact format:

\`\`\`terminal
<command>
\`\`\`

Examples:
- List files: \`\`\`terminal\nls -la\n\`\`\`
- Create folder: \`\`\`terminal\nmkdir -p test\n\`\`\`
- View file: \`\`\`terminal\ncat file.txt\n\`\`\`

The command will be executed and the output returned to you. You can then respond with more text or another terminal block. Keep going until the task is done.
`.trim()

export function App(props: { mode: "dark" | "light" }) {
  return (
    <ThemeProvider mode={props.mode}>
      <AppInner mode={props.mode} />
    </ThemeProvider>
  )
}

function AppInner(props: { mode: "dark" | "light" }) {
  const dimensions = useTerminalDimensions()
  const renderer = useRenderer()
  const { theme } = useTheme()
  const [config, setConfig] = createSignal<SurfConfig>({ apiKey: "", baseUrl: BASE_URL })
  const [messages, setMessages] = createSignal<Message[]>([])
  const [model, setModel] = createSignal(DEFAULT_MODEL)
  const [showConnectModal, setShowConnectModal] = createSignal(false)
  const [inFlight, setInFlight] = createSignal(false)
  const [showHelpModal, setShowHelpModal] = createSignal(false)

  useKeyboard((e) => {
    if (e.name === "escape" && showHelpModal()) setShowHelpModal(false)
    if (e.name === "escape" && showConnectModal()) setShowConnectModal(false)
  })

  const directory = process.cwd()
  const history = () => messages().filter((m) => m.role !== "system")

  onMount(() => {
    renderer.disableStdoutInterception?.()
  })

  onMount(async () => {
    const cfg = await loadConfig()
    setConfig(cfg)
    if (!hasConfig(cfg)) {
      setShowConnectModal(true)
    }
    setMessages([{ role: "system", content: systemPrompt }, { role: "system", content: "Tip: /help for commands." }])
  })

  const handleSubmit = async (text: string) => {
    const cfg = config()
    const lower = text.trim().toLowerCase()

    if (lower === "/help") {
      setShowHelpModal(true)
      return
    }

    if (lower === "/connect" || lower === "/key") {
      setShowConnectModal(true)
      return
    }

    if (lower === "/quit" || lower === "/exit") {
      process.exit(0)
    }

    if (lower.startsWith("/tool list")) {
      const toolList = listTools().map((t) => ` ${t.name} - ${t.description}`)
      setMessages((m) => [...m, { role: "system", content: "Available tools:\n" + toolList.join("\n") }])
      return
    }

    if (lower === "/clear") {
      setMessages([{ role: "system", content: systemPrompt }])
      return
    }

    if (lower.startsWith("/model")) {
      const parts = text.trim().split(/\s+/)
      const arg = parts[1]?.toLowerCase()
      if (arg) {
        const valid = AVAILABLE_MODELS.find((m) => m.toLowerCase() === arg)
        if (valid) {
          setModel(valid)
          setMessages((m) => [...m, { role: "system", content: `Model set to ${valid}.` }])
        } else {
          setMessages((m) => [
            ...m,
            {
              role: "system",
              content: `Unknown model: ${parts[1]}. Available: ${AVAILABLE_MODELS.join(", ")}`,
            },
          ])
        }
      } else {
        const list = AVAILABLE_MODELS.map((m) => (m === model() ? `  ${m} (current)` : `  ${m}`)).join("\n")
        setMessages((m) => [...m, { role: "system", content: `Models:\n${list}\nUse /model <name> to switch.` }])
      }
      return
    }

    if (lower.startsWith("/run ")) {
      const parts = text.trim().split(/\s+/)
      const name = parts[1]
      const tool = getTool(name)
      if (!tool) {
        setMessages((m) => [...m, { role: "system", content: `Unknown tool: ${name}` }])
        return
      }
      const output = await tool.execute(parts.slice(2).join(" "))
      setMessages((m) => [...m, { role: "assistant", content: output }])
      return
    }

    if (!hasConfig(cfg)) {
      setShowConnectModal(true)
      return
    }

    if (inFlight()) return

    const userMsg: Message = { role: "user", content: text.trim() }
    setMessages((m) => {
      const next = [...m.filter((x) => x.role !== "system"), userMsg]
      if (next.length > MAX_CONTEXT + 1) next.splice(1, 1)
      return [{ role: "system", content: systemPrompt }, ...next]
    })
    setInFlight(true)

    try {
      let msgs: { role: "user" | "assistant" | "system"; content: string }[] = [
        { role: "system" as const, content: systemPrompt },
        ...history().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ]
      let content = ""
      setMessages((m) => [...m, { role: "assistant", content: "" }])
      const update = (s: string, tools?: Message["toolCalls"]) => {
        content = s
        setMessages((m) => {
          const c = [...m]
          const last = c[c.length - 1]
          if (last?.role === "assistant")
            c[c.length - 1] = { ...last, content: s, toolCalls: tools ?? last.toolCalls }
          return c
        })
      }
      const shellTool = getTool("shell")
      const TERMINAL_RE = /```terminal\n([\s\S]*?)```/
      const maxRounds = 8
      let toolCalls: NonNullable<Message["toolCalls"]> = []

      for (let round = 0; round < maxRounds; round++) {
        const response = await chatOnce(msgs, cfg, model(), {
          onContent: (chunk) => {
            content += chunk
            const m = content.match(TERMINAL_RE)
            const display = m ? content.replace(TERMINAL_RE, "").trim() : content
            const tools = m ? [...toolCalls, { cmd: m[1].trim(), status: "running" as const }] : toolCalls
            update(display, tools)
          },
        })
        content = (response || content).trim()
        const match = content.match(TERMINAL_RE)
        if (!match || !shellTool) {
          if (content) update(content, toolCalls)
          break
        }
        const cmd = match[1].trim()
        content = content.replace(TERMINAL_RE, "").trim()
        toolCalls = [...toolCalls, { cmd, status: "running" }]
        update(content, toolCalls)
        const result = await shellTool.execute(cmd)
        toolCalls = [...toolCalls.slice(0, -1), { cmd, result, status: "done" }]
        update(content, toolCalls)
        const resultMsg = `[Command output]\n\n$ ${cmd}\n${result}`
        msgs = [...msgs, { role: "assistant" as const, content }, { role: "user" as const, content: resultMsg }]
        setMessages((m) => {
          const c = [...m]
          const last = c[c.length - 1]
          if (last?.role === "assistant") c[c.length - 1] = { ...last, content, toolCalls }
          return c
        })
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: err instanceof Error ? err.message : "Request failed." }])
    } finally {
      setInFlight(false)
    }
  }

  const showSession = () => history().length > 0

  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      flexDirection="column"
      flexGrow={1}
      minHeight={0}
      backgroundColor={theme.background}
      position="relative"
    >
      <box flexGrow={1} flexDirection="column" minHeight={0}>
        <Switch>
          <Match when={!showSession()}>
            <Home
            promptRef={() => {}}
            onSubmit={handleSubmit}
            model={model()}
            directory={directory}
            hasConfig={hasConfig(config())}
            placeholder={
              !hasConfig(config())
                ? "Connect with Pollinations first (see /help)"
                : undefined
            }
          />
          </Match>
          <Match when={showSession()}>
            <Session
              messages={messages()}
              promptRef={() => {}}
              onSubmit={handleSubmit}
              model={model()}
              directory={directory}
              inFlight={inFlight()}
            />
          </Match>
        </Switch>
      </box>
      <HelpModal visible={showHelpModal()} onClose={() => setShowHelpModal(false)} />
      {showConnectModal() && (
        <ConnectModal
          onClose={() => setShowConnectModal(false)}
          onConnected={async (key) => {
            const newConfig = { ...config(), apiKey: key, baseUrl: BASE_URL }
            setConfig(newConfig)
            await saveConfig(newConfig)
            setShowConnectModal(false)
          }}
        />
      )}
    </box>
  )
}
