import { connection, createWorker } from "../utils/redis";
import { pubsub } from "../utils/pubsub";

if (connection) {
  // 1. Midnight Scraper
createWorker("midnight-scraper", async (job) => {
  try {
    console.log("Running Midnight Scraper job", job.id);
    pubsub.publish("vinNotification", { message: "Midnight Scraper complete" });
  } catch (err) {
    console.error("Midnight Scraper failed", job.id, err);
  }
});

  // 3. Condition Matrix Recalculation
  createWorker("condition-matrix", async (job) => {
    try {
      console.log("Running ConditionMatrix recalculation", job.id);
      const vinId = job.data.vinId;
      pubsub.publish("conditionMatrixNotification", { message: `Condition Matrix updated for VIN ${vinId}` });
    } catch (err) {
      console.error("ConditionMatrix recalculation failed", job.id, err);
    }
  });

  // 5. Vesting / AZTO Countdown Updates
  createWorker("vesting-update", async (job) => {
    try {
      console.log("Running Vesting / AZTO countdown update", job.id);
      pubsub.publish("vestingNotification", { message: "Vesting updated" });
    } catch (err) {
      console.error("Vesting / AZTO countdown update failed", job.id, err);
    }
  });
}
