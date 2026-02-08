import fs from "node:fs/promises";
import process from "node:process";

export function getEnvBoolean(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return ["1", "true", "yes", "y", "on"].includes(String(raw).trim().toLowerCase());
}

export function getEnvInt(name, defaultValue) {
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

export async function loadConfig({ configPath = process.env.TARGETS_JSON ?? "targets.json" } = {}) {
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);

  const targets = Array.isArray(parsed) ? parsed : parsed?.targets;
  const timeoutMs = getEnvInt("TIMEOUT_MS", parsed?.timeoutMs ?? 10_000);

  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error(`No targets found in ${configPath}. Expected { "targets": ["https://..."] }`);
  }

  const normalized = targets.map(normalizeTargetUrl).filter(Boolean);
  if (normalized.length === 0) {
    throw new Error(`No valid URLs found in ${configPath}.`);
  }

  return { targets: normalized, timeoutMs, configPath };
}

export async function pingOnce(url, { timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "VercelPings/1.0" },
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

export async function pingAll({ targets, timeoutMs }) {
  const results = await Promise.all(targets.map((url) => pingOnce(url, { timeoutMs })));
  const down = results.filter((r) => r.status == null).length;
  const up = results.length - down;
  return { results, summary: { total: results.length, up, down } };
}

