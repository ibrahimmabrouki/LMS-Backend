import { Response, Request, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import jwtUserPayload from "../utils/jwtUserPayload";

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

//APIs for the instructor to manipulate the Feedback
//Allow the instructer to save Repetative Drafts
export const saveFeedbackAsDraft = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let { submissionId } = req.params;
    submissionId = Array.isArray(submissionId) ? submissionId[0] : submissionId;

    const { rating, comment } = req.body;

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res
        .status(400)
        .json({ message: "rating must be between 1 and 5" });
    }

    // Verify the submission exists and the instructor owns the course
    const submission = await prisma.submissions.findUnique({
      where: { id: submissionId },
      include: {
        assignments: {
          include: { courses: true },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (submission.assignments?.courses?.instructor_id !== userPayload.id) {
      return res
        .status(403)
        .json({ message: "You do not have access to this submission" });
    }

    // Check if feedback already exists for this submission
    const existingFeedback = await prisma.feedback.findFirst({
      where: { submission_id: submissionId },
    });

    // Block if already locked — cannot save a draft over finalized feedback
    if (existingFeedback?.is_locked) {
      return res.status(403).json({
        message: "Feedback for this submission is already submitted and locked",
      });
    }

    // Build the data object with only the fields that were sent
    const Data: any = {};
    if (rating !== undefined) {
      Data.rating = rating;
    }

    const prevComment = existingFeedback?.comment;
    if (comment !== undefined) {
      Data.comment = prevComment + comment;
    }

    const feedback = await prisma.feedback.upsert({
      where: {
        id: existingFeedback?.id ?? "00000000-0000-0000-0000-000000000000",
      },
      update: Data,
      create: {
        submission_id: submissionId,
        instructor_id: userPayload.id,
        is_locked: false,
        ...Data,
      },
    });

    return res.status(200).json({
      message: existingFeedback
        ? "Draft updated successfully"
        : "Feedback saved as draft successfully",
      feedback,
    });
  } catch (err) {
    next(err);
  }
};

//Bring the previous feedback or draft feedback for the instructor
export const viewFeedbackInstructor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let { submissionId } = req.params;
    submissionId = Array.isArray(submissionId) ? submissionId[0] : submissionId;
    const feedback = await prisma.feedback.findFirst({
      where: {
        submission_id: submissionId,
      },
    });

    if (!feedback) {
      return res.status(404).json({
        message: "No draft feedback or draft found.",
      });
    }

    return res.status(200).json({ feedback: feedback });
  } catch (err) {
    next(err);
  }
};

//submit the feedback directly for the first time or submited the edit draft
export const submitFeedback = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { rating, comment } = req.body;

    let { submissionId } = req.params;
    submissionId = Array.isArray(submissionId) ? submissionId[0] : submissionId;

    const submission = await prisma.submissions.findUnique({
      where: { id: submissionId },
      include: {
        assignments: {
          include: { courses: true },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (submission.assignments?.courses?.instructor_id !== userPayload.id) {
      return res
        .status(403)
        .json({ message: "You do not have access to this submission" });
    }

    // Check if feedback already exists for this submission
    const existingFeedback = await prisma.feedback.findFirst({
      where: { submission_id: submissionId },
    });

    // Block if already locked — cannot save a draft over finalized feedback
    if (existingFeedback?.is_locked) {
      return res.status(403).json({
        message: "Feedback for this submission is already submitted and locked",
      });
    }

    const Data: any = {};
    if (rating !== undefined) {
      Data.rating = rating;
    }

    const prevComment = existingFeedback?.comment;
    if (comment !== undefined) {
      Data.comment = prevComment + comment;
    }

    const feedback = await prisma.feedback.upsert({
      where: {
        id: existingFeedback?.id ?? "00000000-0000-0000-0000-000000000000",
      },
      update: Data,
      create: {
        submission_id: submissionId,
        instructor_id: userPayload.id,
        is_locked: false,
        ...Data,
      },
    });

    return res.status(200).json({
      message: existingFeedback
        ? "Draft Submitted successfully"
        : "Feedback Submitted successfully",
      feedback,
    });
  } catch (err) {
    next(err);
  }
};

//APIs for the Student to view the Feedback
export const viewFeedbackByStudent = async (
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

    const submission = await prisma.submissions.findFirst({
      where: {
        assignment_id: assignmentId,
        student_id: userPayload.id,
      },
    });

    if (!submission) {
      return res.status(404).json({
        message: "No submission found for this assignment",
      });
    }

    const feedback = await prisma.feedback.findFirst({
      where: {
        submission_id: submission.id,
        is_locked: true,
      },
    });

    if (!feedback) {
      return res.status(404).json({
        message: "Feedback is not available yet for this submission",
      });
    }

    return res.status(200).json(feedback);
  } catch (err) {
    next(err);
  }
};

