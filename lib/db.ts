import fs from "fs";
import path from "path";
import { Session } from "./types";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

function ensureStore(): Record<string, Session> {
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
    console.error("Error reading sessions store:", error);
    return {};
  }
}

function writeStore(store: Record<string, Session>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing to sessions store:", error);
  }
}

/**
 * Retrieves a session by its ID. Returns null if not found.
 */
export function getSession(id: string): Session | null {
  const store = ensureStore();
  return store[id] ?? null;
}

/**
 * Creates or updates a session record by ID.
 */
export function saveSession(id: string, data: Partial<Session>): Session {
  const store = ensureStore();
  const existing: Session = store[id] || {
    id,
    extractedText: "",
    topics: [],
    questions: [],
    knowledgeGaps: {},
    createdAt: new Date().toISOString(),
  };

  const updated: Session = {
    ...existing,
    ...data,
    id, // Ensure id remains intact
  };

  store[id] = updated;
  writeStore(store);
  return updated;
}

/**
 * Lists all session records.
 */
export function listSessions(): Session[] {
  const store = ensureStore();
  return Object.values(store).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
