import { RGBA } from "@opentui/core"
import { createMemo, createSignal, onMount } from "solid-js"
import { createSimpleContext } from "./helper"
import dark from "../theme/dark.json" with { type: "json" }
import warm from "../theme/warm.json" with { type: "json" }
import cool from "../theme/cool.json" with { type: "json" }
import minimal from "../theme/minimal.json" with { type: "json" }
import { loadConfig, saveConfig } from "../../config"

const THEMES: Record<string, ThemeJson> = {
  dark: dark as ThemeJson,
  warm: warm as ThemeJson,
  cool: cool as ThemeJson,
  minimal: minimal as ThemeJson,
}

export const THEME_NAMES = ["dark", "warm", "cool", "minimal"] as const
export type ThemeName = (typeof THEME_NAMES)[number]

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
    const [active, setActive] = createSignal<ThemeName>("minimal")

    onMount(async () => {
      const cfg = await loadConfig()
      if (cfg.theme && THEME_NAMES.includes(cfg.theme as ThemeName)) {
        setActive(cfg.theme as ThemeName)
      }
    })

    const values = createMemo(() =>
      resolveTheme(THEMES[active()] ?? THEMES.minimal, props.mode),
    )

    return {
      theme: new Proxy(values(), {
        get(_target, prop) {
          return values()[prop as keyof ThemeColors]
        },
      }),
      get selected() {
        return active()
      },
      themes: THEME_NAMES,
      set(theme: ThemeName) {
        setActive(theme)
        loadConfig().then((cfg) => saveConfig({ ...cfg, theme }))
      },
    }
  },
})
