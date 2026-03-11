import { Response, Request, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import jwtUserPayload from "../utils/jwtUserPayload";
import { v4 as uuidv4 } from "uuid";

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}


// for the instructor 
// create Announcment
export const createAnnouncement = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    //fetching the active (current) cohort
    const activeCohort = await prisma.cohorts.findFirst({
      where: {
        start_date: { lte: new Date() },
        end_date:   { gte: new Date() },
      },
    });

    if (!activeCohort) {
      return res.status(404).json({ message: "No active cohort found" });
    }

    //getting all active students who are also found in the active cohort
    const activeStudents = await prisma.users.findMany({
      where: {
        role:       "student",
        is_active:  true,
        created_at: { gte: activeCohort.start_date ?? new Date() },
      },
      select: { id: true },
    });

    if (activeStudents.length === 0) {
      return res.status(404).json({ message: "No active students found in the active cohort" });
    }


    //adding one notification row per student which is active 
    const announcementId = uuidv4();
    await prisma.notifications.createMany({
      data: activeStudents.map((student) => ({
        user_id:        student.id,
        announcement_id: announcementId,
        type:           "announcement",
        title:          title,
        message:        message,
        is_read:        false,
        reference_type: "announcement",
        //we dont have refrence id (it exists only with the feedback and assignement)
      })),
    });

    return res.status(201).json({
      message: `Announcement sent to ${activeStudents.length} students`,
      announcement_id: announcementId
    });

  } catch (err) {
    next(err);
  }
};

//delete Anouncment by instructor 
export const deleteAnnouncement = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let { announcementId } = req.params;
    announcementId = Array.isArray(announcementId) ? announcementId[0] : announcementId;


    if (!announcementId) {
      return res.status(400).json({ message: "Announcement ID is required" });
    }

    // Check if any notifications exist for this announcement
    const existing = await prisma.notifications.findFirst({
      where: { announcement_id: announcementId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    // Delete all notification rows that belong to this announcement
    const deleted = await prisma.notifications.deleteMany({
      where: { announcement_id: announcementId },
    });

    return res.status(200).json({
      message: `Announcement deleted for ${deleted.count} students`,
    });

  } catch (err) {
    next(err);
  }
};


//for Student get all notification
export const getAllNotifications = async (
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

    const notifications = await prisma.notifications.findMany({
      where:   { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    // Count unread separately so the frontend can show the bell badge number
    const unreadCount = await prisma.notifications.count({
      where: {
        user_id: userId,
        is_read: false,
      },
    });

    return res.status(200).json({
      notifications,
      unreadCount,
    });

  } catch (err) {
    next(err);
  }
};


//read Notification
export const readNotification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let { notificationId } = req.params;
    notificationId = Array.isArray(notificationId) ? notificationId[0] : notificationId;


    if (!notificationId) {
      return res.status(400).json({ message: "Notification ID is required" });
    }

    const notification = await prisma.notifications.findFirst({
      where: {
        id:      notificationId,
        user_id: userPayload.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.is_read) {
      return res.status(200).json({ message: "Notification already read" });
    }

    await prisma.notifications.update({
      where: { id: notificationId },
      data:  { is_read: true },
    });

    return res.status(200).json({ message: "Notification marked as read" });

  } catch (err) {
    next(err);
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
