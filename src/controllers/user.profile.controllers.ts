import { Response, Request, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import jwtUserPayload from "../utils/jwtUserPayload";
import { extractTextFromPDF, upsertCandidateToAI } from "../services/ai.service";

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import b2Client from "../config/bucket";
const BUCKET = process.env.B2_BUCKET_NAME as string;

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

//All the Follwing are relted to the user (STUDENT)

//API for getting the data for each user -profile- from the database
//and if their is no profile for the user create new empty one
export const getStudentOwnProfileData = async (
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

    let profile = await prisma.profiles.findUnique({
      where: { user_id: userId },
      select: {
        bio: true,
        full_name: true,
        linkedin_url: true,
        github_url: true,
        portfolio_url: true,
        cv_url: true,
        cv_completed: true,
        users: {
          select: {
            email: true,
            username: true,
          },
        },
      },
    });

    if (!profile) {
      profile = await prisma.profiles.create({
        data: { user_id: userId },
        select: {
          bio: true,
          full_name: true,
          linkedin_url: true,
          github_url: true,
          portfolio_url: true,
          cv_url: true,
          cv_completed: true,
          users: {
            select: {
              email: true,
              username: true,
            },
          },
        },
      });
    }

    return res.status(200).json({
      email: profile.users?.email,
      username: profile.users?.username,
      full_name: profile.full_name,
      bio: profile.bio,
      linkedin_url: profile.linkedin_url,
      github_url: profile.github_url,
      portfolio_url: profile.portfolio_url,
      cv_url: profile.cv_url,
      cv_completed: profile.cv_completed,
    });
  } catch (err) {
    next(err);
  }
};

//this will allow the user to only update the feilds that are enterd
export const updateStudentProfile = async (
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

    const { bio, linkedin_url, github_url, portfolio_url, fullName, email } =
      req.body;

    if (email !== undefined) {
      await prisma.users.update({
        where: { id: userId },
        data: { email: email },
      });
    }

    const updateData: any = {};

    if (bio !== undefined) {
      updateData.bio = bio;
    }
    if (fullName !== undefined) {
      updateData.full_name = fullName;
    }
    if (linkedin_url !== undefined) {
      updateData.linkedin_url = linkedin_url;
    }
    if (github_url !== undefined) {
      updateData.github_url = github_url;
    }
    if (portfolio_url !== undefined) {
      updateData.portfolio_url = portfolio_url;
    }

    updateData.updated_at = new Date();

    //upsert = >update and insert
    const updatedProfile = await prisma.profiles.upsert({
      where: { user_id: userId },
      update: updateData,
      create: {
        user_id: userId,
        ...updateData,
      },
    });

    return res.status(200).json({
      message: "Profile updated successfully",
      profile: updatedProfile,
    });
  } catch (err) {
    next(err);
  }
};

//API related to Uploading the  CV
export const uploadCV = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = userPayload.id;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // uploading again simply overwrites the previous file in B2 — resubmission works automatically
    //simply no need to delete the old version
     // Extract text from PDF buffer BEFORE uploading to B2
    // We have the buffer in RAM here — no need to download from B2 later
    const cvText = await extractTextFromPDF(req.file.buffer);

    // Upload to B2 — unchanged from original
    const cvKey = await helper_uploadCV(userId, req.file.buffer, req.file.mimetype);

    const profile = await prisma.profiles.upsert({
      where: { user_id: userId },
      update: {
        cv_url: cvKey,
        cv_completed: true,
        updated_at: new Date(),
      },
      create: {
        cv_url: cvKey,
        user_id: userId,
        cv_completed: true,
        updated_at: new Date(),
      },
    });

    return res.status(200).json({
      message: "CV uploaded successfully",
      CVCompletionStatus: profile.cv_completed,
    });
    upsertCandidateToAI(userId, cvText).catch((err) => {
      console.error(`[AI] Failed to sync student ${userId}:`, err.message);
    });
  } catch (err) {
    next(err);
  }
};

//API related to getting the CV
export const getCV = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = userPayload.id;

    const profile = await prisma.profiles.findUnique({
      where: { user_id: userId },
      select: { cv_url: true },
    });

    if (!profile?.cv_url) {
      return res.status(404).json({ message: "No CV found for this user" });
    }

    // Generate a temporary signed URL valid for 1 hour
    const signedUrl = await getCvSignedUrl(profile.cv_url);
    res.status(200).json({ cv_url: signedUrl });
  } catch (err) {
    next(err);
  }
};

