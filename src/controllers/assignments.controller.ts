import { Request, Response, NextFunction } from "express";
import jwtUserPayload from "../utils/jwtUserPayload";
import { prisma } from "../lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { includes } from "zod";

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

//Create assigment in the Courses owned by the instructor so what we need is
//Course ID that is owned by the instructor to be sent using the params
export const createAssignmentByIns = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    if (userPayload.role !== "instructor") {
      return res
        .status(403)
        .json({ message: "Only instructors can create assignments" });
    }

    let { courseId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;
    const { title, description, type, due_date } = req.body;

    // Confirm active cohort exists
    const today = new Date();
    if (
      due_date &&
      new Date(due_date) < new Date(today.toISOString().split("T")[0])
    ) {
      return res
        .status(400)
        .json({ message: "due_date cannot be in the past" });
    }
    const activeCohort = await prisma.cohorts.findFirst({
      where: {
        start_date: { lte: today },
        end_date: { gte: today },
      },
    });

    if (!activeCohort) {
      return res.status(400).json({ message: "No active cohort found" });
    }

    // Confirm course exists and belongs to this instructor
    const course = await prisma.courses.findUnique({
      where: { id: courseId },
    });

    if (!course) return res.status(404).json({ message: "Course not found" });

    if (course.instructor_id !== userPayload.id) {
      return res
        .status(403)
        .json({ message: "You do not have access to this course" });
    }

    // Confirm the course belongs to the active cohort
    // Instructors cannot add assignments to old cohort courses
    if (course.cohort_id !== activeCohort.id) {
      return res.status(400).json({
        message: "Cannot add assignments to a course from a previous cohort",
      });
    }

    const assignment = await prisma.assignments.create({
      data: {
        course_id: courseId,
        title,
        description,
        type,
        due_date: due_date ? new Date(due_date) : null,
        max_score: 100, // always defaulted to 100 as per requirement
      },
    });

    //getting all active students who are also found in the active cohort
    const activeStudents = await prisma.users.findMany({
      where: {
        role: "student",
        is_active: true,
        created_at: { gte: activeCohort.start_date ?? new Date() },
      },
      select: { id: true },
    });

    if (activeStudents.length === 0) {
      return res
        .status(404)
        .json({ message: "No active students found in the active cohort" });
    }

    //adding one notification row per student which is active
    const announcementId = uuidv4();
    await prisma.notifications.createMany({
      data: activeStudents.map((student) => ({
        user_id: student.id,
        announcement_id: announcementId,
        type: "assignment",
        title: `${title} is new assignment`,
        message: description,
        is_read: false,
        reference_type: "assignment",
        reference_id: assignment.id,
      })),
    });

    return res.status(201).json({
      message: "Assignment created successfully",
      assignment,
    });
  } catch (err) {
    next(err);
  }
};

//to be used
//Get all the assigment related owned by the same instructor for some course owned by them
export const getAllAssignmentsByIns = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    let { courseId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;

    const course = await prisma.courses.findUnique({
      where: { id: courseId },
    });

    if (!course) return res.status(404).json({ message: "Course not found" });

    if (course.instructor_id !== userPayload.id) {
      return res
        .status(403)
        .json({ message: "You do not have access to this course" });
    }

    const assignments = await prisma.assignments.findMany({
      where: { course_id: courseId },
      orderBy: { created_at: "asc" },
    });

    if (assignments.length === 0) {
      return res
        .status(404)
        .json({ message: "No assignments found for this course" });
    }

    return res.status(200).json({ assignments });
  } catch (err) {
    next(err);
  }
};

//Get all the assigments which are due already
export const getDueAssignmentsByIns = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    let { courseId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;

    const course = await prisma.courses.findUnique({
      where: { id: courseId },
    });

    if (!course) return res.status(404).json({ message: "Course not found" });

    if (course.instructor_id !== userPayload.id) {
      return res
        .status(403)
        .json({ message: "You do not have access to this course" });
    }

    const assignments = await prisma.assignments.findMany({
      where: {
        course_id: courseId,
        due_date: {
          lte: new Date(), // due_date is today or in the past = overdue/due
        },
      },
      orderBy: { due_date: "asc" },
    });

    if (assignments.length === 0) {
      return res.status(404).json({ message: "No due assignments found" });
    }

    return res.status(200).json({ assignments });
  } catch (err) {
    next(err);
  }
};

