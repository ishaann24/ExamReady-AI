import fs from "fs";
import path from "path";

const CACHE_DIR = path.resolve(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "gemini-cache.json");

function readCacheStore(): Record<string, string> {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (!fs.existsSync(CACHE_FILE)) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify({}, null, 2), "utf-8");
      return {};
    }
    const data = fs.readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(data || "{}");
  } catch (err) {
    console.error("Failed to read gemini cache:", err);
    return {};
  }
}

/**
 * Retrieves a cached result string for the given key, or null if cache miss.
 */
export function getCached(key: string): string | null {
  const cache = readCacheStore();
  return cache[key] ?? null;
}

/**
 * Writes a result string to the local gemini cache for the given key.
 */
export function setCached(key: string, value: string): void {
  try {
    const cache = readCacheStore();
    cache[key] = value;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write to gemini cache:", err);
  }
}
