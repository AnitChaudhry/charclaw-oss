-- Phase 0 + 1: Workspace foundation migration
-- Renames Team -> Workspace, TeamMember -> WorkspaceMember, adds enriched fields,
-- adds workspaceId isolation columns to Repo / Runtime / AgentProfile, backfills
-- a personal workspace (+ owner membership) for every user, renames teamId ->
-- workspaceId on Issue / Skill.

-- =========================================================================
-- 0. Drop old indexes that reference soon-to-be-renamed columns
-- =========================================================================
DROP INDEX IF EXISTS "Issue_teamId_status_idx";
DROP INDEX IF EXISTS "Skill_teamId_idx";

-- =========================================================================
-- 1. Rename Team -> Workspace (preserving PK / FK / constraint names where
--    Prisma's convention matters — we re-create constraints in a later step).
-- =========================================================================
ALTER TABLE "Team" RENAME TO "Workspace";
ALTER TABLE "TeamMember" RENAME TO "WorkspaceMember";

-- Rename columns on WorkspaceMember: teamId -> workspaceId
ALTER TABLE "WorkspaceMember" RENAME COLUMN "teamId" TO "workspaceId";

-- Rename Prisma-generated constraint / index names on Workspace
ALTER TABLE "Workspace" RENAME CONSTRAINT "Team_pkey" TO "Workspace_pkey";
ALTER INDEX "Team_ownerId_key" RENAME TO "Workspace_ownerId_key";
ALTER TABLE "Workspace" RENAME CONSTRAINT "Team_ownerId_fkey" TO "Workspace_ownerId_fkey";

-- Rename Prisma-generated constraint / index names on WorkspaceMember
ALTER TABLE "WorkspaceMember" RENAME CONSTRAINT "TeamMember_pkey" TO "WorkspaceMember_pkey";
-- Old unique on userId (single workspace per user) — drop later after we add
-- the new composite unique, to stay safe during backfill.
ALTER INDEX "TeamMember_userId_key" RENAME TO "WorkspaceMember_userId_key_legacy";
ALTER TABLE "WorkspaceMember" RENAME CONSTRAINT "TeamMember_teamId_fkey" TO "WorkspaceMember_workspaceId_fkey";
ALTER TABLE "WorkspaceMember" RENAME CONSTRAINT "TeamMember_userId_fkey" TO "WorkspaceMember_userId_fkey";

-- =========================================================================
-- 2. Enrich Workspace with new fields (defaults allow safe backfill; the
--    defaults that should not persist get dropped at the end).
-- =========================================================================
ALTER TABLE "Workspace"
  ADD COLUMN "name"        TEXT NOT NULL DEFAULT 'Personal',
  ADD COLUMN "slug"        TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "avatarUrl"   TEXT,
  ADD COLUMN "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill slug / name from owner's githubLogin when available; fall back to
-- a random prefixed slug when no login is known.
UPDATE "Workspace" w
   SET "slug" = COALESCE(
         LOWER(u."githubLogin") || '-ws',
         'ws_' || substr(md5(random()::text || w.id), 1, 10)
       ),
       "name" = COALESCE(u."name", u."githubLogin", 'Personal')
  FROM "User" u
 WHERE w."ownerId" = u.id;

-- If any Workspace still lacks a slug (e.g. orphan rows), assign a random one.
UPDATE "Workspace"
   SET "slug" = 'ws_' || substr(md5(random()::text || id), 1, 10)
 WHERE "slug" IS NULL;

-- Enforce slug uniqueness + not-null now that backfill is complete.
ALTER TABLE "Workspace"
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "name" DROP DEFAULT;

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- =========================================================================
-- 3. Enrich WorkspaceMember: add role column (owner / admin / member).
-- =========================================================================
ALTER TABLE "WorkspaceMember"
  ADD COLUMN "role" TEXT NOT NULL DEFAULT 'member';

-- If a member is *also* the workspace's owner, promote to 'owner' role.
UPDATE "WorkspaceMember" m
   SET "role" = 'owner'
  FROM "Workspace" w
 WHERE m."workspaceId" = w.id
   AND m."userId" = w."ownerId";

-- Rename userId index from WorkspaceMember_userId_key_legacy -> proper
-- secondary index, drop the old unique constraint (single workspace per
-- user) since we now support multi-workspace membership.
DROP INDEX "WorkspaceMember_userId_key_legacy";
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- New composite uniqueness: a user can join a given workspace only once.
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key"
  ON "WorkspaceMember"("workspaceId", "userId");

-- =========================================================================
-- 4. Auto-create a personal Workspace for every User who doesn't own one.
-- =========================================================================
INSERT INTO "Workspace" ("id", "ownerId", "name", "slug", "description", "avatarUrl", "createdAt", "updatedAt")
SELECT
  'cws_' || substr(md5(random()::text || u.id), 1, 21),
  u.id,
  COALESCE(u."name", u."githubLogin", 'Personal'),
  COALESCE(LOWER(u."githubLogin") || '-ws', 'ws_' || substr(md5(random()::text || u.id), 1, 10)),
  NULL,
  NULL,
  NOW(),
  NOW()
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "Workspace" w WHERE w."ownerId" = u.id
);

