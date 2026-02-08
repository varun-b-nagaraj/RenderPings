import process from "node:process";
import { getEnvBoolean, loadConfig, pingAll } from "./lib/pinger.mjs";

async function main() {
  const failOnError = getEnvBoolean("FAIL_ON_ERROR", false);
  const started = new Date().toISOString();

  const { targets, timeoutMs } = await loadConfig();
  console.log(`[${started}] Pinging ${targets.length} target(s) (timeout ${timeoutMs}ms)`);

  const { results, summary } = await pingAll({ targets, timeoutMs });

  for (const r of results) {
    if (r.status != null) {
      const level = r.status >= 500 ? "WARN" : "UP  ";
      console.log(`${level} ${r.status} ${r.ms}ms  ${r.url}`);
    } else {
      console.log(`DOWN ${r.error} ${r.ms}ms  ${r.url}`);
    }
  }

  if (summary.down > 0) {
    console.log(`Completed with ${summary.down} failure(s).`);
    if (failOnError) process.exitCode = 1;
  } else {
    console.log("Completed successfully.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
