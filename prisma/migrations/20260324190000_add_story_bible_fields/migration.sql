ALTER TABLE "Book" ADD COLUMN "storySynopsis" TEXT;
ALTER TABLE "Book" ADD COLUMN "storyChapterCount" INTEGER;
ALTER TABLE "Book" ADD COLUMN "storyStructureNotes" TEXT;
ALTER TABLE "Book" ADD COLUMN "characterProfilesJson" TEXT;
ALTER TABLE "Book" ADD COLUMN "settingProfilesJson" TEXT;

ALTER TABLE "BookSection" ADD COLUMN "characterIdsJson" TEXT;
ALTER TABLE "BookSection" ADD COLUMN "settingIdsJson" TEXT;
ALTER TABLE "BookSection" ADD COLUMN "sceneGoal" TEXT;
ALTER TABLE "BookSection" ADD COLUMN "sceneConflict" TEXT;
ALTER TABLE "BookSection" ADD COLUMN "povCharacterId" TEXT;
