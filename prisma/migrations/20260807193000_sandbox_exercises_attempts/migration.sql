-- CreateTable
CREATE TABLE "sandbox_exercises" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "tests" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sandbox_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sandbox_attempts" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "exerciseId" INTEGER,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "output" TEXT NOT NULL DEFAULT '',
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "testedCases" INTEGER NOT NULL DEFAULT 0,
    "passedCases" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sandbox_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sandbox_exercises_userId_idx" ON "sandbox_exercises"("userId");

-- CreateIndex
CREATE INDEX "sandbox_attempts_userId_idx" ON "sandbox_attempts"("userId");
