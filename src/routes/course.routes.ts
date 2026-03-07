import { Router } from "express";
import {
  getAllCourses,
  getCourseContent,
  createCourse,
  createCourseContent,
  triggerCourseIngest,
} from "../controllers/course.controller";
import {
  authenticateToken,
  authorizeRoles,
} from "../middlewares/auth.middleware";

const courseRouter = Router();

// ── Public (AI service + frontend reads) ────────────────────────────────────

/**
 * GET /courses
 * List all active courses — used by AI service & frontend.
 */
courseRouter.get("/", getAllCourses);

/**
 * GET /courses/:id/content
 * Get all content items for a course.
 * AI service calls this to ingest course material into Qdrant for RAG.
 */
courseRouter.get("/:id/content", getCourseContent);

// ── Protected — Instructor only ──────────────────────────────────────────────

/**
 * POST /courses
 * Instructor creates a new course.
 */
courseRouter.post(
  "/",
  authenticateToken,
  authorizeRoles("instructor"),
  createCourse,
);

/**
 * POST /courses/:id/content
 * Instructor adds content to a course → auto-ingests into AI/Qdrant.
 */
courseRouter.post(
  "/:id/content",
  authenticateToken,
  authorizeRoles("instructor"),
  createCourseContent,
);

/**
 * POST /courses/:id/ingest
 * Manually trigger AI re-ingestion of all course content.
 */
courseRouter.post(
  "/:id/ingest",
  authenticateToken,
  authorizeRoles("instructor"),
  triggerCourseIngest,
);

export default courseRouter;
