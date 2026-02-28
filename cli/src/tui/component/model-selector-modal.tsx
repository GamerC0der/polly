import { Show } from "solid-js"
import { useTheme } from "../context/theme"
import { AVAILABLE_MODELS } from "../models"

export function ModelSelectorModal(props: {
  visible: boolean
  currentModel: string
  onClose: () => void
  onSelectModel: (model: string) => void
}) {
  const { theme } = useTheme()

  const options = () =>
    AVAILABLE_MODELS.map((m) => ({
      name: m === props.currentModel ? `${m} (current)` : m,
      description: m === "custom" ? "Enter any model from enter.pollinations.ai" : "",
      value: m,
    }))

  const selectedIndex = () => {
    const idx = AVAILABLE_MODELS.indexOf(props.currentModel as (typeof AVAILABLE_MODELS)[number])
    return idx >= 0 ? idx : 0
  }

  const handleSelect = (_index: number, opt: { value?: string } | null) => {
    if (opt?.value) {
      props.onSelectModel(opt.value)
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
            Select Model
          </text>
          <select
            focused
            options={options()}
            selectedIndex={selectedIndex()}
            showDescription={false}
            height={5}
            textColor={theme.text}
            focusedTextColor={theme.text}
            focusedBackgroundColor={theme.backgroundElement}
            backgroundColor={theme.backgroundElement}
            selectedBackgroundColor={theme.primary}
            selectedTextColor={theme.background}
            onSelect={handleSelect}
            keyBindings={[{ name: "return", action: "select-current" }]}
          />
          <text fg={theme.textMuted}>Enter to select · Escape to close</text>
        </box>
      </box>
    </Show>
  )
}
