import fs from "node:fs/promises";
import process from "node:process";

function getEnvBoolean(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return ["1", "true", "yes", "y", "on"].includes(String(raw).trim().toLowerCase());
}

function getEnvInt(name, defaultValue) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return defaultValue;
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function normalizeTargetUrl(url) {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

async function loadConfig() {
  const configPath = process.env.TARGETS_JSON ?? "targets.json";
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);

  const targets = Array.isArray(parsed) ? parsed : parsed?.targets;
  const timeoutMs = getEnvInt("TIMEOUT_MS", parsed?.timeoutMs ?? 10_000);

  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error(`No targets found in ${configPath}. Expected { "targets": ["https://..."] }`);
  }

  const normalized = targets
    .map(normalizeTargetUrl)
    .filter(Boolean);

  if (normalized.length === 0) {
    throw new Error(`No valid URLs found in ${configPath}.`);
  }

  return { targets: normalized, timeoutMs };
}

async function pingOnce(url, { timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "RenderPings/1.0"
      },
      signal: controller.signal
    });
    const ms = Date.now() - startedAt;
    return { url, status: response.status, ms };
  } catch (error) {
    const ms = Date.now() - startedAt;
    return { url, status: null, ms, error: String(error?.message ?? error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const failOnError = getEnvBoolean("FAIL_ON_ERROR", false);
  const started = new Date().toISOString();

  const { targets, timeoutMs } = await loadConfig();
  console.log(`[${started}] Pinging ${targets.length} target(s) (timeout ${timeoutMs}ms)`);

  const results = await Promise.all(targets.map((url) => pingOnce(url, { timeoutMs })));

  let failures = 0;
  for (const r of results) {
    if (r.status != null) {
      const level = r.status >= 500 ? "WARN" : "UP  ";
      console.log(`${level} ${r.status} ${r.ms}ms  ${r.url}`);
    } else {
      failures += 1;
      console.log(`DOWN ${r.error} ${r.ms}ms  ${r.url}`);
    }
  }

  if (failures > 0) {
    console.log(`Completed with ${failures} failure(s).`);
    if (failOnError) process.exitCode = 1;
  } else {
    console.log("Completed successfully.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
