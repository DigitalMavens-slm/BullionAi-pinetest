/*
 * Detached restart helper:
 *   1. kills whoever listens on 8787
 *   2. starts a fresh API server (fully detached)
 * This process exits immediately; no console-group coupling.
 */
const { execSync, spawn } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function findPidOnPort(port) {
  try {
    const out = execSync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
      { windowsHide: true }
    ).toString();
    const line = out.trim().split(/\r?\n/)[0];
    const parts = line.trim().split(/\s+/);
    return Number(parts[parts.length - 1]);
  } catch {
    return null;
  }
}

const pid = findPidOnPort(8787);
if (pid) {
  try {
    process.kill(pid, "SIGKILL");
    console.log("killed old server pid", pid);
  } catch (e) {
    console.log("kill failed:", e.message);
  }
} else {
  console.log("no old server found");
}

const out = require("fs").openSync(path.join(ROOT, "api-server.log"), "w");
const err = require("fs").openSync(path.join(ROOT, "api-server-err.log"), "w");

const child = spawn(process.execPath, ["src/server/bullionai-api.js"], {
  cwd: ROOT,
  detached: true,
  stdio: ["ignore", out, err],
  windowsHide: true,
});
child.unref();

console.log("started new server pid", child.pid);
