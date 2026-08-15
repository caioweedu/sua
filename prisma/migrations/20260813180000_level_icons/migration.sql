-- CreateTable
CREATE TABLE "LevelIcon" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "iconUrl" TEXT NOT NULL,

    CONSTRAINT "LevelIcon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LevelIcon_level_key" ON "LevelIcon"("level");
