import express from "express";
import authRouter from "./routes/auth.routes";
import userSkillsRouter from "./routes/user.skills.routes";
import { StudentProfileRouter, InstructorProfileRouter } from "./routes/user.profile.router";
import { instructorCourseRouter, studentCourseRouter,
  publicCourseRouter} from "./routes/courses.routes";
import {instructorContentRouter, studentContentRouter} from "./routes/content.routes"
import {instructorAssignmentRouter, studentAssignmentRouter} from "./routes/assignment.routes";
import {instructorSubmissionRouter, studentSbmissionRouter} from "./routes/submission.routes";
import {InstructorFeedbackRouter, StudentFeedbackRouter} from "./routes/feedback.routes";
import {instructorNotificationRouter, studentNotificationRouter} from "./routes/notification.routes";
import attendanceRouter from "./routes/attendance.routes";
import aiRouter from "./routes/ai.routes";
import adminRouter from "./routes/admin.routes";

import errorHandler from "./middlewares/error.middleware";

const app = express();

app.use(express.json());

// ── Auth ──────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);

// ── Skills & Profile ──────────────────────────────────────────────────────────
app.use("/api/skills", userSkillsRouter);
app.use("/skills", userSkillsRouter);
app.use("/api/profile", StudentProfileRouter);
app.use("/api/instuctor/profile", InstructorProfileRouter);
app.use("/profile", StudentProfileRouter);
app.use("/instuctor/profile", InstructorProfileRouter);

// ── Courses (friend's instructor/student split routes) ────────────────────────
app.use("/api/instructor/course", instructorCourseRouter);
app.use("/api/student/course", studentCourseRouter);

// ── Content (friend's routes — auto-ingest to Qdrant on add/edit/delete) ─────
app.use("/api/instructor/courses/content", instructorContentRouter);
app.use("/api/student/courses/content", studentContentRouter);

// ── Assignments ───────────────────────────────────────────────────────────────
app.use("/api/instructor/courses/assignment", instructorAssignmentRouter);
app.use("/api/student/courses/assignment", studentAssignmentRouter);

// ── Submissions ───────────────────────────────────────────────────────────────
app.use("/api/instructor/courses/submissions", instructorSubmissionRouter);
app.use("/api/student/courses/submissions", studentSbmissionRouter);

// ── Feedback ──────────────────────────────────────────────────────────────────
app.use("/api/instructor/feedback", InstructorFeedbackRouter);
app.use("/api/student/feedback", StudentFeedbackRouter);

// ── Attendance ────────────────────────────────────────────────────────────────
app.use("/api/attendance", attendanceRouter);
app.use("/attendance", attendanceRouter);

// ── Courses (public AI ingest proxy — GET /courses and /courses/:id/content) ──
app.use("/courses", publicCourseRouter);

//routes for feedbask
app.use('/api/instructor/feedback', InstructorFeedbackRouter);
app.use('/api/student/feedback', StudentFeedbackRouter);
//routes for notification
app.use('/api/instructor/notification', instructorNotificationRouter);
app.use('/api/student/notification', studentNotificationRouter);
// ── AI routes (search/ask/sync) ───────────────────────────────────────────────
app.use("/api/ai", aiRouter);
app.use("/ai", aiRouter);
// ── Admin routes ──────────────────────────────────────────────────────────────
app.use("/api/admin", adminRouter);
app.use(errorHandler);

export default app;
