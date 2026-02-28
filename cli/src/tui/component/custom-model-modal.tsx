import { createSignal, createEffect, Show } from "solid-js"
import { useTheme } from "../context/theme"

export function CustomModelModal(props: {
  visible: boolean
  onClose: () => void
  onSetModel: (model: string) => void
}) {
  const { theme } = useTheme()
  const [value, setValue] = createSignal("")
  let inputRef: { focus: () => void; plainText: string; setText: (s: string) => void } | null = null

  createEffect(() => {
    if (props.visible) setValue("")
  })

  const handleSubmit = (v?: string) => {
    const modelName = (v ?? inputRef?.plainText ?? value()).trim()
    if (modelName) {
      props.onSetModel(modelName)
      setValue("")
      props.onClose()
    }
  }

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
            Custom Model
          </text>
          <text fg={theme.text}>
            Find the model on enter.pollinations.ai !
          </text>
          <box
            border={["all"]}
            borderColor={theme.border}
            paddingLeft={1}
            paddingRight={1}
            paddingTop={1}
            paddingBottom={1}
            backgroundColor={theme.backgroundElement}
          >
            <input
              focused
              ref={(r: unknown) => {
                inputRef = r as typeof inputRef
              }}
              placeholder="e.g. minimax"
              textColor={theme.text}
              focusedTextColor={theme.text}
              focusedBackgroundColor={theme.backgroundElement}
              cursorColor={theme.text}
              value={value()}
              onInput={(v) => setValue(v)}
              onSubmit={handleSubmit}
              keyBindings={[{ name: "return", action: "submit" }]}
            />
          </box>
          <text fg={theme.textMuted}>
            Enter to set · Escape to close
          </text>
        </box>
      </box>
    </Show>
  )
}
