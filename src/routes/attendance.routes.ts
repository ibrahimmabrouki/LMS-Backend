import { Router } from "express";
import {
  createSession,
  submitAttendance,
  getCourseSessions,
  getCourseRoster,
  getMyAttendance,
  getSessionDetail,
} from "../controllers/attendance.controller";
import {
  authenticateToken,
  authorizeRoles,
} from "../middlewares/auth.middleware";

const attendanceRouter = Router();

// All routes require a valid JWT
attendanceRouter.use(authenticateToken);

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTOR ONLY routes
// ─────────────────────────────────────────────────────────────────────────────

// Create a new attendance session for a course
// POST /attendance/sessions
attendanceRouter.post("/sessions", authorizeRoles("instructor"), createSession);

// Submit attendance records for a session (mark present/absent/late)
// POST /attendance/sessions/:sessionId/records
attendanceRouter.post(
  "/sessions/:sessionId/records",
  authorizeRoles("instructor"),
  submitAttendance,
);

// Get all sessions + records for a course (with summary per session)
// GET /attendance/courses/:courseId/sessions
attendanceRouter.get(
  "/courses/:courseId/sessions",
  authorizeRoles("instructor"),
  getCourseSessions,
);

// Get the roster (enrolled students) for a course
// GET /attendance/courses/:courseId/roster
attendanceRouter.get(
  "/courses/:courseId/roster",
  authorizeRoles("instructor"),
  getCourseRoster,
);

// Get full detail of one session
// GET /attendance/sessions/:sessionId
attendanceRouter.get(
  "/sessions/:sessionId",
  authorizeRoles("instructor"),
  getSessionDetail,
);

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ONLY routes
// ─────────────────────────────────────────────────────────────────────────────

// Get own attendance across all enrolled courses
// GET /attendance/my
attendanceRouter.get("/my", authorizeRoles("student"), getMyAttendance);

export default attendanceRouter;
