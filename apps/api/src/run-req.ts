import axios from "axios";
import { promises as fs } from "fs";
import { v4 as uuidV4 } from "uuid";
import { Logger } from "./lib/logger";

interface Result {
  start_url: string;
  job_id?: string;
  idempotency_key?: string;
  result_data_jsonb?: any;
}

async function processResults(results: Result[]): Promise<void> {
  let processedCount = 0;
  let starterCount = 0;
  const queue: Result[] = [];
  const processedUrls = new Set<string>();

  // Initialize the queue with the first 1000 results
  for (let i = 0; i < Math.min(100, results.length); i++) {
    queue.push(results[i]);
    processedUrls.add(results[i].start_url);
  }
}

// Example call

async function getStartUrls(): Promise<Result[]> {
  try {
    const data = await fs.readFile("starturls.json", "utf-8");
    return JSON.parse(data);
  } catch (error) {
    Logger.error("Error reading starturls.json", { error: error.message });
    return [];
  }
}

async function main() {
  const results: Result[] = (await getStartUrls()).slice(3999, 6000);

  processResults(results)
    .then(() => {
      Logger.info("All results processed.");
    })
    .catch((error) => {
      Logger.error("Error processing results", { error: error.message });
    });
}

main();
