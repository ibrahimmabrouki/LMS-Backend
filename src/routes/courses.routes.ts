import { Router } from "express";
import {
  createCourseInstructor,
  getAllCoursesByInstructor,
  updateInstructorCourseById,
  instructorGetCourseById,
  deleteCourseInstructor,
   getAllCoursesForAI,
  getCourseContentForAI,
  numberOfStudentsPerCourse,
  countUngradedSubmissions,
  getStudentsByCourse,
  /*student =>*/ getAllEnrolledCourses,
} from "../controllers/courses.controllers";

import {
  authenticateToken,
  authorizeRoles,
} from "../middlewares/auth.middleware";

const instructorCourseRouter = Router();
const studentCourseRouter = Router();
const publicCourseRouter = Router();

// public routes used by the FastAPI AI service
publicCourseRouter.get("/", getAllCoursesForAI);
publicCourseRouter.get("/:id/content", getCourseContentForAI);

//routes for apis to instructor to manipulate Courses
instructorCourseRouter.post(
  "/my-courses",
  authenticateToken,
  authorizeRoles("instructor"),
  createCourseInstructor
);
instructorCourseRouter.get(
  "/my-courses",
  authenticateToken,
  authorizeRoles("instructor"),
  getAllCoursesByInstructor
);
instructorCourseRouter.patch(
  "/my-courses/:courseId",
  authenticateToken,
  authorizeRoles("instructor"),
  updateInstructorCourseById
);
instructorCourseRouter.get(
  "/my-courses/:courseId",
  authenticateToken,
  authorizeRoles("instructor"),
  instructorGetCourseById
);
instructorCourseRouter.delete(
  "/my-courses/:courseId",
  authenticateToken,
  authorizeRoles("instructor"),
  deleteCourseInstructor
);
instructorCourseRouter.get(
  "/:courseId/num-students",
  authenticateToken,
  authorizeRoles("instructor"),
  numberOfStudentsPerCourse
);
instructorCourseRouter.get(
  "/:courseId/pending-subs",
  authenticateToken,
  authorizeRoles("instructor"),
  countUngradedSubmissions
);
//slim Route
instructorCourseRouter.get(
  "/:courseId",
  authenticateToken,
  authorizeRoles("instructor"),
  getStudentsByCourse
);

//routes for apis to Student to View Courses
studentCourseRouter.get(
  "/my-courses",
  authenticateToken,
  authorizeRoles("student"),
  getAllEnrolledCourses
);

export { instructorCourseRouter, studentCourseRouter, publicCourseRouter };
