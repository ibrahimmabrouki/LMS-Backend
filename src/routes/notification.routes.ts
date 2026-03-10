import Router from "express";
import {createAnnouncement, deleteAnnouncement, /*Student*/ getAllNotifications, readNotification} from "../controllers/notification.controller"
import {authenticateToken, authorizeRoles} from "../middlewares/auth.middleware";

const instructorNotificationRouter = Router();
const studentNotificationRouter = Router();

//routes for apis to instructor to manipulate notification
instructorNotificationRouter.post('/post-announcment', authenticateToken, authorizeRoles('instructor'), createAnnouncement);
instructorNotificationRouter.delete('/:announcementId', authenticateToken, authorizeRoles('instructor'), deleteAnnouncement);

//routes for apis to student to view notification
studentNotificationRouter.get('/my-notification', authenticateToken, authorizeRoles('student'), getAllNotifications);
studentNotificationRouter.patch('/read-notification/:notificationId', authenticateToken, authorizeRoles('student'), readNotification);




export {instructorNotificationRouter, studentNotificationRouter};

