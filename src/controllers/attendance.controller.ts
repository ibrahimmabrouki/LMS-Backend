import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import asyncHandler from "../lib/asyncHandler";
import jwtUserPayload from "../utils/jwtUserPayload";

// Inline record shape to avoid implicit-any on callbacks
type AttendanceRecordWithUser = {
  session_id: string;
  student_id: string;
  status: string | null;
  users: { id: string; username: string; email: string };
};

type SessionWithRecords = {
  id: string;
  session_date: Date;
  course_id: string | null;
  attendance_records: AttendanceRecordWithUser[];
};

type EnrollmentWithUser = {
  user_id: string;
  course_id: string;
  enrolled_at: Date | null;
  users: { id: string; username: string; email: string };
};

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTOR: Create a new attendance session for a course
// POST /attendance/sessions
// Body: { course_id, session_date }
// ─────────────────────────────────────────────────────────────────────────────
export const createSession = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { course_id, session_date } = req.body;

    if (!course_id || !session_date) {
      res
        .status(400)
        .json({ message: "course_id and session_date are required" });
      return;
    }

    // Verify that the requesting instructor owns this course
    const course = await prisma.courses.findFirst({
      where: {
        id: course_id,
        instructor_id: req.user!.id,
        deleted_at: null,
      },
    });

    if (!course) {
      res.status(403).json({ message: "Course not found or access denied" });
      return;
    }

    const session = await prisma.attendance_sessions.create({
      data: {
        course_id,
        session_date: new Date(session_date),
      },
    });

    res.status(201).json({
      message: "Attendance session created",
      session,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTOR: Submit (save) attendance records for a session
// POST /attendance/sessions/:sessionId/records
// Body: { records: [{ student_id, status }] }
// status: "present" | "absent" | "late"
// ─────────────────────────────────────────────────────────────────────────────
export const submitAttendance = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const { records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      res.status(400).json({ message: "records array is required" });
      return;
    }

    // Validate each record has required fields
    for (const r of records) {
      if (!r.student_id || !r.status) {
        res
          .status(400)
          .json({ message: "Each record must have student_id and status" });
        return;
      }
      if (!["present", "absent", "late"].includes(r.status)) {
        res.status(400).json({
          message: `Invalid status "${r.status}". Must be present, absent, or late`,
        });
        return;
      }
    }

    // Verify the session belongs to this instructor's course
    const session = await prisma.attendance_sessions.findFirst({
      where: {
        id: sessionId,
        courses: { instructor_id: req.user!.id },
      },
      include: { courses: true },
    });

    if (!session) {
      res.status(403).json({ message: "Session not found or access denied" });
      return;
    }

    // Upsert all records (create or update if already exists)
    const upserts = records.map((r: { student_id: string; status: string }) =>
      prisma.attendance_records.upsert({
        where: {
          session_id_student_id: {
            session_id: sessionId,
            student_id: r.student_id,
          },
        },
        create: {
          session_id: sessionId,
          student_id: r.student_id,
          status: r.status,
        },
        update: {
          status: r.status,
        },
      })
    );

    const saved = await prisma.$transaction(upserts);

    res.status(200).json({
      message: "Attendance saved successfully",
      saved_count: saved.length,
      session_id: sessionId,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTOR: Get all sessions for a course with attendance summary
// GET /attendance/courses/:courseId/sessions
// ─────────────────────────────────────────────────────────────────────────────
export const getCourseSessions = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const courseId = req.params.courseId as string;
    // Verify course belongs to this instructor
    const course = await prisma.courses.findFirst({
      where: {
        id: courseId,
        instructor_id: req.user!.id,
        deleted_at: null,
      },
    });

    if (!course) {
      res.status(403).json({ message: "Course not found or access denied" });
      return;
    }

    const sessions = await prisma.attendance_sessions.findMany({
      where: { course_id: courseId },
      orderBy: { session_date: "desc" },
      include: {
        attendance_records: {
          include: {
            users: {
              select: { id: true, username: true, email: true },
            },
          },
        },
      },
    });

    const result = (sessions as SessionWithRecords[]).map((s) => ({
      session_id: s.id,
      session_date: s.session_date,
      total_students: s.attendance_records.length,
      present: s.attendance_records.filter((r) => r.status === "present")
        .length,
      absent: s.attendance_records.filter((r) => r.status === "absent").length,
      late: s.attendance_records.filter((r) => r.status === "late").length,
      records: s.attendance_records.map((r) => ({
        student_id: r.student_id,
        student_name: r.users.username,
        student_email: r.users.email,
        status: r.status,
      })),
    }));

    res.status(200).json({ course_id: courseId, sessions: result });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTOR: Get students enrolled in a course (the roster)
// GET /attendance/courses/:courseId/roster
// ─────────────────────────────────────────────────────────────────────────────
export const getCourseRoster = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const courseId = req.params.courseId as string;

    // Verify instructor owns the course
    const course = await prisma.courses.findFirst({
      where: {
        id: courseId,
        instructor_id: req.user!.id,
        deleted_at: null,
      },
    });

    if (!course) {
      res.status(403).json({ message: "Course not found or access denied" });
      return;
    }

    const enrollments = await prisma.enrollments.findMany({
      where: { course_id: courseId },
      include: {
        users: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    const roster = (enrollments as EnrollmentWithUser[]).map((e) => ({
      student_id: e.user_id,
      student_name: e.users.username,
      student_email: e.users.email,
    }));

    res.status(200).json({ course_id: courseId, roster });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT: Get own attendance across all enrolled courses
// GET /attendance/my
// ─────────────────────────────────────────────────────────────────────────────
export const getMyAttendance = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user!.id;

    const records = await prisma.attendance_records.findMany({
      where: { student_id: studentId },
      include: {
        attendance_sessions: {
          include: {
            courses: {
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: {
        attendance_sessions: { session_date: "desc" },
      },
    });

    // Group by course
    const courseMap: Record<
      string,
      {
        course_id: string;
        course_title: string;
        total: number;
        present: number;
        absent: number;
        late: number;
        attendance_percentage: number;
        sessions: object[];
      }
    > = {};

    for (const r of records) {
      const course = r.attendance_sessions.courses;
      if (!course) continue;

      if (!courseMap[course.id]) {
        courseMap[course.id] = {
          course_id: course.id,
          course_title: course.title,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          attendance_percentage: 0,
          sessions: [],
        };
      }

      courseMap[course.id].total++;
      if (r.status === "present") courseMap[course.id].present++;
      else if (r.status === "absent") courseMap[course.id].absent++;
      else if (r.status === "late") courseMap[course.id].late++;

      courseMap[course.id].sessions.push({
        session_id: r.session_id,
        session_date: r.attendance_sessions.session_date,
        status: r.status,
      });
    }

    // Calculate percentage per course (late counts as present for percentage)
    const attendance = Object.values(courseMap).map((c) => ({
      ...c,
      attendance_percentage:
        c.total === 0 ? 0 : Math.round(((c.present + c.late) / c.total) * 100),
    }));

    res.status(200).json({ student_id: studentId, attendance });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTOR: Get full attendance report for a specific session
// GET /attendance/sessions/:sessionId
// ─────────────────────────────────────────────────────────────────────────────
export const getSessionDetail = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const sessionId = req.params.sessionId as string;

    const session = (await prisma.attendance_sessions.findFirst({
      where: {
        id: sessionId,
        courses: { instructor_id: req.user!.id },
      },
      include: {
        courses: { select: { id: true, title: true } },
        attendance_records: {
          include: {
            users: {
              select: { id: true, username: true, email: true },
            },
          },
        },
      },
    })) as any;

    if (!session) {
      res.status(403).json({ message: "Session not found or access denied" });
      return;
    }

    const records = session.attendance_records as AttendanceRecordWithUser[];

    res.status(200).json({
      session_id: session.id,
      session_date: session.session_date,
      course: session.courses,
      total_students: records.length,
      summary: {
        present: records.filter((r) => r.status === "present").length,
        absent: records.filter((r) => r.status === "absent").length,
        late: records.filter((r) => r.status === "late").length,
      },
      records: records.map((r) => ({
        student_id: r.student_id,
        student_name: r.users.username,
        student_email: r.users.email,
        status: r.status,
      })),
    });
  }
);

export const getAllStudents = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const today = new Date();

    const activeCohort = await prisma.cohorts.findFirst({
      where: {
        start_date: { lte: today },
        end_date: { gte: today },
      },
    });

    if (!activeCohort) {
      return res.status(400).json({ message: "No active cohort found" });
    }

    console.log(activeCohort);
    const firstCourse = await prisma.courses.findFirst({
      where: { cohort_id: activeCohort.id },
    });

    if (!firstCourse) {
      return res
        .status(404)
        .json({ message: "No Courses in the Active Cohort" });
    }

    const enrollments = await prisma.enrollments.findMany({
      where: { course_id: firstCourse.id },
      select: {
        user_id: true,
      },
    });

    const studentIds = enrollments.map((e) => e.user_id);

    const students = await prisma.users.findMany({
      where: {
        id: { in: studentIds },
      },
      select: {
        id: true,
        email: true,
        profiles: {
          select: {
            full_name: true,
          },
        },
      },
    });
    
    const formattedStudents = students.map((student) => ({
      id: student.id,
      email: student.email,
      full_name: student.profiles?.full_name,
    }));
    
   return  res.status(200).json(formattedStudents);

  } catch (err) {
    next(err);
  }
};
