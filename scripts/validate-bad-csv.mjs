import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const badCsvPath = path.join(rootDir, "tests", "fixtures", "bad-menu.csv");
const scriptPath = path.join(rootDir, "scripts", "build-menu-data.mjs");

const result = spawnSync(process.execPath, [scriptPath], {
  cwd: rootDir,
  env: {
    ...process.env,
    MENU_CSV_URL: "",
    MENU_CSV_FILE: badCsvPath
  },
  encoding: "utf8"
});

if (result.status === 0) {
  console.error("[validate:data] Expected bad CSV validation to fail, but it succeeded.");
  process.exit(1);
}

const combinedOutput = `${result.stdout}\n${result.stderr}`;
if (!combinedOutput.includes("Missing category at row")) {
  console.error("[validate:data] Build failed, but not with the expected validation error.");
  console.error(combinedOutput.trim());
  process.exit(1);
}

console.log("[validate:data] Bad CSV validation check passed.");
