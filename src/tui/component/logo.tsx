import { For } from "solid-js"
import { useTheme } from "../context/theme"
import { logo } from "../logo"

export function Logo() {
  const { theme } = useTheme()

  return (
    <box
      flexDirection="column"
      alignItems="center"
      backgroundColor={theme.backgroundPanel}
      border={["all"]}
      borderColor={theme.borderSubtle}
      paddingLeft={3}
      paddingRight={3}
      paddingTop={1}
      paddingBottom={1}
    >
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
