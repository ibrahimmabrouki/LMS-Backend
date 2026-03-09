-- AlterTable: add text_body column to course_content
-- Full lesson text stored here so the AI service can ingest it into Qdrant for RAG.
ALTER TABLE "course_content" ADD COLUMN "text_body" TEXT;
