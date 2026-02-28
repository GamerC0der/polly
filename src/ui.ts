const rule = "-".repeat(72);

export function printBanner(): void {
  console.log(" Polly ");
  console.log("A wave-ready AI CLI");
  console.log("  commands: /help | /tool list | /setkey | /setbase | /quit");
  console.log("  theme: minimal, direct, local-first");
}

export function printDivider(label?: string): void {
  const text = label ? ` ${label} ` : "";
  console.log(`---${text}${rule.slice(Math.min(text.length + 3, rule.length))}`);
}

export function printWelcome(baseUrl: string): void {
  printBanner();
  console.log(` endpoint: ${baseUrl}`);
  printDivider();
}

export function renderToolHint(): void {
  printDivider("tools");
  console.log("/run <name> <args>  execute local helper");
  console.log("/tool list            show available tools");
  console.log("/history              show chat context");
}

export function renderHelp(model: string): void {
  printDivider("help");
  console.log("/help");
  console.log("/run <name> <args> run a local tool");
  console.log("/tool list show available tools");
  console.log(`/model <name> set model (current: ${model})`);
  console.log("/setkey change API key");
  console.log("/setbase change OpenAI Base URL");
  console.log("/logout disconnect and clear API key");
  console.log("/clear clear conversation");
  console.log("/quit exit");
  printDivider();
}
