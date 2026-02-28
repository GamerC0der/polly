import figlet from "figlet"

const ascii = figlet.textSync("Polly", { font: "ANSI Regular" })
export const logo = ascii.split("\n").filter((line) => line.trim().length > 0)
