import { render } from "@opentui/solid"
import { App } from "./tui/app"

async function main() {
  const mode = "dark" as "dark" | "light"

  render(
    () => <App mode={mode} />,
    {
      targetFps: 60,
      gatherStats: false,
      exitOnCtrlC: false,
      useKittyKeyboard: {},
      autoFocus: true,
      openConsoleOnError: false,
    }
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
