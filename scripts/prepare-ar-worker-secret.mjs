import { writeFile } from "node:fs/promises";

const apiKey = process.env.RAPIDAPI_AR_KEY;
if (!apiKey) throw new Error("RAPIDAPI_AR_KEY não está disponível no ambiente seguro.");

const code = `async () => cloudflare.request({ method: "PUT", path: \`/accounts/\${accountId}/workers/scripts/smmam-ar-sync/secrets\`, body: { name: "RAPIDAPI_AR_KEY", type: "secret_text", text: ${JSON.stringify(apiKey)} } })`;
await writeFile(new URL("../workers/secret-input.json", import.meta.url), JSON.stringify({ code }));
