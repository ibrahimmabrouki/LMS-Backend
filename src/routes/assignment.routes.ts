import {Router} from "express";
import {createAssignmentByIns, getAllAssignmentsByIns, getDueAssignmentsByIns, getUpcomingAssignmentsByIns, editAssignmentByIns, deleteAssignmentByIns, /*student =>*/ GetAssigmentsByCourse, GetAllPendingAssignments, GetAllAssignments} from "../controllers/assignments.controller"
import {authenticateToken, authorizeRoles} from "../middlewares/auth.middleware";

const instructorAssignmentRouter = Router();
const studentAssignmentRouter = Router();

//routes for apis to instructor to manipulate Assignments
instructorAssignmentRouter.post('/:courseId', authenticateToken, authorizeRoles('instructor'), createAssignmentByIns);
instructorAssignmentRouter.get('/:courseId', authenticateToken, authorizeRoles('instructor'), getAllAssignmentsByIns);
instructorAssignmentRouter.patch('/:assignmentId', authenticateToken, authorizeRoles('instructor'), editAssignmentByIns);
instructorAssignmentRouter.delete('/:assignmentId', authenticateToken, authorizeRoles('instructor'), deleteAssignmentByIns);

//routes for apis to instructor to view Assignments
studentAssignmentRouter.get('/my-assignments', authenticateToken, authorizeRoles('student'), GetAllAssignments);
studentAssignmentRouter.get('/my-pending', authenticateToken, authorizeRoles('student'), GetAllPendingAssignments);
studentAssignmentRouter.get('/:courseId', authenticateToken, authorizeRoles('student'), GetAssigmentsByCourse);





export  {instructorAssignmentRouter, studentAssignmentRouter};