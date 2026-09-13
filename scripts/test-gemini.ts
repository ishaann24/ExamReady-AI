import fs from "fs";
import path from "path";

// Automatically load .env.local or .env environment variables if not already set
const envFiles = [".env.local", ".env"];
for (const file of envFiles) {
  const fullPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...values] = trimmed.split("=");
        const k = key.trim();
        const v = values.join("=").trim().replace(/^["']|["']$/g, "");
        if (k && !process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
}

import { callGemini, getGeminiModelName } from "../lib/gemini";

async function main() {
  const modelName = getGeminiModelName();
  console.log(`=== Testing Gemini API Helper ===`);
  console.log(`Using Model: "${modelName}"`);
  
  const prompt = "Explain the concept of active recall in two concise sentences.";
  console.log(`Prompt: "${prompt}"\n`);
  console.log(`Sending request to Gemini (${modelName})...`);

  try {
    const response = await callGemini(prompt);
    console.log("\n--- Response Received ---");
    console.log(response);
    console.log("-------------------------\n");
    console.log("SUCCESS: Gemini API helper test passed.");
  } catch (error: any) {
    console.error("\nERROR: Gemini API test failed.");
    console.error(error?.message || String(error));
    process.exit(1);
  }
}

main();
