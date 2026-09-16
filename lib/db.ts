import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";
import { Session } from "./types";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

const DATA_DIR = path.resolve(process.cwd(), ".data");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

function ensureLocalStore(): Record<string, Session> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SESSIONS_FILE)) {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}, null, 2), "utf-8");
      return {};
    }
    const content = fs.readFileSync(SESSIONS_FILE, "utf-8");
    return JSON.parse(content || "{}");
  } catch (error) {
    console.error("Error reading local sessions store:", error);
    return {};
  }
}

function writeLocalStore(store: Record<string, Session>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing to local sessions store:", error);
  }
}

/**
 * Retrieves a session by its ID. Returns null if not found.
 */
export async function getSession(id: string): Promise<Session | null> {
  if (redis) {
    try {
      const session = await redis.get<Session>(`session:${id}`);
      if (session) {
        return session;
      }
    } catch (error) {
      console.error("Redis getSession error:", error);
    }
  }

  const store = ensureLocalStore();
  return store[id] ?? null;
}

/**
 * Creates or updates a session record by ID.
 */
export async function saveSession(id: string, data: Partial<Session>): Promise<Session> {
  const existing = await getSession(id);
  const base: Session = existing || {
    id,
    extractedText: "",
    topics: [],
    questions: [],
    knowledgeGaps: {},
    createdAt: new Date().toISOString(),
  };

  const updated: Session = {
    ...base,
    ...data,
    id, // Ensure id remains intact
  };

  if (redis) {
    try {
      await redis.set(`session:${id}`, updated);
    } catch (error) {
      console.error("Redis saveSession error:", error);
    }
  }

  // Also write to local store as fallback
  const store = ensureLocalStore();
  store[id] = updated;
  writeLocalStore(store);

  return updated;
}

/**
 * Lists all session records.
 */
export async function listSessions(): Promise<Session[]> {
  if (redis) {
    try {
      const keys = await redis.keys("session:*");
      if (keys.length > 0) {
        const sessions = await Promise.all(
          keys.map(async (key) => await redis.get<Session>(key))
        );
        return sessions
          .filter((s): s is Session => s !== null)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    } catch (error) {
      console.error("Redis listSessions error:", error);
    }
  }

  const store = ensureLocalStore();
  return Object.values(store).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
