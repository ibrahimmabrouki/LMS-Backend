import {Router} from "express";
import {addContentByInstructor, getAllCourseContentByInstructor, editCourseContentByInstructor, deleteCourseContentByInstructor,/*Student =>*/ getCourseContent} from "../controllers/content.controller"
import {authenticateToken, authorizeRoles} from "../middlewares/auth.middleware";

const instructorContentRouter = Router();
const studentContentRouter = Router();

//routes for apis to instructor to manipulate Content
instructorContentRouter.post('/:courseId', authenticateToken, authorizeRoles("instructor"), addContentByInstructor);
instructorContentRouter.get('/:courseId', authenticateToken, authorizeRoles("instructor"), getAllCourseContentByInstructor);
instructorContentRouter.patch('/:courseId/:contentId', authenticateToken, authorizeRoles("instructor"), editCourseContentByInstructor);
instructorContentRouter.delete('/:courseId/:contentId', authenticateToken, authorizeRoles("instructor"), deleteCourseContentByInstructor);

//routes for apis to instructor to view Content
studentContentRouter.get('/:courseId', authenticateToken, authorizeRoles('student'), getCourseContent);


export  {instructorContentRouter, studentContentRouter};