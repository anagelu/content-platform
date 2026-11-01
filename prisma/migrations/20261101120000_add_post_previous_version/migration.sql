-- One-level undo for post drafts: stash the pre-save body/summary so an AI
-- refine or manual edit can be reverted. Revert swaps current <-> previous
-- rather than appending, so this stays a single pair of columns.
ALTER TABLE "Post" ADD COLUMN "previousBody" TEXT;
ALTER TABLE "Post" ADD COLUMN "previousSummary" TEXT;
ALTER TABLE "Post" ADD COLUMN "previousLabel" TEXT;
ALTER TABLE "Post" ADD COLUMN "previousSavedAt" DATETIME;
