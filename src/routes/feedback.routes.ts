import Router from "express";
import {saveFeedbackAsDraft, viewFeedbackInstructor, submitFeedback, /*student =>*/viewFeedbackByStudent} from "../controllers/feedback.controller";
import {authenticateToken, authorizeRoles} from "../middlewares/auth.middleware";

const InstructorFeedbackRouter = Router();
const StudentFeedbackRouter = Router();

//routes for apis to instructor to manipulate Feedback
InstructorFeedbackRouter.get('/:submissionId', authenticateToken, authorizeRoles('instructor'), viewFeedbackInstructor);
InstructorFeedbackRouter.patch('/:submissionId', authenticateToken, authorizeRoles('instructor'), saveFeedbackAsDraft);
InstructorFeedbackRouter.patch('/submit/:submissionId', authenticateToken, authorizeRoles('instructor'), submitFeedback);


//routes for apis to instructor to view Feedback
StudentFeedbackRouter.get('/:assignmentId', authenticateToken, authorizeRoles('student'), viewFeedbackByStudent);


export {InstructorFeedbackRouter, StudentFeedbackRouter};