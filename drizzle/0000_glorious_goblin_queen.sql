CREATE TYPE "public"."shape_type" AS ENUM('page', 'button', 'text');--> statement-breakpoint
CREATE TYPE "public"."alignment_options" AS ENUM('left', 'center', 'right');--> statement-breakpoint
CREATE TYPE "public"."layout_options" AS ENUM('fixed-size', 'auto-width');--> statement-breakpoint
CREATE TABLE "button" (
	"shapeId" text PRIMARY KEY NOT NULL,
	"pageId" text,
	"title" varchar NOT NULL,
	"subtype" varchar NOT NULL,
	"size" varchar DEFAULT 'Medium' NOT NULL,
	"width" integer DEFAULT 144 NOT NULL,
	"height" integer DEFAULT 29 NOT NULL,
	"textAlign" varchar DEFAULT 'center' NOT NULL,
	"fontWeight" varchar DEFAULT 'normal' NOT NULL,
	"fontStyle" varchar DEFAULT 'normal' NOT NULL,
	"textDecoration" varchar DEFAULT 'none' NOT NULL,
	"leadingIcon" varchar,
	"trailingIcon" varchar
);
--> statement-breakpoint
CREATE TABLE "page" (
	"shapeId" text PRIMARY KEY NOT NULL,
	"subtype" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shapes" (
	"id" text PRIMARY KEY NOT NULL,
	"xOffset" double precision NOT NULL,
	"yOffset" double precision NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"minWidth" integer NOT NULL,
	"maxWidth" integer,
	"minHeight" integer NOT NULL,
	"maxHeight" integer,
	"isInstanceChild" boolean NOT NULL,
	"zIndex" integer NOT NULL,
	"type" "shape_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "text" (
	"shapeId" text PRIMARY KEY NOT NULL,
	"pageId" text,
	"fontSize" varchar NOT NULL,
	"fontColor" varchar NOT NULL,
	"isBold" boolean DEFAULT false NOT NULL,
	"isItalic" boolean DEFAULT false NOT NULL,
	"isUnderlined" boolean DEFAULT false NOT NULL,
	"isStrikethrough" boolean DEFAULT false NOT NULL,
	"alignment" "alignment_options" DEFAULT 'left' NOT NULL,
	"widthMode" "layout_options" DEFAULT 'fixed-size' NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "button" ADD CONSTRAINT "button_shapeId_shapes_id_fk" FOREIGN KEY ("shapeId") REFERENCES "public"."shapes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "button" ADD CONSTRAINT "button_pageId_page_shapeId_fk" FOREIGN KEY ("pageId") REFERENCES "public"."page"("shapeId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_shapeId_shapes_id_fk" FOREIGN KEY ("shapeId") REFERENCES "public"."shapes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text" ADD CONSTRAINT "text_shapeId_shapes_id_fk" FOREIGN KEY ("shapeId") REFERENCES "public"."shapes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text" ADD CONSTRAINT "text_pageId_page_shapeId_fk" FOREIGN KEY ("pageId") REFERENCES "public"."page"("shapeId") ON DELETE set null ON UPDATE no action;