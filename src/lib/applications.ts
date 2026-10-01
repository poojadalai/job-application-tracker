export const STATUSES = [
  "Wishlist",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
] as const;

export type Status = (typeof STATUSES)[number];

export type Application = {
  id: string;
  company: string;
  role: string;
  status: Status;
  dateApplied: string;
  link: string;
  notes: string;
};

const STORAGE_KEY = "job-applications";
const EMPTY: Application[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedList: Application[] = EMPTY;

function read(): Application[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedList;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    cachedList = raw ? (JSON.parse(raw) as Application[]) : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function write(list: Application[]) {
  const raw = JSON.stringify(list);
  cachedRaw = raw;
  cachedList = list;
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage unavailable (private mode, quota): keep the in-memory copy.
  }
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const getSnapshot = read;
export const getServerSnapshot = () => EMPTY;

export function addApplication(app: Omit<Application, "id">) {
  write([{ ...app, id: crypto.randomUUID() }, ...read()]);
}

export function updateApplication(id: string, changes: Partial<Application>) {
  write(read().map((app) => (app.id === id ? { ...app, ...changes } : app)));
}

export function deleteApplication(id: string) {
  write(read().filter((app) => app.id !== id));
}