//Get all the assigments which are not due yet
export const getUpcomingAssignmentsByIns = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    let { courseId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;

    const course = await prisma.courses.findUnique({
      where: { id: courseId },
    });

    if (!course) return res.status(404).json({ message: "Course not found" });

    if (course.instructor_id !== userPayload.id) {
      return res
        .status(403)
        .json({ message: "You do not have access to this course" });
    }

    const assignments = await prisma.assignments.findMany({
      where: {
        course_id: courseId,
        due_date: {
          gt: new Date(), // due_date is strictly in the future = not due yet
        },
      },
      orderBy: { due_date: "asc" },
    });

    if (assignments.length === 0) {
      return res.status(404).json({ message: "No upcoming assignments found" });
    }

    return res.status(200).json({ assignments });
  } catch (err) {
    next(err);
  }
};

//Edit the assigment based on it id
export const editAssignmentByIns = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let { assignmentId } = req.params;
    assignmentId = Array.isArray(assignmentId) ? assignmentId[0] : assignmentId;

    const { title, description, type, due_date } = req.body;

    if (type && !["assignment", "project"].includes(type)) {
      return res
        .status(400)
        .json({ message: "type must be 'assignment' or 'project'" });
    }

    // we find the existing assigment in order to check if we have course that belongs to the user
    const existing = await prisma.assignments.findUnique({
      where: { id: assignmentId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Now use the course_id that lives on the assignment to fetch the course
    const course = await prisma.courses.findUnique({
      where: { id: existing.course_id! },
      select: { instructor_id: true },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.instructor_id !== userPayload.id) {
      return res
        .status(403)
        .json({ message: "You do not have access to this course" });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (due_date !== undefined) updateData.due_date = new Date(due_date);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fields provided to update" });
    }

    const updated = await prisma.assignments.update({
      where: { id: assignmentId },
      data: updateData,
    });

    return res.status(200).json({
      message: "Assignment updated successfully",
      assignment: updated,
    });
  } catch (err) {
    next(err);
  }
};

//Delete some assignment based on its id
export const deleteAssignmentByIns = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    if (userPayload.role !== "instructor") {
      return res
        .status(403)
        .json({ message: "Only instructors can delete assignments" });
    }

    let { assignmentId } = req.params;
    assignmentId = Array.isArray(assignmentId) ? assignmentId[0] : assignmentId;

    const assignment = await prisma.assignments.findUnique({
      where: { id: assignmentId },
      select: { course_id: true },
    });

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const course = await prisma.courses.findUnique({
      where: { id: assignment.course_id! },
      select: { cohort_id: true, instructor_id: true },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.instructor_id !== userPayload.id) {
      return res
        .status(403)
        .json({ message: "You do not have access to this assignment" });
    }

    // Active cohort check
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

    // Prevent deleting assignments from old cohort courses
    if (course.cohort_id !== activeCohort.id) {
      return res.status(400).json({
        message: "Cannot delete an assignment from a previous cohort",
      });
    }

    // Delete submissions first — FK constraint requires this before deleting the assignment
    await prisma.submissions.deleteMany({
      where: { assignment_id: assignmentId },
    });

    await prisma.assignments.delete({
      where: { id: assignmentId },
    });

    return res.status(200).json({
      message: "Assignment and all its submissions deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

//Student APIs for the Content
//Get all enrolled Content
//in the frontend we can arrange them based on overdue and due
export const GetAssigmentsByCourse = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    let { courseId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;

    const course = await prisma.courses.findUnique({ where: { id: courseId } });
    const courseName = course?.title;

    const assigments = await prisma.assignments.findMany({
      where: { course_id: courseId },
    });
    if (assigments.length === 0) {
      return res.status(404).json({
        message: `No Assignments was found under Course ${courseName}`,
      });
    }

    return res.status(200).json({ Assignements: assigments });
  } catch (err) {
    next(err);
  }
};

export const GetAllPendingAssignments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    const enrollments = await prisma.enrollments.findMany({
      where: { user_id: userPayload.id },
    });

    if (enrollments.length === 0) {
      return res.status(404).json({ message: "No enrollments found" });
    }

    const enrolledCourseIds = enrollments.map((e) => e.course_id);

    const courses = await prisma.courses.findMany({
      where: { id: { in: enrolledCourseIds } },
      select: {
        id: true,
        title: true,
        assignments: {
          select: {
            id: true,
            title: true,
            type: true,
            due_date: true,
            max_score: true,
          },
        },
      },
    });

    if (courses.length === 0) {
      return res.status(404).json({ message: "No courses found" });
    }

    // Get all assignments the student already submitted
    const submissions = await prisma.submissions.findMany({
      where: { student_id: userPayload.id },
    });

    const submittedAssignmentIds = submissions.map((s) => s.assignment_id);

    // For each course, filter out assignments the student already submitted
    const result = courses
      .map((course) => ({
        course_title: course.title,
        pending_assignments: course.assignments.filter(
          (a) => !submittedAssignmentIds.includes(a.id)
        ),
      }))
      .filter((course) => course.pending_assignments.length > 0);

    if (result.length === 0) {
      return res.status(404).json({ message: "No pending assignments found" });
    }

    return res.status(200).json({ courses: result });
  } catch (err) {
    next(err);
  }
};

//this is the main method to get all the assigments
export const GetAllAssignments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    const enrollments = await prisma.enrollments.findMany({
      where: { user_id: userPayload.id },
    });

    if (enrollments.length === 0)
      return res.status(404).json({ message: "No enrollments found" });

    // get courses for student
    const courses = await prisma.courses.findMany({
      where: { id: { in: enrollments.map((e) => e.course_id) } },
      select: { id: true, title: true },
    });

    const courseMap = new Map(courses.map((c) => [c.id, c.title]));

    // get assignments for student
    const assignments = await prisma.assignments.findMany({
      where: { course_id: { in: enrollments.map((e) => e.course_id) } },
    });

    if (assignments.length === 0)
      return res.status(404).json({ message: "No assignments found" });

    // get submissions for student assignments
    const submissions = await prisma.submissions.findMany({
      where: { student_id: userPayload.id },
    });

    // get feedbacks for student submissions
    const feedbacks = await prisma.feedback.findMany({
      where: {
        submission_id: { in: submissions.map((s) => s.id) },
      },
    });

    // submissions and feedbacks mapping
    const submissionMap = new Map(submissions.map((s) => [s.assignment_id, s]));
    const feedbackMap = new Map(feedbacks.map((f) => [f.submission_id, f]));

    return res.status(200).json({
      assignments: assignments.map((a) => {
        const submission = submissionMap.get(a.id);
        const feedback = submission ? feedbackMap.get(submission.id) : null;

        return {
          ...a,
          course_title: courseMap.get(a.course_id!) ?? "Unknown Course",

          submission_status: submission?.status ?? "pending",
          due_status: getDueStatus(a.due_date),

          // fetched from submissions
          submission_url: submission?.submission_url ?? null,

          // fetched from feedbacks
          rating: feedback?.rating ?? null,
          comment: feedback?.comment ?? null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
};

const getSubmissionStatus = (
  assignmentId: string,
  submissions: any[]
): string => {
  const submission = submissions.find((s) => s.assignment_id === assignmentId);
  if (!submission) return "pending";
  return submission.status; // 'graded' or 'ungraded'
};

const getDueStatus = (due_date: Date | null): string => {
  if (!due_date) return "not due";
  return new Date() > new Date(due_date) ? "due" : "not due";
};
