/**
 * Database Client Configuration
 *
 * PostgreSQL 18 connection with Drizzle ORM
 * Connection pooling for production performance
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema/index.js";

/**
 * Database connection singleton
 */
let client: postgres.Sql<NonNullable<unknown>> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Get or create database connection
 */
export function getDatabase() {
  if (!db) {
    const connectionString = process.env["DATABASE_URL"];

    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    // Create PostgreSQL connection with pooling
    client = postgres(connectionString, {
      max: 10, // Connection pool size
      idle_timeout: 20,
      connect_timeout: 10,
    });

    // Create Drizzle instance
    db = drizzle(client, { schema });
  }

  return db;
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

/**
 * Health check for database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const db = getDatabase();
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

// Export schema for use in other modules
export * from "./schema/index.js";
