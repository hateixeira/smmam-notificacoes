import { readFile, writeFile } from "node:fs/promises";

const source = await readFile(new URL("../workers/ar-sync-worker.mjs", import.meta.url), "utf8");
const boundary = "----SMMAMArWorkerBoundary";
const metadata = {
  main_module: "ar-sync-worker.mjs",
  bindings: [
    {
      type: "durable_object_namespace",
      name: "AR_SYNC_COORDINATOR",
      class_name: "ArSyncCoordinator",
    },
  ],
};

if (process.env.AR_WORKER_INITIAL_DEPLOY === "1") {
  metadata.migrations = { new_sqlite_classes: ["ArSyncCoordinator"] };
}
const body = [
  `--${boundary}`,
  'Content-Disposition: form-data; name="metadata"',
  "Content-Type: application/json",
  "",
  JSON.stringify(metadata),
  `--${boundary}`,
  'Content-Disposition: form-data; name="ar-sync-worker.mjs"; filename="ar-sync-worker.mjs"',
  "Content-Type: application/javascript+module",
  "",
  source,
  `--${boundary}--`,
  "",
].join("\r\n");

const code = `async () => cloudflare.request({ method: "PUT", path: \`/accounts/\${accountId}/workers/scripts/smmam-ar-sync\`, body: ${JSON.stringify(body)}, contentType: ${JSON.stringify(`multipart/form-data; boundary=${boundary}`)}, rawBody: true })`;
await writeFile(new URL("../workers/deploy-input.json", import.meta.url), JSON.stringify({ code }));
