import axios from "axios";
import { prisma } from "../lib/prisma";
import pdfParse from "pdf-parse-new";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// ── PDF Text Extraction ───────────────────────────────────────────────────────

export const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
  const data = await pdfParse(buffer);
  return data.text?.trim() || "";
};

// ── Build candidate payload for FastAPI ──────────────────────────────────────

export const buildCandidatePayload = async (userId: string, cvText: string) => {
  const profile = await prisma.profiles.findUnique({
    where: { user_id: userId },
    select: {
      bio: true,
      users: { select: { username: true, email: true } },
    },
  });

  const userSkills = await prisma.user_skills.findMany({
    where: { user_id: userId },
    include: { skills: true },
  });
  const skillNames = userSkills.map((s) => s.skills.name);

  const latestFeedback = await prisma.feedback.findFirst({
    where: { submissions: { student_id: userId } },
    orderBy: { created_at: "desc" },
    select: { comment: true },
  });

  // Get cohort end_date via enrollment — used for precise recency scoring
  const enrollment = await prisma.enrollments.findFirst({
    where: { user_id: userId },
    include: { courses: { include: { cohorts: true } } },
  });

  const cohortEndDate = enrollment?.courses?.cohorts?.end_date ?? null;
  const graduationYear = cohortEndDate
    ? new Date(cohortEndDate).getFullYear()
    : null;
  // Send exact date as ISO string so FastAPI can compute months-since accurately
  const graduationDate = cohortEndDate
    ? new Date(cohortEndDate).toISOString().split("T")[0]  // "YYYY-MM-DD"
    : null;

  const performance = await prisma.performance_summary.findUnique({
    where: { user_id: userId },
    select: { overall_rating: true },
  });

  const name = profile?.users?.username || "Unknown";

  return {
    id:               userId,
    name,
    cv:               cvText,
    skills:           skillNames,
    projects:         [],
    feedback:         latestFeedback?.comment || null,
    rating:           performance?.overall_rating
                        ? parseFloat(performance.overall_rating.toString())
                        : null,
    graduation_year:  graduationYear,
    graduation_date:  graduationDate,   // ← exact cohort end_date for recency
  };
};

// ── FastAPI upsert ────────────────────────────────────────────────────────────

export const upsertCandidateToAI = async (userId: string, cvText: string): Promise<void> => {
  const payload = await buildCandidatePayload(userId, cvText);
  await axios.post(`${FASTAPI_URL}/recruiter/upsert-candidate`, payload);
};

// ── FastAPI delete ────────────────────────────────────────────────────────────

export const deleteCandidateFromAI = async (userId: string): Promise<void> => {
  await axios.delete(`${FASTAPI_URL}/recruiter/delete-candidate/${userId}`);
};

// ── Search ────────────────────────────────────────────────────────────────────

export const searchCandidates = async (query: string, topK: number = 3) => {
  const response = await axios.post(`${FASTAPI_URL}/recruiter/search`, {
    query,
    top_k: topK,
  });

  const results = response.data.results;

  const enriched = await Promise.all(
    results.map(async (r: any) => {
      const profile = await prisma.profiles.findUnique({
        where: { user_id: r.candidate_id },
        select: { users: { select: { email: true, username: true } } },
      });

      return {
        candidate_id:  r.candidate_id,
        name:          profile?.users?.username,
        email:         profile?.users?.email,
        final_score:   r.final_score,
        rating:        r.rating,
        domain_scores: r.domain_scores,
      };
    })
  );

  return enriched;
};

// ── Ask ───────────────────────────────────────────────────────────────────────

export const askAboutCandidates = async (question: string, topK: number = 3) => {
  const response = await axios.post(`${FASTAPI_URL}/assistant/ask`, {
    question,
    top_k: topK,
  });

  return {
    question:        response.data.question,
    answer:          response.data.answer,
    candidate_ids:   response.data.candidate_ids,
    candidate_names: response.data.candidate_names,
  };
};