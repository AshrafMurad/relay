CREATE TABLE "Channel" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdById" UUID NOT NULL,
  "archivedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Channel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Channel_name_check" CHECK ("name" ~ '^[a-z0-9_-]{2,80}$')
);

CREATE INDEX "Channel_workspaceId_archivedAt_name_idx" ON "Channel" ("workspaceId", "archivedAt", "name");
CREATE INDEX "Channel_createdById_idx" ON "Channel" ("createdById");
CREATE UNIQUE INDEX "Channel_workspaceId_name_ci_key" ON "Channel" ("workspaceId", lower("name"));

ALTER TABLE "Channel" ADD CONSTRAINT "Channel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Channel" ("workspaceId", "name", "createdById", "updatedAt")
SELECT "id", 'general', "createdById", CURRENT_TIMESTAMP
FROM "Workspace";
