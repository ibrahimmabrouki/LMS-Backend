import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import jwtUserPayload from "../utils/jwtUserPayload";
import {
  searchCandidates,
  askAboutCandidates,
  upsertCandidateToAI,
  deleteCandidateFromAI,
} from "../services/ai.service";

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

// POST /ai/search
// Body: { query: string, top_k?: number }
export const search = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { query, top_k } = req.body;

    if (!query || query.trim().length < 3) {
      return res
        .status(400)
        .json({ message: "Query must be at least 3 characters" });
    }

    const results = await searchCandidates(query, top_k || 3);
    return res.status(200).json({ query, results });
  } catch (err) {
    next(err);
  }
};

// POST /ai/ask
// Body: { question: string, top_k?: number }
export const ask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, top_k } = req.body;

    if (!question || question.trim().length < 3) {
      return res
        .status(400)
        .json({ message: "Question must be at least 3 characters" });
    }

    const result = await askAboutCandidates(question, top_k || 3);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// POST /ai/sync/:userId
// Admin manually re-syncs a student to Qdrant (e.g. after skills update)
export const syncStudent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.params.userId as string;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "student") {
      return res.status(400).json({ message: "User is not a student" });
    }

    const profile = await prisma.profiles.findUnique({
      where: { user_id: userId },
      select: { cv_url: true, bio: true },
    });

    if (!profile?.cv_url) {
      return res
        .status(400)
        .json({ message: "Student has no CV — cannot sync to AI" });
    }

    // Re-sync using bio as CV text fallback
    await upsertCandidateToAI(userId, profile.bio || "");

    return res
      .status(200)
      .json({ message: "Student synced to AI successfully" });
  } catch (err) {
    next(err);
  }
};
export const removeStudentFromAI = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.params.userId as string;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    await deleteCandidateFromAI(userId);
    return res
      .status(200)
      .json({ message: "Student removed from AI index successfully" });
  } catch (err) {
    next(err);
  }
};
