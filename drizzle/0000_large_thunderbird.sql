CREATE TABLE `planner_entries` (
	`key` text PRIMARY KEY NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`done` integer DEFAULT false NOT NULL
);
