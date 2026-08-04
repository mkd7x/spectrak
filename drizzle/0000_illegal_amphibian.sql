CREATE TABLE `specs` (
	`uuid` text PRIMARY KEY NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
