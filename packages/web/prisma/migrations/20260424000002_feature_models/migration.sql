-- Feature models: Project, InboxItem, Conversation, ConversationMessage, Autopilot, AutopilotRun, Pin
-- Also: Issue.projectId FK + IssueComment.mentions + IssueComment author FK

-- ─── Project ──────────────────────────────────────────────────────────────
CREATE TABLE "Project" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "description" TEXT,
    "color"       TEXT,
    "icon"        TEXT,
    "archivedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Project_workspaceId_slug_key" ON "Project"("workspaceId", "slug");
CREATE INDEX "Project_workspaceId_archivedAt_idx" ON "Project"("workspaceId", "archivedAt");
ALTER TABLE "Project"
    ADD CONSTRAINT "Project_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Issue.projectId ──────────────────────────────────────────────────────
ALTER TABLE "Issue" ADD COLUMN "projectId" TEXT;
CREATE INDEX "Issue_projectId_status_idx" ON "Issue"("projectId", "status");
ALTER TABLE "Issue"
    ADD CONSTRAINT "Issue_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── IssueComment: mentions column + author FK ────────────────────────────
ALTER TABLE "IssueComment" ADD COLUMN "mentions" JSONB;
CREATE INDEX "IssueComment_authorUserId_idx" ON "IssueComment"("authorUserId");
ALTER TABLE "IssueComment"
    ADD CONSTRAINT "IssueComment_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── InboxItem ────────────────────────────────────────────────────────────
CREATE TABLE "InboxItem" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "workspaceId"    TEXT NOT NULL,
    "kind"           TEXT NOT NULL,
    "refType"        TEXT NOT NULL,
    "refId"          TEXT NOT NULL,
    "actorUserId"    TEXT,
    "actorAgentSlug" TEXT,
    "summary"        TEXT,
    "payload"        JSONB,
    "readAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InboxItem_userId_readAt_createdAt_idx" ON "InboxItem"("userId", "readAt", "createdAt");
CREATE INDEX "InboxItem_workspaceId_createdAt_idx" ON "InboxItem"("workspaceId", "createdAt");
ALTER TABLE "InboxItem"
    ADD CONSTRAINT "InboxItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Conversation ─────────────────────────────────────────────────────────
CREATE TABLE "Conversation" (
    "id"             TEXT NOT NULL,
    "workspaceId"    TEXT NOT NULL,
    "ownerUserId"    TEXT NOT NULL,
    "agentProfileId" TEXT,
    "title"          TEXT,
    "archivedAt"     TIMESTAMP(3),
    "lastMessageAt"  TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Conversation_workspaceId_ownerUserId_lastMessageAt_idx"
    ON "Conversation"("workspaceId", "ownerUserId", "lastMessageAt");
CREATE INDEX "Conversation_agentProfileId_idx" ON "Conversation"("agentProfileId");
ALTER TABLE "Conversation"
    ADD CONSTRAINT "Conversation_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ConversationMessage ──────────────────────────────────────────────────
CREATE TABLE "ConversationMessage" (
    "id"              TEXT NOT NULL,
    "conversationId"  TEXT NOT NULL,
    "role"            TEXT NOT NULL,
    "authorUserId"    TEXT,
    "authorAgentSlug" TEXT,
    "content"         TEXT NOT NULL,
    "contentBlocks"   JSONB,
    "mentions"        JSONB,
    "toolCalls"       JSONB,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx"
    ON "ConversationMessage"("conversationId", "createdAt");
ALTER TABLE "ConversationMessage"
    ADD CONSTRAINT "ConversationMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage"
    ADD CONSTRAINT "ConversationMessage_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Autopilot ────────────────────────────────────────────────────────────
CREATE TABLE "Autopilot" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "enabled"         BOOLEAN NOT NULL DEFAULT true,
    "trigger"         TEXT NOT NULL DEFAULT 'cron',
    "schedule"        TEXT,
    "timezone"        TEXT NOT NULL DEFAULT 'UTC',
    "agentProfileId"  TEXT,
    "repoId"          TEXT,
    "config"          JSONB NOT NULL,
    "lastRunAt"       TIMESTAMP(3),
    "nextRunAt"       TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Autopilot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Autopilot_workspaceId_enabled_nextRunAt_idx"
    ON "Autopilot"("workspaceId", "enabled", "nextRunAt");
ALTER TABLE "Autopilot"
    ADD CONSTRAINT "Autopilot_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── AutopilotRun ─────────────────────────────────────────────────────────
CREATE TABLE "AutopilotRun" (
    "id"          TEXT NOT NULL,
    "autopilotId" TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "issueId"     TEXT,
    "error"       TEXT,
    "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"  TIMESTAMP(3),
    CONSTRAINT "AutopilotRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AutopilotRun_autopilotId_startedAt_idx"
    ON "AutopilotRun"("autopilotId", "startedAt");
ALTER TABLE "AutopilotRun"
    ADD CONSTRAINT "AutopilotRun_autopilotId_fkey"
    FOREIGN KEY ("autopilotId") REFERENCES "Autopilot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Pin ──────────────────────────────────────────────────────────────────
CREATE TABLE "Pin" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind"        TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "icon"        TEXT,
    "targetRef"   TEXT,
    "filter"      JSONB,
    "position"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pin_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Pin_userId_workspaceId_position_idx"
    ON "Pin"("userId", "workspaceId", "position");
ALTER TABLE "Pin"
    ADD CONSTRAINT "Pin_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pin"
    ADD CONSTRAINT "Pin_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
