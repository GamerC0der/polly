import { For } from "solid-js"
import { useTheme } from "../context/theme"
import { logo } from "../logo"

export function Logo() {
  const { theme } = useTheme()

  return (
    <box flexDirection="column" alignItems="center">
      <For each={logo}>
        {(line) => (
          <text fg={theme.logo} attributes={1}>
            {line}
          </text>
        )}
      </For>
    </box>
  )
}
