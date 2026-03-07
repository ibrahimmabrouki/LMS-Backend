import express from "express";
import authRouter from "./routes/auth.routes";
import userSkillsRouter from "./routes/user.skills.routes";
import { StudentProfileRouter, InstructorProfileRouter } from "./routes/user.profile.router";
import { instructorCourseRouter, studentCourseRouter} from "./routes/courses.routes";
import {instructorContentRouter, studentContentRouter} from "./routes/content.routes"
import {instructorAssignmentRouter, studentAssignmentRouter} from "./routes/assignment.routes";
import {instructorSubmissionRouter, studentSbmissionRouter} from "./routes/submission.routes";
import {InstructorFeedbackRouter, StudentFeedbackRouter} from "./routes/feedback.routes";
import errorHandler from "./middlewares/error.middleware";



const app = express();

app.use(express.json());
app.use("/api/auth", authRouter);
app.use('/api/skills', userSkillsRouter);

//update the following routes
app.use('/api/profile', StudentProfileRouter);
app.use('/api/instuctor/profile', InstructorProfileRouter);

//routes for the courses
app.use('/api/instructor/course', instructorCourseRouter);
app.use('/api/student/course', studentCourseRouter);

//routes for content
app.use('/api/instructor/courses/content', instructorContentRouter);
app.use('/api/student/courses/content', studentContentRouter);

//routes for assignment
app.use('/api/instructor/courses/assignment', instructorAssignmentRouter);
app.use('/api/student/courses/assignment', studentAssignmentRouter);

//routes for submission
app.use('/api/instructor/courses/submissions', instructorSubmissionRouter);
app.use('/api/student/courses/submissions', studentSbmissionRouter);

//routes for feedbask
app.use('/api/instructor/feedback', InstructorFeedbackRouter);
app.use('/api/student/feedback', StudentFeedbackRouter);


app.use(errorHandler);

export default app;
