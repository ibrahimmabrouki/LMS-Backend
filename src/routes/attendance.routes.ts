import { Router } from "express";
import {
  createSession,
  submitAttendance,
  getCourseSessions,
  getCourseRoster,
  getMyAttendance,
  getSessionDetail,
  getAllStudents,
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

//  this apis is for creating a new attendance session for a course
// POST /attendance/sessions
attendanceRouter.post("/sessions", authorizeRoles("instructor"), createSession);

//  this apis is for submitting attendance records for a session (present/absent/late)
// POST /attendance/sessions/:sessionId/records
attendanceRouter.post(
  "/sessions/:sessionId/records",
  authorizeRoles("instructor"),
  submitAttendance
);

//  this apis is for getting all attendance sessions and records for one course
// GET /attendance/courses/:courseId/sessions
attendanceRouter.get(
  "/courses/:courseId/sessions",
  authorizeRoles("instructor"),
  getCourseSessions
);

//  this apis is for getting the course roster before taking attendance
// GET /attendance/courses/:courseId/roster
attendanceRouter.get(
  "/courses/:courseId/roster",
  authorizeRoles("instructor"),
  getCourseRoster
);

//  this apis is for getting full details of one attendance session
// GET /attendance/sessions/:sessionId
attendanceRouter.get(
  "/sessions/:sessionId",
  authorizeRoles("instructor"),
  getSessionDetail
);

attendanceRouter.get(
  "/view-students",
  authorizeRoles("instructor"),
  getAllStudents
);

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ONLY routes
// ─────────────────────────────────────────────────────────────────────────────

//  this apis is for the student to get their own attendance across all courses
// GET /attendance/my
attendanceRouter.get("/my", authorizeRoles("student"), getMyAttendance);

export default attendanceRouter;