//Delete the CV
export const deleteCV = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user;
    if (!userPayload) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = userPayload.id;

    // First check if the user actually has a CV
    // No point hitting B2 if there is nothing to delete
    const profile = await prisma.profiles.findUnique({
      where: { user_id: userId },
      select: { cv_url: true },
    });

    if (!profile?.cv_url) {
      return res.status(404).json({ message: "No CV found to delete" });
    }

    // Tell B2 to delete the file at the stored key
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: profile.cv_url, // the key we stored, e.g. cvs/userId/cv.pdf
    });

    await b2Client.send(command);

    // Clear the cv_url and mark cv as incomplete in the database
    await prisma.profiles.update({
      where: { user_id: userId },
      data: {
        cv_url: null,
        cv_completed: false,
        updated_at: new Date(),
      },
    });

    return res.status(200).json({ message: "CV deleted successfully" });
  } catch (err) {
    next(err);
  }
};

//Service related to the Upload
const helper_uploadCV = async (
  userId: string,
  fileBuffer: Buffer,
  mimetype: string
) => {
  // Key is deterministic per user — uploading again overwrites the old file in B2
  const key = `cvs/${userId}/cv.pdf`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
  });
  await b2Client.send(command);

  // Return the key to store in the database (NOT a full URL)
  // Full URLs would be permanent and expose the private bucket — we use signed URLs instead
  return key;
};
//Get the CV URL
const getCvSignedUrl = async (cvKey: string) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: cvKey,
  });

  // URL expires after 1 hour — after that the client must call GET /me/cv again for a fresh one
  const signedUrl = await getSignedUrl(b2Client, command, { expiresIn: 3600 });
  return signedUrl;
};

//All the Follwing are relted to the user (Instructor)
export const getInstructorOwnProfileData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;

    if (!userPayload) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const userId = userPayload.id;

    let profile = await prisma.profiles.findUnique({
      where: { user_id: userId },
      select: {
        full_name: true,
        bio: true,
        users: {
          select: {
            email: true,
          },
        },
      },
    });

    // If profile doesn't exist → create one
    if (!profile) {
      profile = await prisma.profiles.create({
        data: { user_id: userId },
        select: {
          full_name: true,
          bio: true,
          users: {
            select: { email: true },
          },
        },
      });
    }

    return res.status(200).json({
      email: profile.users?.email,
      full_name: profile.full_name,
      bio: profile.bio,
    });
  } catch (err) {
    next(err);
  }
};
//this will allow the user to only update the feilds that are enterd
export const updateInstructorProfile = async (
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

    const {
      bio,
      fullName,
      email /**linkedin_url, github_url, portfolio_url**/,
    } = req.body;

    if (email !== undefined) {
      await prisma.users.update({
        where: { id: userId },
        data: { email: email },
      });
    }

    const updateData: any = {};

    if (bio !== undefined) {
      updateData.bio = bio;
    }
    if (fullName !== undefined) {
      updateData.full_name = fullName;
    }
    /** 
    if (linkedin_url !== undefined) {
      updateData.linkedin_url = linkedin_url;
    }
    if (github_url !== undefined) {
      updateData.github_url = github_url;
    }
    if (portfolio_url !== undefined) {
      updateData.portfolio_url = portfolio_url;
    }**/

    updateData.updated_at = new Date();

    //upsert = >update and insert
    const updatedProfile = await prisma.profiles.upsert({
      where: { user_id: userId },
      update: updateData,
      create: {
        user_id: userId,
        ...updateData,
      },
    });

    return res.status(200).json({
      message: "Profile updated successfully",
      profile: updatedProfile,
    });
  } catch (err) {
    next(err);
  }
};

// export const getStudentProfileData = async (
//   req: AuthRequest,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const { email } = req.body.email;
//     if (!email) {
//       return res.status(400).json({ message: "Email is required" });
//     }

//     const student = await prisma.users.findUnique({
//       where: { email: email },
//       select: { id: true },
//     });

//     if (!student) {
//       return res.status(404).json({ message: "Student not found" });
//     }

//     const studentProfile = await prisma.profiles.findUnique({
//       where: { user_id: student.id },
//       select: { full_name: true },
//     });

//     if (!studentProfile) {
//       return res
//         .status(404)
//         .json({ message: "Student Profile Does not exist" });
//     }

//     return res
//       .status(200)
//       .json({ full_name: studentProfile.full_name, email: email });
//   } catch (err) {
//     next(err);
//   }
// };

//some API to be implemented
//Delete the CV for the students

//Some admin apis:
//get any full user profile
//get any user cv profile
//allow admin to make the updates one the user profile but without the need of the ownership
//allow the admin to delete any cv also without the ownership check
//get all profiles
//update the status of the cv completion.

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
