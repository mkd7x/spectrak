import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { createDatabase } from "./db/client.js";

const port = Number(process.env.PORT ?? 3000);
// spec: SPK-DB-001
const { db, sqlite } = createDatabase();
const app = createApp(db);
let shuttingDown = false;

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`spectrak listening on http://localhost:${info.port}`);
});

function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  server.close((error) => {
    if (error) {
      console.error(`server shutdown failed: ${error.message}`);
      process.exitCode = 1;
    }
    sqlite.close();
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
