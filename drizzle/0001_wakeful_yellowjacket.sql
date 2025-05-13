CREATE TYPE "public"."direction" AS ENUM('vertical', 'horizontal');--> statement-breakpoint
CREATE TYPE "public"."handleType" AS ENUM('top', 'left', 'bottom', 'right');--> statement-breakpoint
CREATE TABLE "multipage_path" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"shapeStartId" text NOT NULL,
	"shapeStartHandleType" "handleType" NOT NULL,
	"shapeEndId" text NOT NULL,
	"shapeEndHandleType" "handleType" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp DEFAULT now() NOT NULL,
	"pageExcludeList" varchar[] DEFAULT ARRAY[]::text[] NOT NULL,
	"direction" "direction" NOT NULL
);
