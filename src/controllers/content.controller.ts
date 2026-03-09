import { Request, Response, NextFunction } from "express";
import jwtUserPayload from "../utils/jwtUserPayload";
import { prisma } from "../lib/prisma";
import aiClient from "../config/aiClient";

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

//Add content By instructor (based on the viewd courses)
export const addContentByInstructor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const instructorId = userPayload.id;

    let { courseId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;

    /* {
  "title": "part3",
  "content_type": "pdf",
  "content_url":"http://localhost:3000/instructor/courses/content/1.pdf"
}*/ // in addition to the course id
    const { title, content_type, content_url } = req.body;

    const ownership = await verifyInstructorOwnsCourse(courseId, instructorId);
    if (ownership === null)
      return res.status(404).json({ message: "Course not found" });
    if (ownership === false)
      return res
        .status(403)
        .json({ message: "You do not have access to this course" });

    const count = await prisma.course_content.count({
      where: { course_id: courseId },
    });
    const position = count + 1;

    const content = await prisma.course_content.create({
      data: {
        course_id: courseId,
        title,
        content_type,
        content_url,
        position: position,
      },
    });

    // ── Auto-ingest into Qdrant via AI service ───────────────────────────
    // Priority:
    //   1. Non-PDF URL  → /ai/ingest/link  (HTML scrape)
    //   2. PDF URL      → /ai/ingest/course/:id (course-level ingester handles PDF extraction)
    //   3. No URL       → /ai/ingest/course/:id (metadata / text_body fallback)
    let aiResult: Record<string, unknown> = {};
    try {
      const urlStr = String(content_url ?? "").trim();
      const isPdf = urlStr.toLowerCase().endsWith(".pdf");

      if (urlStr && !isPdf) {
        // Article / doc / video metadata — scrape HTML
        const { data } = await aiClient.post("/ai/ingest/link", {
          document_id: content.id,
          title,
          url: urlStr,
          dataset_id: courseId,
          user_id: instructorId,
        });
        aiResult = data;
      } else {
        // PDF URL or no URL — let the course-level ingester handle it
        // (it fetches all content items and does proper PDF byte extraction)
        const { data } = await aiClient.post(`/ai/ingest/course/${courseId}`);
        aiResult = data;
      }
    } catch (aiErr: any) {
      // AI failure must not block the content creation response
      console.error(
        "[AI Ingest Error]",
        aiErr?.response?.data ?? aiErr.message,
      );
      aiResult = {
        success: false,
        error: "AI ingest failed — content saved to DB",
      };
    }

    return res.status(201).json({
      message: "Content added successfully",
      content,
      ai_ingest: aiResult,
    });
  } catch (err) {
    next(err);
  }
};

//Get all contents Per course in Instructors dashbord
export const getAllCourseContentByInstructor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    const instructorId = userPayload.id;
    let { courseId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;

    const ownership = await verifyInstructorOwnsCourse(courseId, instructorId);
    if (ownership === null)
      return res.status(404).json({ message: "Course not found" });
    if (ownership === false)
      return res
        .status(403)
        .json({ message: "You do not have access to this course" });

    // Return content ordered by position so it appears in the correct sequence
    const contents = await prisma.course_content.findMany({
      where: { course_id: courseId },
      orderBy: { position: "asc" },
    });

    if (contents.length === 0) {
      return res
        .status(404)
        .json({ message: "No content found for this course" });
    }

    return res.status(200).json({ contents });
  } catch (err) {
    next(err);
  }
};

//Allow the Instructor to modify one conetent it self
export const editCourseContentByInstructor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    const instructorId = userPayload.id;
    let { courseId, contentId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;
    contentId = Array.isArray(contentId) ? contentId[0] : contentId;

    const { title, content_type, content_url } = req.body;

    const ownership = await verifyInstructorOwnsCourse(courseId, instructorId);
    if (ownership === null) {
      return res.status(404).json({ message: "Course not found" });
    }
    if (ownership === false) {
      return res
        .status(403)
        .json({ message: "You do not have access to this course" });
    }

    // Build update object with only the fields that were sent
    // Undefined fields are ignored so partial updates work correctly
    const updateData: any = {};
    if (title !== undefined) {
      updateData.title = title;
    }
    if (content_type !== undefined) {
      updateData.content_type = content_type;
    }
    if (content_url !== undefined) {
      updateData.content_url = content_url;
    }

    const updated = await prisma.course_content.update({
      where: { id: contentId },
      data: updateData,
    });

    // ── Re-ingest updated content into Qdrant ────────────────────────────
    // Re-ingest the whole course so the updated content replaces old vectors
    try {
      await aiClient.post(`/ai/ingest/course/${courseId}`);
    } catch (aiErr: any) {
      console.error(
        "[AI Re-ingest Error]",
        aiErr?.response?.data ?? aiErr.message,
      );
    }

    return res.status(200).json({
      message: "Content updated successfully",
      content: updated,
    });
  } catch (err) {
    next(err);
  }
};

//Allow the instructor to delete the content

export const deleteCourseContentByInstructor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    const instructorId = userPayload.id;
    let { courseId, contentId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;
    contentId = Array.isArray(contentId) ? contentId[0] : contentId;

    const ownership = await verifyInstructorOwnsCourse(courseId, instructorId);
    if (ownership === null)
      return res.status(404).json({ message: "Course not found" });
    if (ownership === false)
      return res
        .status(403)
        .json({ message: "You do not have access to this course" });

    await prisma.course_content.delete({
      where: { id: contentId },
    });

    // ── Remove deleted content vectors from Qdrant ───────────────────────
    try {
      await aiClient.delete(`/ai/documents/${contentId}`);
    } catch (aiErr: any) {
      console.error(
        "[AI Delete Error]",
        aiErr?.response?.data ?? aiErr.message,
      );
    }

    // After deletion, re-sequence the remaining items so positions stay clean
    // e.g. if positions were 1,2,3,4 and we deleted position 2,
    // this updates them back to 1,2,3 instead of leaving a gap
    const remaining = await prisma.course_content.findMany({
      where: { course_id: courseId },
      orderBy: { position: "asc" },
    });

    for (let i = 0; i < remaining.length; i++) {
      await prisma.course_content.update({
        where: { id: remaining[i].id },
        data: { position: i + 1 },
      });
    }

    return res.status(200).json({ message: "Content deleted successfully" });
  } catch (err) {
    next(err);
  }
};

const verifyInstructorOwnsCourse = async (
  courseId: string,
  instructorId: string,
) => {
  const course = await prisma.courses.findUnique({ where: { id: courseId } });
  if (!course) {
    return null;
  }

  if (course.instructor_id !== instructorId) {
    return false;
  }

  return course;
};

//Student APIs for the Content
//Get all enrolled Content
export const getCourseContent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) return res.status(401).json({ message: "Unauthorized" });

    let { courseId } = req.params;
    courseId = Array.isArray(courseId) ? courseId[0] : courseId;

    const course = await prisma.courses.findUnique({ where: { id: courseId } });
    const courseName = course?.title;

    const content = await prisma.course_content.findMany({
      where: { course_id: courseId },
    });
    if (content.length === 0) {
      return res
        .status(404)
        .json({ message: `No content was found under Course ${courseName}` });
    }

    return res.status(200).json({ content: content });
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
