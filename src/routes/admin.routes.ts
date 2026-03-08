import { Router, Request, Response, NextFunction } from "express";
import {getAllStudents,getStudentProfileById,updateStudentProfileById,getStudentCVById,getAllInstructors,getInstructorProfileById,updateInstructorProfileById,searchStudents,searchInstructors,} from "../controllers/admin.controllers";
import { authenticateToken, authorizeRoles } from "../middlewares/auth.middleware";

const adminRouter = Router();

// All routes require admin authentication
adminRouter.use(authenticateToken, authorizeRoles("admin"));

// Middleware to parse text body as JSON for PATCH/POST requests
adminRouter.use((req: Request, res: Response, next: NextFunction) => {
  if ((req.method === "PATCH" || req.method === "POST") && typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      
    }
  }
  next();
});

// ==================== STUDENTS ====================
// GET /api/admin/students - Get all students
adminRouter.get("/students", getAllStudents);

// GET /api/admin/students/search?query=... - Search students
adminRouter.get("/students/search", searchStudents);

// GET /api/admin/students/:id - Get student profile by ID
adminRouter.get("/students/:id", getStudentProfileById);

// PATCH /api/admin/students/:id - Update student profile by ID and in header content-type =json
adminRouter.patch("/students/:id", updateStudentProfileById);

// GET /api/admin/students/:id/cv - Get student CV download link
adminRouter.get("/students/:id/cv", getStudentCVById);

// ==================== INSTRUCTORS ====================
// GET /api/admin/instructors - Get all instructors
adminRouter.get("/instructors", getAllInstructors);

// GET /api/admin/instructors/search?query=... - Search instructors
adminRouter.get("/instructors/search", searchInstructors);

// GET /api/admin/instructors/:id - Get instructor profile by ID
adminRouter.get("/instructors/:id", getInstructorProfileById);

// PATCH /api/admin/instructors/:id - Update instructor profile by ID and in header content-type =json
adminRouter.patch("/instructors/:id", updateInstructorProfileById);

export default adminRouter;
