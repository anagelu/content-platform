ALTER TABLE "BookSection" ADD COLUMN "parentSectionId" INTEGER REFERENCES "BookSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BookSection_parentSectionId_position_idx"
ON "BookSection" ("parentSectionId", "position");
