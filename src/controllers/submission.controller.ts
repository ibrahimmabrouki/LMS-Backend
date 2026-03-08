import { Request, Response, NextFunction } from "express";
import jwtUserPayload from "../utils/jwtUserPayload";
import { prisma } from "../lib/prisma";

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

//Getting all the submission for some assignment
export const GetAllSubmissionsByAssignment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let { assignmentId } = req.params;
    assignmentId = Array.isArray(assignmentId) ? assignmentId[0] : assignmentId;

    const assignment = await prisma.assignments.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    //find the submissions
    const submissions = await prisma.submissions.findMany({
      where: { assignment_id: assignmentId },
    });

    if (submissions.length === 0) {
      return res
        .status(404)
        .json({ message: "No submissions found for this assignment" });
    }

    return res.status(200).json({
      assignment_title: assignment.title,
      submissions,
    });
  } catch (err) {
    next(err);
  }
};

//Student APIs for the Content
//Get all enrolled Content

//Submit the Assignemet
export const submitAssignment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;

    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let { assignmentId } = req.params;
    assignmentId = Array.isArray(assignmentId) ? assignmentId[0] : assignmentId;

    const { submission_url } = req.body;

    if (!submission_url) {
      return res.status(400).json({ message: "submission_url is required" });
    }

    const assignment = await prisma.assignments.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return res
        .status(404)
        .json({ message: `No Assignemt with id: ${assignmentId} was found` });
    }

    const today = new Date();
    const dueDate = new Date(assignment.due_date!);

    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (today > dueDate) {
      return res.status(403).json({
        message: "Assignment deadline has passed",
      });
    }

    const existing = await prisma.submissions.findFirst({
      where: {
        assignment_id: assignmentId,
        student_id: userPayload.id,
      },
    });

    if (existing) {
      return res.status(400).json({
        message:
          "You already submitted this assignment. Use the edit endpoint to update it.",
      });
    }
    const submission = await prisma.submissions.create({
      data: {
        assignment_id: assignmentId,
        student_id: userPayload.id,
        submission_url,
        submitted_at: new Date(),
        status: "ungraded",
        score: 0,
      } as any,
    });

    return res.status(201).json({
      message: "Assignment submitted successfully",
      submission,
    });
  } catch (err) {
    next(err);
  }
};

//Edit the Submission of the Assignment
export const editSubmission = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let { assignmentId } = req.params;
    console.log();

    assignmentId = Array.isArray(assignmentId) ? assignmentId[0] : assignmentId;
    console.log(assignmentId);

    const { submission_url } = req.body;

    const submission = await prisma.submissions.findUnique({
      where: { id: assignmentId, 
    student_id: userPayload.id },
    });

    if (!submission) {
      return res
        .status(404)
        .json({ message: `There is no Submission related to assignment with id: ${assignmentId}` });
    }

    const status = submission.status;

    if (status === "graded") {
      return res.status(403).json({
        message: "Cannot edit graded submissions",
      });
    }

    const assigmentId = submission.assignment_id;

    const assignment = await prisma.assignments.findUnique({
      where: { id: assigmentId! },
    });

    if (!assignment) {
      return res.status(404).json({ message: "No Assignemnet Found" });
    }

    const today = new Date();
    const dueDate = new Date(assignment.due_date!);

    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (today > dueDate) {
      return res.status(403).json({
        message: "Can not edit Assignment, deadline has passed",
      });
    }

    const submissionDate = new Date(submission.created_at!);
    const now = new Date();

    const diffMs = now.getTime() - submissionDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours > 24) {
      return res.status(403).json({
        message: "You can only edit the submission within 24 hours.",
      });
    }

    const updateSubmission = await prisma.submissions.update({
      where: { id: submission.id },
      data: {
        submission_url: submission_url ?? submission.submission_url,
      },
    });

    return res.status(200).json({ updateSubmission });
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
