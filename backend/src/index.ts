import { startServer } from "./server.js";

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`Relay API failed to start: ${message}`);
  process.exitCode = 1;
});
