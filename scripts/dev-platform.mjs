import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
const root = fileURLToPath(new URL("../", import.meta.url));
if (!existsSync(new URL("../.env.platform", import.meta.url))) {
  console.error("Run npm run platform:setup first.");
  process.exit(1);
}
const children = [];
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
function start(args, cwd = root) {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.on("error", () => {
    console.error("Could not start a platform process.");
    stop();
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    if (!stopping) {
      stop();
      process.exitCode = code ?? 1;
    }
  });
  return child;
}
const migration = spawn(
  process.execPath,
  [
    "--env-file=.env.platform",
    "--import",
    "tsx",
    "packages/server/src/migrate.ts",
  ],
  { cwd: root, stdio: "inherit", windowsHide: true },
);
const migrated = await new Promise((resolve) => {
  migration.on("error", () => resolve(false));
  migration.on("exit", (code) => resolve(code === 0));
});
if (!migrated) {
  console.error(
    "Start the infrastructure with npm run platform:infra, then retry.",
  );
  process.exit(1);
}
for (const app of ["api", "knowledge", "worker"])
  start([
    "--env-file=.env.platform",
    "--watch",
    "--import",
    "tsx",
    "apps/" + app + "/src/index.ts",
  ]);
start(
  [
    fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
    "--host",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  fileURLToPath(new URL("../apps/web/", import.meta.url)),
);
