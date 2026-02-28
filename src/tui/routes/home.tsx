import { Prompt, type PromptRef } from "../component/prompt"
import { createSignal, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { Logo } from "../component/logo"
import { Tips } from "../component/tips"

export function Home(props: {
  promptRef: (r: PromptRef) => void
  onSubmit: (text: string) => void
  model: string
  directory: string
  hasConfig: boolean
  placeholder?: string
}) {
  const { theme } = useTheme()
  const [acVisible, setAcVisible] = createSignal(false)
  let prompt: PromptRef

  onMount(() => {
    props.promptRef(prompt)
  })

  return (
    <box flexDirection="column" flexGrow={1} minHeight={0} paddingLeft={2} paddingRight={2}>
      <box flexDirection="row" justifyContent="flex-end" flexShrink={0} paddingTop={1} paddingRight={1} gap={2}>
        <text fg={theme.textMuted}>{props.directory}</text>
        <text fg={theme.textMuted}>
          {props.hasConfig ? "● configured" : "● run /connect to configure"}
        </text>
        <text fg={theme.textMuted}>Polly</text>
      </box>
      <box flexGrow={1} minHeight={0} />
      <box flexShrink={0} alignItems="center" flexDirection="column" gap={1}>
        <Logo />
        <box width="100%" maxWidth={70} paddingTop={2}>
          <Prompt
            ref={(r) => {
              prompt = r
              props.promptRef(prompt)
            }}
            model={props.model}
            placeholder={props.placeholder}
            onSubmit={props.onSubmit}
            onAcVisibleChange={setAcVisible}
          />
        </box>
        <Show when={!acVisible()}>
          <box width="100%" maxWidth={70} paddingTop={2}>
            <Tips />
          </box>
        </Show>
      </box>
      <box flexGrow={1} minHeight={0} />
    </box>
  )
}
