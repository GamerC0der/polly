import { createSignal, createEffect, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { connectWithPollinations } from "../../pollinations-auth"

export function ConnectModal(props: {
  onClose: () => void
  onConnected: (key: string) => void | Promise<void>
  onStateChange?: (s: { authUrl: string; status: "connecting" | "error"; errorMsg: string }) => void
}) {
  const { theme } = useTheme()
  const [status, setStatus] = createSignal<"connecting" | "error">("connecting")
  const [errorMsg, setErrorMsg] = createSignal("")
  const [authUrl, setAuthUrl] = createSignal("")

  createEffect(() => {
    props.onStateChange?.({ authUrl: authUrl(), status: status(), errorMsg: errorMsg() })
  })
  onMount(() => {
    setStatus("connecting")
    connectWithPollinations((url) => setAuthUrl(url))
      .then(async (key) => {
        await props.onConnected(key)
      })
      .catch((err) => {
        setStatus("error")
        setErrorMsg(err instanceof Error ? err.message : "Connection failed")
      })
  })

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      alignItems="center"
      justifyContent="center"
      backgroundColor={theme.background}
      zIndex={1000}
    >
      <box
        width={72}
        border={["all"]}
        borderColor={theme.border}
        backgroundColor={theme.backgroundPanel}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={2}
        paddingBottom={2}
        flexDirection="column"
        gap={1}
      >
        <text fg={theme.accent} attributes={1}>
          Connect with Pollinations
        </text>
        <Show when={status() === "connecting"}>
          <text fg={theme.text}>
            Auth URL copied to clipboard. Paste in browser, sign in, then return here.
          </text>
          <Show when={authUrl()}>
            <text fg={theme.textMuted}>
              {authUrl()}
            </text>
          </Show>
        </Show>
        <Show when={status() === "error"}>
          <text fg={theme.text}>{errorMsg()}</text>
        </Show>
        <text fg={theme.textMuted}>
          Escape to close
        </text>
      </box>
    </box>
  )
}
