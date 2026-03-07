import {Router} from "express";
import {GetAllSubmissionsByAssignment, /*student =>*/ submitAssignment, editSubmission} from "../controllers/submission.controller"
import {authenticateToken, authorizeRoles} from "../middlewares/auth.middleware";

const instructorSubmissionRouter = Router();
const studentSbmissionRouter = Router();

//routes for apis to instructor to view submissions
instructorSubmissionRouter.get('/:assignmentId', authenticateToken, authorizeRoles('instructor'), GetAllSubmissionsByAssignment);
// instructorSubmissionRouter.patch('/:assignmentId', authenticateToken, authorizeRoles('instructor'), editAssignmentByIns);
// instructorSubmissionRouter.delete('/:assignmentId', authenticateToken, authorizeRoles('instructor'), deleteAssignmentByIns);


//routes for apis to Student to manipulate submissions
studentSbmissionRouter.post('/:assignmentId', authenticateToken, authorizeRoles('student'), submitAssignment);
studentSbmissionRouter.patch('/:assignmentId', authenticateToken, authorizeRoles('student'), editSubmission);



export  {instructorSubmissionRouter, studentSbmissionRouter};