import { RGBA } from "@opentui/core"
import { createMemo } from "solid-js"
import { createSimpleContext } from "./helper"
import polly from "../theme/polly.json" with { type: "json" }

type HexColor = `#${string}`
type RefName = string
type Variant = { dark: HexColor | RefName; light: HexColor | RefName }
type ColorValue = HexColor | RefName | Variant | RGBA
type ThemeJson = {
  defs?: Record<string, HexColor | RefName>
  theme: Record<string, ColorValue>
}

type ThemeColors = {
  primary: RGBA
  secondary: RGBA
  accent: RGBA
  logo: RGBA
  error: RGBA
  warning: RGBA
  success: RGBA
  info: RGBA
  text: RGBA
  textMuted: RGBA
  background: RGBA
  backgroundPanel: RGBA
  backgroundElement: RGBA
  border: RGBA
  borderActive: RGBA
  borderSubtle: RGBA
}

function resolveTheme(theme: ThemeJson, mode: "dark" | "light") {
  const defs = theme.defs ?? {}
  function resolveColor(c: ColorValue): RGBA {
    if (c instanceof RGBA) return c
    if (typeof c === "string") {
      if (c === "transparent" || c === "none") return RGBA.fromInts(0, 0, 0, 0)
      if (c.startsWith("#")) return RGBA.fromHex(c)
      if (defs[c] != null) return resolveColor(defs[c])
      const ref = theme.theme[c as keyof typeof theme.theme]
      if (ref !== undefined) return resolveColor(ref)
      throw new Error(`Color reference "${c}" not found`)
    }
    return resolveColor(c[mode])
  }

  const entries = Object.entries(theme.theme).map(([key, value]) => [key, resolveColor(value as ColorValue)])
  const resolved = Object.fromEntries(entries)
  return resolved as ThemeColors
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { mode: "dark" | "light" }) => {
    const values = createMemo(() => resolveTheme(polly as ThemeJson, props.mode))
    return {
      theme: new Proxy(values(), {
        get(_target, prop) {
          return values()[prop as keyof ThemeColors]
        },
      }),
    }
  },
})
