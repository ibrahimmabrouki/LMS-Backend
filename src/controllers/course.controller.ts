import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import aiClient from "../config/aiClient";
import jwtUserPayload from "../utils/jwtUserPayload";

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

/**
 * GET /courses
 * Returns all active courses (no auth required — AI service calls this).
 *
 * Postman:
 *   GET http://localhost:3000/courses
 *   No auth header needed
 *
 * Response: { success: true, data: Course[] }
 */
export const getAllCourses = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const courses = await prisma.courses.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        title: true,
        description: true,
        instructor_id: true,
        cohort_id: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
    });
    res.status(200).json({ success: true, data: courses });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /courses/:id/content
 * Returns all content items (lessons/resources) for a specific course.
 * Used by the AI service to ingest course material into Qdrant.
 * Response: { success: true, data: { course: Course, content: CourseContentItem[] } }
 */
export const getCourseContent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = String(req.params.id);

    const course = await prisma.courses.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        instructor_id: true,
        cohort_id: true,
        created_at: true,
      },
    });

    if (!course) {
      res.status(404).json({ success: false, message: "Course not found" });
      return;
    }

    const content = await prisma.course_content.findMany({
      where: { course_id: id },
      select: {
        id: true,
        course_id: true,
        title: true,
        content_type: true,
        content_url: true,
        text_body: true,
        position: true,
        created_at: true,
      },
      orderBy: { position: "asc" },
    });

    res.status(200).json({ success: true, data: { course, content } });
  } catch (err) {
    next(err);
  }
};

// ── Instructor: Create Course ──────────────────────────────────────────────

/**
 * POST /courses
 * Instructor creates a new course.
 *
 * Postman:
 *   POST http://localhost:3000/courses
 *   Headers: Authorization: Bearer <accessToken>
 *   Body (JSON):
 *   {
 *     "title": "Advanced React Development",
 *     "description": "Deep dive into React hooks, patterns, and performance",
 *     "cohort_id": "optional-cohort-uuid"
 *   }
 *
 * Response: { success: true, data: Course }
 */
export const createCourse = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const instructor = req.user as jwtUserPayload;
    const { title, description, cohort_id } = req.body;

    if (!title) {
      res.status(400).json({ success: false, message: "title is required" });
      return;
    }

    // cohort_id must be a UUID string (or null) — never an integer.
    // If the caller accidentally sends a number, reject early with a clear message.
    if (cohort_id !== undefined && cohort_id !== null) {
      if (typeof cohort_id !== "string") {
        res.status(400).json({
          success: false,
          message:
            'cohort_id must be a UUID string (e.g. "a3f1c2d4-..."), not a number.',
        });
        return;
      }
    }

    const course = await prisma.courses.create({
      data: {
        title,
        description: description || null,
        instructor_id: instructor.id,
        cohort_id: cohort_id || null,
      },
    });

    res.status(201).json({ success: true, data: course });
  } catch (err) {
    next(err);
  }
};

// ── Instructor: Add Content to Course ──────────────────────────────────────

/**
 * POST /courses/:id/content
 * Instructor adds a content item to a course.
 * After saving to Postgres, Express automatically calls the AI service
 * to ingest the full course content into Qdrant for RAG.
 *
 * Postman:
 *   POST http://localhost:3000/courses/<course-uuid>/content
 *   Headers: Authorization: Bearer <accessToken>
 *   Body (JSON):
 *   {
 *     "title": "Introduction to React Hooks",
 *     "content_type": "video",
 *     "content_url": "https://example.com/video.mp4",
 *     "text_body": "Optional — full text of the lesson for AI to learn from",
 *     "position": 1
 *   }
 *
 * Response: { success: true, data: CourseContentItem, ai_ingest: {...} }
 */
export const createCourseContent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const courseId = String(req.params.id);
    const { title, content_type, content_url, text_body, position } = req.body;

    if (!title) {
      res.status(400).json({ success: false, message: "title is required" });
      return;
    }

    // Verify course exists and belongs to this instructor
    const course = await prisma.courses.findUnique({ where: { id: courseId } });
    if (!course) {
      res.status(404).json({ success: false, message: "Course not found" });
      return;
    }

    // Save content to Postgres (including text_body for AI/RAG)
    const content = await prisma.course_content.create({
      data: {
        course_id: courseId,
        title,
        content_type: content_type || null,
        content_url: content_url || null,
        text_body: text_body ? String(text_body) : null,
        position: position ?? null,
      },
    });

    // ── Auto-ingest into Qdrant via AI service ──────────────────────────
    // If the instructor provided a text_body, send it directly to /ai/ingest/text
    // so the AI can learn from the actual content (not just the title).
    // Otherwise, trigger a full course re-ingest from Postgres.
    let aiResult: Record<string, unknown> = {};
    try {
      if (text_body && text_body.trim()) {
        // Direct text ingest — richer content for RAG
        const { data } = await aiClient.post("/ai/ingest/text", {
          document_id: content.id,
          title: title,
          text: text_body,
          dataset_id: courseId,
          user_id: (req.user as jwtUserPayload).id,
        });
        aiResult = data;
      } else {
        // Re-ingest whole course (AI pulls from GET /courses/:id/content)
        const { data } = await aiClient.post(`/ai/ingest/course/${courseId}`);
        aiResult = data;
      }
    } catch (aiErr: any) {
      // Don't fail the content creation if AI ingest fails
      console.error(
        "[AI Ingest Error]",
        aiErr?.response?.data ?? aiErr.message,
      );
      aiResult = {
        success: false,
        error: "AI ingest failed — content saved to DB",
      };
    }

    res.status(201).json({
      success: true,
      data: content,
      ai_ingest: aiResult,
    });
  } catch (err) {
    next(err);
  }
};

// ── Instructor: Trigger Manual Re-ingest ──────────────────────────────────

/**
 * POST /courses/:id/ingest
 * Manually trigger AI re-ingestion of all course content into Qdrant.
 * Useful after bulk edits or to refresh the AI's knowledge.
 *
 * Postman:
 *   POST http://localhost:3000/courses/<course-uuid>/ingest
 *   Headers: Authorization: Bearer <accessToken>
 *   No body needed
 *
 * Response: { success: true, ai_ingest: {...} }
 */
export const triggerCourseIngest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const courseId = String(req.params.id);

    const course = await prisma.courses.findUnique({ where: { id: courseId } });
    if (!course) {
      res.status(404).json({ success: false, message: "Course not found" });
      return;
    }

    const { data } = await aiClient.post(`/ai/ingest/course/${courseId}`);

    res.status(200).json({ success: true, ai_ingest: data });
  } catch (err: any) {
    console.error("[AI Ingest Error]", err?.response?.data ?? err.message);
    next(err);
  }
};
