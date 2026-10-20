import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const entries=sqliteTable("planner_entries",{key:text("key").primaryKey(),text:text("text").notNull().default(""),done:integer("done",{mode:"boolean"}).notNull().default(false)});
