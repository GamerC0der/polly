import { createSignal, createMemo, createEffect, For, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { AVAILABLE_MODELS, filterModels } from "../models"

export type PromptRef = {
  focus(): void
  blur(): void
  set(text: string): void
  clear(): void
  submit(): void
}

export function Prompt(props: {
  ref?: (r: PromptRef) => void
  placeholder?: string
  disabled?: boolean
  onSubmit: (text: string) => void
  model?: string
  onAcVisibleChange?: (visible: boolean) => void
}) {
  const { theme } = useTheme()
  const [inputValue, setInputValue] = createSignal("")
  const [acSelected, setAcSelected] = createSignal(0)

  let inputRef: {
    focus: () => void
    blur: () => void
    setText: (s: string) => void
    clear: () => void
    plainText: string
    cursorOffset: number
    getTextRange: (start: number, end: number) => string
  } | null = null

  const modelAc = createMemo(() => {
    const val = inputValue()
    const match = val.match(/^\/model\s+(.*)$/i)
    if (!match) return null
    const query = match[1]
    const matches = filterModels(query)
    return { query, matches }
  })

  const acVisible = () => modelAc() !== null
  const acMatches = () => modelAc()?.matches ?? []
  const acShowing = () => acVisible() && acMatches().length > 0

  createEffect(() => props.onAcVisibleChange?.(acShowing()))

  const ref: PromptRef = {
    focus() {
      inputRef?.focus()
    },
    blur() {
      inputRef?.blur()
    },
    set(text: string) {
      inputRef?.setText(text)
    },
    clear() {
      inputRef?.clear()
    },
    submit() {
      if (inputRef?.plainText?.trim()) {
        props.onSubmit(inputRef.plainText.trim())
        inputRef?.clear()
      }
    },
  }

  return (
    <box position="relative">
      <Show when={acShowing()}>
        <box
          position="absolute"
          top="100%"
          left={0}
          right={0}
          zIndex={100}
          marginTop={1}
          border={["all"]}
          borderColor={theme.border}
          backgroundColor={theme.backgroundPanel}
        >
          <box maxHeight={6} overflow="hidden">
            <For each={acMatches()}>
              {(model, i) => (
                <box
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={i() === acSelected() ? theme.primary : undefined}
                >
                  <text fg={i() === acSelected() ? theme.background : theme.text}>{model}</text>
                </box>
              )}
            </For>
          </box>
        </box>
      </Show>
      <box
        border={["all"]}
        borderColor={theme.border}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        backgroundColor={theme.backgroundElement}
      >
        <textarea
          focused
          placeholder={props.placeholder ?? "Ask Anything... Prompt Me!"}
          textColor={theme.text}
          focusedTextColor={theme.text}
          minHeight={1}
          maxHeight={6}
          keyBindings={[
            { name: "return", shift: true, action: "newline" },
            { name: "return", action: "submit" },
          ]}
          onContentChange={() => {
            setInputValue(inputRef?.plainText ?? "")
            setAcSelected(0)
          }}
          onKeyDown={(e) => {
            if (!acShowing()) return
            const complete = () => {
              const matches = acMatches()
              const sel = acSelected()
              if (matches[sel] !== undefined && inputRef) {
                const val = inputRef.plainText
                const before = val.replace(/\/model\s+.*$/i, `/model ${matches[sel]} `)
                inputRef.setText(before)
                setInputValue(before)
                setAcSelected(0)
              }
            }
            if (e.name === "tab") {
              e.preventDefault()
              complete()
              return
            }
            if (e.name === "return" && !e.shift) {
              e.preventDefault()
              complete()
              ref.submit()
              return
            }
            if (e.name === "up" || e.name === "down") {
              e.preventDefault()
              const n = acMatches().length
              setAcSelected((s) => (e.name === "up" ? (s - 1 + n) % n : (s + 1) % n))
            }
          }}
          onSubmit={() => ref.submit()}
          ref={(r: unknown) => {
            const textarea = r as typeof inputRef
            inputRef = textarea
            if (textarea) props.ref?.(ref)
          }}
          focusedBackgroundColor={theme.backgroundElement}
          cursorColor={theme.text}
        />
        <box flexDirection="row" flexShrink={0} paddingTop={1} gap={2}>
          <text fg={theme.accent}>{props.model ?? "Polly"}</text>
          <text fg={theme.textMuted}>↵ send · Tab complete</text>
        </box>
      </box>
    </box>
  )
}
