import { Show } from "solid-js"
import { useTheme } from "../context/theme"

export function HelpModal(props: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme()

  return (
    <Show when={props.visible}>
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
          width={50}
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
            Help
          </text>
          <text fg={theme.text}>
            Use /model to switch models — type /model and Tab to autocomplete. Use /model custom for any model from enter.pollinations.ai
          </text>
          <text fg={theme.text}>
            Run the polly cli in a folder in order to code in that folder.
          </text>
          <text fg={theme.text}>
            The AI can run terminal commands: create files, folders, view content, line counts, etc.
          </text>
          <text fg={theme.text}>
            Use /connect to connect with Pollinations (BYOP). /logout to disconnect.
          </text>
          <box paddingTop={1}>
            <text fg={theme.textMuted}>Press Escape to close</text>
          </box>
        </box>
      </box>
    </Show>
  )
}
