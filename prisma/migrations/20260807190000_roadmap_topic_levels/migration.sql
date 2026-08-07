-- AlterTable
ALTER TABLE "roadmap_steps" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "practice" JSONB;

-- AlterTable
ALTER TABLE "roadmaps" ADD COLUMN     "currentLevel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "levelsMeta" JSONB,
ADD COLUMN     "sourceTemplateId" INTEGER,
ADD COLUMN     "topic" TEXT,
ADD COLUMN     "totalLevels" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "roadmap_templates" (
    "id" SERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "topicSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "difficulty" TEXT,
    "estimatedHours" DOUBLE PRECISION,
    "totalLevels" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_templates_topicSlug_key" ON "roadmap_templates"("topicSlug");

-- CreateIndex
CREATE INDEX "roadmap_steps_roadmapId_idx" ON "roadmap_steps"("roadmapId");

-- CreateIndex
CREATE INDEX "roadmaps_userId_idx" ON "roadmaps"("userId");

-- AddForeignKey
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "roadmap_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
