import { Response, Request, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import jwtUserPayload from "../utils/jwtUserPayload";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import b2Client from "../config/bucket";

const BUCKET = process.env.B2_BUCKET_NAME as string;

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

// ==================== STUDENTS ====================

// Get all students with their profiles
export const getAllStudents = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const students = await prisma.users.findMany({
      where: {
        role: "student",
        deleted_at: null,
      },
      include: {
        profiles: true,
        enrollments: true,
      },
    });

    const formattedStudents = students.map((student: any) => ({
      id: student.id,
      username: student.username,
      email: student.email,
      full_name: student.profiles?.full_name || null,
      is_active: student.is_active,
      created_at: student.created_at,
      courses_count: student.enrollments?.length || 0,
    }));

    return res.status(200).json(formattedStudents);
  } catch (err) {
    next(err);
  }
};

// Get a specific student profile by ID
export const getStudentProfileById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id as string;

    const student = await prisma.users.findUnique({
      where: { id, role: "student" },
      include: {
        profiles: true,
        user_skills: {
          include: {
            skills: true,
          },
        },
        enrollments: {
          include: {
            courses: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const profile = student.profiles as any;
    const skills = student.user_skills.map((us: any) => us.skills.name);
    const courses = student.enrollments.map((e: any) => ({
      id: e.courses.id,
      title: e.courses.title,
    }));

    return res.status(200).json({
      id: student.id,
      username: student.username,
      email: student.email,
      full_name: profile?.full_name || null,
      bio: profile?.bio || null,
      linkedin_url: profile?.linkedin_url || null,
      github_url: profile?.github_url || null,
      portfolio_url: profile?.portfolio_url || null,
      cv_url: profile?.cv_url || null,
      cv_completed: profile?.cv_completed || false,
      is_active: student.is_active,
      created_at: student.created_at,
      skills,
      courses,
    });
  } catch (err) {
    next(err);
  }
};

// Update a specific student profile by ID
export const updateStudentProfileById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id as string;
    const { bio, fullName, email, linkedin_url, github_url, portfolio_url } =
      req.body || {};

    // Check if student exists
    const student = await prisma.users.findUnique({
      where: { id, role: "student" },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Update user email if provided
    if (email !== undefined) {
      await prisma.users.update({
        where: { id },
        data: { email, updated_at: new Date() },
      });
    }

    // Build profile update data
    const updateData: any = {};
    if (bio !== undefined) updateData.bio = bio;
    if (fullName !== undefined) updateData.full_name = fullName;
    if (linkedin_url !== undefined) updateData.linkedin_url = linkedin_url;
    if (github_url !== undefined) updateData.github_url = github_url;
    if (portfolio_url !== undefined) updateData.portfolio_url = portfolio_url;
    updateData.updated_at = new Date();

    // Upsert profile
    const updatedProfile = await prisma.profiles.upsert({
      where: { user_id: id },
      update: updateData,
      create: {
        user_id: id,
        ...updateData,
      },
    });

    return res.status(200).json({
      message: "Student profile updated successfully",
      profile: updatedProfile,
    });
  } catch (err) {
    next(err);
  }
};

// Get student CV (generate signed URL)
export const getStudentCVById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id as string;

    const profile = await prisma.profiles.findUnique({
      where: { user_id: id },
      select: { cv_url: true },
    });

    if (!profile?.cv_url) {
      return res.status(404).json({ message: "No CV found for this student" });
    }

    // Generate a temporary signed URL valid for 1 hour
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: profile.cv_url,
    });

    const signedUrl = await getSignedUrl(b2Client, command, { expiresIn: 3600 });

    return res.status(200).json({ cv_url: signedUrl });
  } catch (err) {
    next(err);
  }
};

// ==================== INSTRUCTORS ====================

// Get all instructors with their profiles
export const getAllInstructors = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const instructors = await prisma.users.findMany({
      where: {
        role: "instructor",
        deleted_at: null,
      },
      include: {
        profiles: true,
        courses: true,
      },
    });

    const formattedInstructors = instructors.map((instructor: any) => ({
      id: instructor.id,
      username: instructor.username,
      email: instructor.email,
      full_name: instructor.profiles?.full_name || null,
      is_active: instructor.is_active,
      created_at: instructor.created_at,
      courses_count: instructor.courses?.length || 0,
    }));

    return res.status(200).json(formattedInstructors);
  } catch (err) {
    next(err);
  }
};

// Get a specific instructor profile by ID
export const getInstructorProfileById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id as string;

    const instructor = await prisma.users.findUnique({
      where: { id, role: "instructor" },
      include: {
        profiles: true,
        courses: true,
      },
    });

    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    const profile = instructor.profiles as any;

    return res.status(200).json({
      id: instructor.id,
      username: instructor.username,
      email: instructor.email,
      full_name: profile?.full_name || null,
      bio: profile?.bio || null,
      is_active: instructor.is_active,
      created_at: instructor.created_at,
      courses: instructor.courses.map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// Update a specific instructor profile by ID
export const updateInstructorProfileById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id as string;
    const { bio, fullName, email } = req.body || {};

    // Check if instructor exists
    const instructor = await prisma.users.findUnique({
      where: { id, role: "instructor" },
    });

    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    // Update user email if provided
    if (email !== undefined) {
      await prisma.users.update({
        where: { id },
        data: { email, updated_at: new Date() },
      });
    }

    // Build profile update data
    const updateData: any = {};
    if (bio !== undefined) updateData.bio = bio;
    if (fullName !== undefined) updateData.full_name = fullName;
    updateData.updated_at = new Date();

    // Upsert profile
    const updatedProfile = await prisma.profiles.upsert({
      where: { user_id: id },
      update: updateData,
      create: {
        user_id: id,
        ...updateData,
      },
    });

    return res.status(200).json({
      message: "Instructor profile updated successfully",
      profile: updatedProfile,
    });
  } catch (err) {
    next(err);
  }
};

// ==================== SEARCH ====================

// Search students by name or email
export const searchStudents = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = req.query.query as string;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const students = await prisma.users.findMany({
      where: {
        role: "student",
        deleted_at: null,
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { username: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        profiles: true,
        enrollments: true,
      },
    });

    const formattedStudents = students.map((student: any) => ({
      id: student.id,
      username: student.username,
      email: student.email,
      full_name: student.profiles?.full_name || null,
      courses_count: student.enrollments?.length || 0,
    }));

    return res.status(200).json(formattedStudents);
  } catch (err) {
    next(err);
  }
};

// Search instructors by name or email
export const searchInstructors = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = req.query.query as string;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const instructors = await prisma.users.findMany({
      where: {
        role: "instructor",
        deleted_at: null,
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { username: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        profiles: true,
      },
    });

    const formattedInstructors = instructors.map((instructor: any) => ({
      id: instructor.id,
      username: instructor.username,
      email: instructor.email,
      full_name: instructor.profiles?.full_name || null,
    }));

    return res.status(200).json(formattedInstructors);
  } catch (err) {
    next(err);
  }
};
