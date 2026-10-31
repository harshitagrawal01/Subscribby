const cron = require("node-cron");
const app = require("./app");
const env = require("./config/env");
const { connectDB } = require("./config/db");
const { executeBillingRun } = require("./services/billing");
const { todayIST } = require("./utils/date");

async function start() {
  try {
    await connectDB();
    console.log(`[DB] Connected to MongoDB`);

    if (env.RUN_JOBS) {
      cron.schedule(
        env.BILLING_CRON,
        async () => {
          console.log(`[CRON] Starting scheduled billing run for ${todayIST()}...`);
          try {
            const result = await executeBillingRun({
              asOfDate: todayIST(),
              dryRun: false,
              createdBy: "system",
            });
            console.log(
              `[CRON] Billing run complete: created=${result.created}, skipped=${result.skippedAlreadyInvoiced}`
            );
          } catch (err) {
            console.error("[CRON ERROR]", err);
          }
        },
        { timezone: "Asia/Kolkata" }
      );
      console.log(`[CRON] Scheduled nightly billing job (${env.BILLING_CRON} Asia/Kolkata)`);
    }

    app.listen(env.PORT, () => {
      console.log(`[API] Brightloop API listening on http://localhost:${env.PORT}/api/v1`);
    });
  } catch (err) {
    console.error("[STARTUP ERROR]", err);
    process.exit(1);
  }
}

start();
