import { For, createMemo, createEffect, createSignal } from "solid-js"
import { useTheme } from "../context/theme"
import { Prompt, type PromptRef } from "../component/prompt"
import { useTerminalDimensions } from "@opentui/solid"
import type { ScrollBoxRenderable } from "@opentui/core"

export type ToolCall = { cmd: string; result?: string; status: "running" | "done" }
export type Message = { role: "user" | "assistant" | "system"; content: string; toolCalls?: ToolCall[] }

export function Session(props: {
  messages: Message[]
  promptRef: (r: PromptRef) => void
  onSubmit: (text: string) => void
  model: string
  directory: string
  inFlight: boolean
}) {
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const [scrollRef, setScrollRef] = createSignal<ScrollBoxRenderable | null>(null)

  const displayMessages = createMemo(() =>
    props.messages.filter((m) => m.role !== "system")
  )

  createEffect(() => {
    const msgs = displayMessages()
    const last = msgs[msgs.length - 1]
    const tc = last?.toolCalls ?? []
    const _ = JSON.stringify(tc)
    if (tc.length > 0 && scrollRef()) {
      queueMicrotask(() => {
        try {
          scrollRef()!.scrollTo({ y: scrollRef()!.scrollHeight })
        } catch {}
      })
    }
  })

  let prompt: PromptRef

  return (
    <box flexGrow={1} flexDirection="column" minHeight={0}>
      <box flexDirection="row" justifyContent="flex-end" flexShrink={0} paddingTop={1} paddingRight={2} gap={2}>
        <text fg={theme.textMuted}>{props.directory}</text>
        <text fg={theme.textMuted}>{props.model}</text>
      </box>
      <box flexGrow={1} minHeight={0} paddingLeft={2} paddingRight={2} paddingTop={1}>
        <scrollbox
          ref={setScrollRef}
          flexGrow={1}
          height={dimensions().height - 14}
          scrollbarOptions={{ visible: false }}
        >
          <box flexDirection="column" gap={1}>
            <For each={displayMessages()}>
              {(msg) => (
                <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingBottom={1}>
                  <text fg={msg.role === "user" ? theme.primary : theme.secondary} attributes={1}>
                    {msg.role === "user" ? "you" : "polly"}
                  </text>
                  {msg.content ? <text fg={theme.text}>{msg.content}</text> : null}
                  <For each={msg.toolCalls ?? []}>
                    {(tc) => (
                      <box flexDirection="column" paddingLeft={2} paddingTop={1} paddingBottom={1}>
                        <text fg={theme.textMuted}>terminal: $ {tc.cmd}</text>
                        <text fg={theme.text}>
                          {tc.status === "running" ? "Generating..." : tc.result ?? ""}
                        </text>
                      </box>
                    )}
                  </For>
                </box>
              )}
            </For>
            {props.inFlight && (() => {
              const msgs = displayMessages()
              const last = msgs[msgs.length - 1]
              return !last || (last.role === "assistant" && !last.content?.trim())
            })() && (
              <box paddingLeft={1}>
                <text fg={theme.textMuted}>polly: thinking...</text>
              </box>
            )}
          </box>
        </scrollbox>
      </box>
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} flexShrink={0}>
        <Prompt
          ref={(r) => {
            prompt = r
            props.promptRef(prompt)
          }}
          model={props.model}
          onSubmit={props.onSubmit}
          disabled={props.inFlight}
        />
      </box>
    </box>
  )
}
