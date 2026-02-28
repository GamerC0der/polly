import { For } from "solid-js"
import { useTheme } from "../context/theme"

type TipPart = { text: string; highlight: boolean }

function parse(tip: string): TipPart[] {
  const parts: TipPart[] = []
  const regex = /\{highlight\}(.*?)\{\/highlight\}/g
  const found = Array.from(tip.matchAll(regex))
  let index = 0
  for (const match of found) {
    const start = match.index ?? 0
    if (start > index) {
      parts.push({ text: tip.slice(index, start), highlight: false })
    }
    parts.push({ text: match[1], highlight: true })
    index = start + match[0].length
  }
  if (index < tip.length) {
    parts.push({ text: tip.slice(index), highlight: false })
  }
  return parts
}

const TIPS = [
  "You can use {highlight}/model{/highlight} to autocomplete the model list!",
  "Type {highlight}/help{/highlight} to open the help modal.",
  "Use {highlight}/connect{/highlight} to connect with Pollinations.",
]

export function Tips() {
  const { theme } = useTheme()
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)]
  const parts = parse(tip)

  return (
    <box flexDirection="row" maxWidth="100%">
      <text flexShrink={0} style={{ fg: theme.warning }}>
        ● Tip{" "}
      </text>
      <text flexShrink={1}>
        <For each={parts}>
          {(part) => <span style={{ fg: part.highlight ? theme.text : theme.textMuted }}>{part.text}</span>}
        </For>
      </text>
    </box>
  )
}
