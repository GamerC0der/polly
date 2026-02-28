import { render } from "@opentui/solid"
import { readFileSync } from "fs"
import { join } from "path"
import { App } from "./tui/app"

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    const readmePath = join(process.cwd(), "README.md")
    try {
      console.log(readFileSync(readmePath, "utf-8"))
    } catch {
      console.log("README.md not found")
    }
    process.exit(0)
  }

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
