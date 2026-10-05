import { testDatabaseUrl } from "../test-db.mjs";

// lib/db.ts reads DATABASE_URL when it is first imported, so point it at the
// test database before any test file loads.
process.env.DATABASE_URL = testDatabaseUrl();