-- Ensure every workspace owner has a matching WorkspaceMember row (owner role).
INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "createdAt")
SELECT
  'cwm_' || substr(md5(random()::text || w.id), 1, 21),
  w.id,
  w."ownerId",
  'owner',
  NOW()
FROM "Workspace" w
WHERE NOT EXISTS (
  SELECT 1 FROM "WorkspaceMember" m
   WHERE m."workspaceId" = w.id AND m."userId" = w."ownerId"
);

-- Some slugs inserted above may collide if two users share a githubLogin or
-- have no login. De-duplicate by appending a short hash suffix where needed.
WITH dupes AS (
  SELECT id, slug,
         ROW_NUMBER() OVER (PARTITION BY slug ORDER BY "createdAt") AS rn
    FROM "Workspace"
)
UPDATE "Workspace" w
   SET slug = w.slug || '-' || substr(md5(random()::text || w.id), 1, 6)
  FROM dupes
 WHERE dupes.id = w.id
   AND dupes.rn > 1;

-- =========================================================================
-- 5. Add workspaceId column to Repo / Runtime / AgentProfile (nullable at
--    first to allow backfill, then NOT NULL).
-- =========================================================================
ALTER TABLE "Repo"         ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Runtime"      ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "AgentProfile" ADD COLUMN "workspaceId" TEXT;

-- Backfill each record to the owner user's personal workspace.
UPDATE "Repo" r
   SET "workspaceId" = w.id
  FROM "Workspace" w
 WHERE w."ownerId" = r."userId";

UPDATE "Runtime" rt
   SET "workspaceId" = w.id
  FROM "Workspace" w
 WHERE w."ownerId" = rt."userId";

UPDATE "AgentProfile" ap
   SET "workspaceId" = w.id
  FROM "Workspace" w
 WHERE w."ownerId" = ap."userId";

-- Any row whose user doesn't own a workspace (shouldn't happen after step 4,
-- but be defensive): fall back to any workspace the user is a member of.
UPDATE "Repo" r
   SET "workspaceId" = m."workspaceId"
  FROM "WorkspaceMember" m
 WHERE r."workspaceId" IS NULL
   AND m."userId" = r."userId";

UPDATE "Runtime" rt
   SET "workspaceId" = m."workspaceId"
  FROM "WorkspaceMember" m
 WHERE rt."workspaceId" IS NULL
   AND m."userId" = rt."userId";

UPDATE "AgentProfile" ap
   SET "workspaceId" = m."workspaceId"
  FROM "WorkspaceMember" m
 WHERE ap."workspaceId" IS NULL
   AND m."userId" = ap."userId";

-- Enforce NOT NULL now.
ALTER TABLE "Repo"         ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Runtime"      ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "AgentProfile" ALTER COLUMN "workspaceId" SET NOT NULL;

-- =========================================================================
-- 6. Rename teamId -> workspaceId on Issue / Skill (kept nullable to match
--    current schema).
-- =========================================================================
ALTER TABLE "Issue" RENAME COLUMN "teamId" TO "workspaceId";
ALTER TABLE "Skill" RENAME COLUMN "teamId" TO "workspaceId";

-- =========================================================================
-- 7. Add foreign keys + indexes for workspace isolation.
-- =========================================================================
ALTER TABLE "Repo"
  ADD CONSTRAINT "Repo_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Runtime"
  ADD CONSTRAINT "Runtime_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentProfile"
  ADD CONSTRAINT "AgentProfile_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Repo_workspaceId_idx"         ON "Repo"("workspaceId");
CREATE INDEX "Runtime_workspaceId_idx"      ON "Runtime"("workspaceId");
CREATE INDEX "AgentProfile_workspaceId_idx" ON "AgentProfile"("workspaceId");

-- Re-create renamed indexes on Issue / Skill.
CREATE INDEX "Issue_workspaceId_status_idx" ON "Issue"("workspaceId", "status");
CREATE INDEX "Skill_workspaceId_idx"        ON "Skill"("workspaceId");
