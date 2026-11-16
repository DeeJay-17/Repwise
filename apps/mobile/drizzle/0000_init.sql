CREATE TABLE `plan_days` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plan_days_plan_idx` ON `plan_days` (`plan_id`);--> statement-breakpoint
CREATE TABLE `plan_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_day_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`sets` integer NOT NULL,
	`target_kind` text NOT NULL,
	`min_reps` integer,
	`max_reps` integer,
	`seconds` integer,
	`rest_seconds` integer NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`plan_day_id`) REFERENCES `plan_days`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plan_exercises_day_idx` ON `plan_exercises` (`plan_day_id`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`goal` text NOT NULL,
	`days_per_week` integer NOT NULL,
	`session_minutes` integer NOT NULL,
	`focus_muscles` text NOT NULL,
	`is_active` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`goal` text NOT NULL,
	`level` text NOT NULL,
	`days_per_week` integer NOT NULL,
	`session_minutes` integer NOT NULL,
	`limitations` text NOT NULL,
	`equipment_ids` text NOT NULL,
	`weight_unit` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `set_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`exercise_position` integer NOT NULL,
	`set_number` integer NOT NULL,
	`target_kind` text NOT NULL,
	`target_min_reps` integer,
	`target_max_reps` integer,
	`target_seconds` integer,
	`reps` integer,
	`weight_kg` real,
	`seconds` integer,
	`completed` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `set_logs_session_idx` ON `set_logs` (`session_id`);--> statement-breakpoint
CREATE INDEX `set_logs_exercise_idx` ON `set_logs` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text,
	`plan_day_id` text,
	`name` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_day_id`) REFERENCES `plan_days`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workout_sessions_started_idx` ON `workout_sessions` (`started_at`);