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

export const buildCandidatePayload = async (
  userId: string,
  cvText: string
) => {
  // Get profile + user info
  const profile = await prisma.profiles.findUnique({
    where: { user_id: userId },
    select: {
      bio: true,
      users: {
        select: { username: true, email: true },
      },
    },
  });

  // Get skills
  const userSkills = await prisma.user_skills.findMany({
    where: { user_id: userId },
    include: { skills: true },
  });
  const skillNames = userSkills.map((s) => s.skills.name);

  // Get latest instructor feedback comment
  const latestFeedback = await prisma.feedback.findFirst({
    where: {
      submissions: { student_id: userId },
    },
    orderBy: { created_at: "desc" },
    select: { comment: true },
  });

  // Get graduation year from cohort end_date via enrollment
  const enrollment = await prisma.enrollments.findFirst({
    where: { user_id: userId },
    include: {
      courses: {
        include: { cohorts: true },
      },
    },
  });
  const graduationYear = enrollment?.courses?.cohorts?.end_date
    ? new Date(enrollment.courses.cohorts.end_date).getFullYear()
    : null;

  // Get overall rating from performance_summary
  const performance = await prisma.performance_summary.findUnique({
    where: { user_id: userId },
    select: { overall_rating: true },
  });

  const name = profile?.users?.username || "Unknown";

  return {
    id: userId,       // UUID — same as users.id in PostgreSQL
    name,
    cv: cvText,       // extracted PDF text
    skills: skillNames,
    projects: [],     // CV text carries project info
    feedback: latestFeedback?.comment || null,
    rating: performance?.overall_rating
      ? parseFloat(performance.overall_rating.toString())
      : null,
    graduation_year: graduationYear,
  };
};

// ── FastAPI upsert — all AI data goes to Qdrant only ─────────────────────────

export const upsertCandidateToAI = async (
  userId: string,
  cvText: string
): Promise<void> => {
  const payload = await buildCandidatePayload(userId, cvText);
  await axios.post(`${FASTAPI_URL}/recruiter/upsert-candidate`, payload);
};

// ── FastAPI delete ────────────────────────────────────────────────────────────

export const deleteCandidateFromAI = async (userId: string): Promise<void> => {
  await axios.delete(`${FASTAPI_URL}/recruiter/delete-candidate/${userId}`);
};

// ── Search — FastAPI ranks, Express enriches with name/email ─────────────────

export const searchCandidates = async (
  query: string,
  topK: number = 3
) => {
  const response = await axios.post(`${FASTAPI_URL}/recruiter/search`, {
    query,
    top_k: topK,
  });

  const results = response.data.results;

  // Enrich with name + email from PostgreSQL using the returned UUIDs
  const enriched = await Promise.all(
    results.map(async (r: any) => {
      const profile = await prisma.profiles.findUnique({
        where: { user_id: r.candidate_id },
        select: {
          users: { select: { email: true, username: true } },
        },
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

// ── Ask — natural language question about candidates ─────────────────────────

export const askAboutCandidates = async (
  question: string,
  topK: number = 3
) => {
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