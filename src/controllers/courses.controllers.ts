import { Request, Response, NextFunction } from "express";
import jwtUserPayload from "../utils/jwtUserPayload";
import { prisma } from "../lib/prisma";

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

// ── AI-facing read endpoints (public) ──────────────────────────────────────

export const getAllCoursesForAI = async (
  req: Request,
  res: Response,
  next: NextFunction
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

    return res.status(200).json({ success: true, data: courses });
  } catch (err) {
    next(err);
  }
};

export const getCourseContentForAI = async (
  req: Request,
  res: Response,
  next: NextFunction
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
      return res.status(404).json({ success: false, message: "Course not found" });
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

    return res.status(200).json({ success: true, data: { course, content } });
  } catch (err) {
    next(err);
  }
};

//Create Course by the Instructor
export const createCourseInstructor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;

    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (userPayload.role !== "instructor") {
      return res
        .status(403)
        .json({ message: "Only instructors can create courses" });
    }

    const { title, description } = req.body;

    const today = new Date();

    const currentCohort = await prisma.cohorts.findFirst({
      where: {
        start_date: { lte: today },
        end_date: { gte: today },
      },
    });

    if (!currentCohort || !currentCohort.start_date) {
      return res.status(400).json({
        message: "No active cohort available",
      });
    }

    const course = await prisma.courses.create({
      data: {
        title,
        description,
        instructor_id: userPayload.id,
        cohort_id: currentCohort.id,
      },
    });

    const students = await prisma.users.findMany({
      where: {
        role: "student",
        created_at: {
          gte: currentCohort.start_date,
        },
      },
      select: { id: true },
    });

    await prisma.enrollments.createMany({
      data: students.map((student) => ({
        user_id: student.id,
        course_id: course.id,
      })),
      skipDuplicates: true,
    });

    return res.status(201).json(course);
  } catch (err) {
    next(err);
  }
};
// Get all courses created by the instructor in the active cohort
export const getAllCoursesByInstructor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const instructorId = userPayload.id;

    // Find the active cohort
    const activeCohort = await prisma.cohorts.findFirst({
      where: {
        start_date: { lte: new Date() },
        end_date: { gte: new Date() },
      },
    });

    if (!activeCohort) {
      return res.status(404).json({ message: "No active cohort found" });
    }

    // Find courses by instructor in the active cohort
    const courses = await prisma.courses.findMany({
      where: {
        instructor_id: instructorId,
        cohort_id: activeCohort.id,
      },
    });

    if (courses.length === 0) {
      return res
        .status(404)
        .json({ message: "No courses available in the active cohort" });
    }

    return res.status(200).json({ courses });
  } catch (err) {
    next(err);
  }
};

//modify courses created by the instructor
export const updateInstructorCourseById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const instructorId = userPayload.id;
    const { title, description } = req.body;
    let { courseId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;

    const activeCohort = await prisma.cohorts.findFirst({
      where: {
        start_date: { lte: new Date() },
        end_date: { gte: new Date() },
      },
    });

    if (!activeCohort) {
      return res.status(400).json({ message: "No active cohort found" });
    }

    const course = await prisma.courses.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.instructor_id !== instructorId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (course.cohort_id !== activeCohort.id) {
      return res.status(400).json({
        message: "Cannot update course from previous cohort",
      });
    }

    const updatedCourse = await prisma.courses.update({
      where: { id: courseId },
      data: {
        title: title ?? course.title,
        description: description ?? course.description,
      },
    });

    return res.status(200).json({ updatedCourse });
  } catch (err) {
    next(err);
  }
};

//get courses Created by the instructor
export const instructorGetCourseById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;

    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const instructorId = userPayload.id;
    let { courseId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;

    const course = await prisma.courses.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.instructor_id !== instructorId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json({ course });
  } catch (err) {
    next(err);
  }
};

//delete courses Created by the instructor
export const deleteCourseInstructor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;

    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (userPayload.role !== "instructor") {
      return res
        .status(403)
        .json({ message: "Only instructors can delete courses" });
    }

    let { courseId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;

    // Confirm the course exists
    const course = await prisma.courses.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Confirm the instructor owns this course
    if (course.instructor_id !== userPayload.id) {
      return res
        .status(403)
        .json({ message: "You do not have access to this course" });
    }

    // Confirm the course belongs to the active cohort
    // Instructors cannot delete courses from past cohorts
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

    if (course.cohort_id !== activeCohort.id) {
      return res.status(400).json({
        message: "Cannot delete a course from a previous cohort",
      });
    }

    // Delete all enrollments for this course first.
    await prisma.enrollments.deleteMany({
      where: { course_id: courseId },
    });

    //Delete all course content for this couse second
    await prisma.course_content.deleteMany({
      where: { course_id: courseId },
    });

    // Now safe to delete the course
    await prisma.courses.delete({
      where: { id: courseId },
    });

    return res.status(200).json({
      message: "Course and all its enrollments deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

//Student APIs for the Courses
//Get all enrolled Courses

export const getAllEnrolledCourses = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;

    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = userPayload.id;

    const student = await prisma.profiles.findUnique({
      where: { user_id: userId },
    });

    const fullName = student?.bio || "Student";

    const courses = await prisma.enrollments.findMany({
      where: { user_id: userId },
    });

    if (!courses.length) {
      return res.status(404).json({
        message: `Student ${fullName} is not enrolled in any course`,
      });
    }

    return res.status(200).json({ Courses: courses });

  } catch (err) {
    return next(err); // also add return here
  }
};
/**export const deleteSkillByUser = async (
    req : AuthRequest,
    res : Response,
    next : NextFunction
) =>{
    try{

    }catch (err){
        next(err);
    }
} **/
