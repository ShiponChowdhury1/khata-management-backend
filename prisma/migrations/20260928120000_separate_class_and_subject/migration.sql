-- Migration: Separate AcademicClass and Subject from SubjectPricing
-- Generated manually for safe incremental data migration without data loss.

-- Step 1: Create table "academic_classes"
CREATE TABLE "academic_classes" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_classes_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create table "subjects"
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create indexes on "academic_classes" and "subjects" including case-insensitive unique indexes
CREATE INDEX "academic_classes_displayOrder_idx" ON "academic_classes"("displayOrder");
CREATE INDEX "academic_classes_isActive_idx" ON "academic_classes"("isActive");
CREATE UNIQUE INDEX "academic_classes_name_lower_idx" ON "academic_classes" (LOWER(TRIM("name")));

CREATE INDEX "subjects_isActive_idx" ON "subjects"("isActive");
CREATE UNIQUE INDEX "subjects_name_lower_idx" ON "subjects" (LOWER(TRIM("name")));

-- Step 4: Backfill distinct classes from existing "subject_pricings"
INSERT INTO "academic_classes" ("id", "name", "displayOrder", "isActive", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::TEXT,
    TRIM("className"),
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (LOWER(TRIM("className"))) "className"
    FROM "subject_pricings"
    WHERE "className" IS NOT NULL AND TRIM("className") <> ''
    ORDER BY LOWER(TRIM("className")), "className"
) AS distinct_classes;

-- Step 5: Backfill distinct subjects from existing "subject_pricings"
INSERT INTO "subjects" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::TEXT,
    TRIM("subjectName"),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (LOWER(TRIM("subjectName"))) "subjectName"
    FROM "subject_pricings"
    WHERE "subjectName" IS NOT NULL AND TRIM("subjectName") <> ''
    ORDER BY LOWER(TRIM("subjectName")), "subjectName"
) AS distinct_subjects;

-- Step 6: Add nullable "classId" and "subjectId" columns to "subject_pricings"
ALTER TABLE "subject_pricings" ADD COLUMN "classId" TEXT;
ALTER TABLE "subject_pricings" ADD COLUMN "subjectId" TEXT;

-- Step 7: Populate "classId" and "subjectId" in "subject_pricings" matching trimmed names case-insensitively
UPDATE "subject_pricings" sp
SET "classId" = ac."id"
FROM "academic_classes" ac
WHERE LOWER(TRIM(sp."className")) = LOWER(TRIM(ac."name"));

UPDATE "subject_pricings" sp
SET "subjectId" = s."id"
FROM "subjects" s
WHERE LOWER(TRIM(sp."subjectName")) = LOWER(TRIM(s."name"));

-- Step 8: Set NOT NULL constraints on "classId" and "subjectId"
ALTER TABLE "subject_pricings" ALTER COLUMN "classId" SET NOT NULL;
ALTER TABLE "subject_pricings" ALTER COLUMN "subjectId" SET NOT NULL;

-- Step 9: Drop old indexes and unique constraint from "subject_pricings"
DROP INDEX IF EXISTS "subject_pricings_className_idx";
DROP INDEX IF EXISTS "subject_pricings_subjectName_className_key";

-- Step 10: Create new indexes, composite unique constraint, and foreign keys
CREATE INDEX "subject_pricings_classId_idx" ON "subject_pricings"("classId");
CREATE INDEX "subject_pricings_subjectId_idx" ON "subject_pricings"("subjectId");
CREATE UNIQUE INDEX "subject_pricings_classId_subjectId_key" ON "subject_pricings"("classId", "subjectId");

ALTER TABLE "subject_pricings" 
    ADD CONSTRAINT "subject_pricings_classId_fkey" 
    FOREIGN KEY ("classId") REFERENCES "academic_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subject_pricings" 
    ADD CONSTRAINT "subject_pricings_subjectId_fkey" 
    FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 11: Drop old columns "className" and "subjectName"
ALTER TABLE "subject_pricings" DROP COLUMN "className";
ALTER TABLE "subject_pricings" DROP COLUMN "subjectName";
