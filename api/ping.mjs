import { getEnvBoolean, loadConfig, pingAll } from "../lib/pinger.mjs";

export default async function handler(req, res) {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "Method Not Allowed" }));
    return;
  }

  const startedAt = new Date().toISOString();
  const failOnError = getEnvBoolean("FAIL_ON_ERROR", false);

  try {
    const { targets, timeoutMs, configPath } = await loadConfig();
    const { results, summary } = await pingAll({ targets, timeoutMs });

    const body = {
      ok: summary.down === 0,
      startedAt,
      timeoutMs,
      configPath,
      summary,
      results
    };

    const statusCode = failOnError && summary.down > 0 ? 500 : 200;
    res.statusCode = statusCode;
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify(body));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ ok: false, startedAt, error: String(error?.message ?? error) }));
  }
}

