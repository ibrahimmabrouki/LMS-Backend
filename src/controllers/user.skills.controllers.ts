import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import jwtUserPayload from "../utils/jwtUserPayload";

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

//get all the skills in the table Skills
//later on the user will search them and choose the what fits
export const getAllSkills = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const skills = await prisma.skills.findMany();
    if (!skills) {
      return res.status(404).json({ message: "No skills were found!" });
    }

    return res.status(200).json(skills);
  } catch (err) {
    next(err);
  }
};

//this used to allow the user to add skill
//there will be a middle ware to verify that this will be added to the user based on their id.
export const AddSkillByUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Expect { skills: ["Python", "JavaScript"] } in request body
    const skillNames: string[] = req.body.skills;

    if (!skillNames || skillNames.length === 0) {
      return res
        .status(400)
        .json({ message: "Please select at least one skill" });
    }

    const userPayload = req.user as jwtUserPayload;
    const userId = userPayload.id;

    for (const skillName of skillNames) {
      const skill = await prisma.skills.findUnique({
        where: { name: skillName },
      });

      // check if user already has it
      const exists = await prisma.user_skills.findUnique({
        where: {
          user_id_skill_id: {
            user_id: userId,
            skill_id: skill!.id,
          },
        },
      });

      //if not add it
      if (!exists) {
        await prisma.user_skills.create({
          data: {
            user_id: userId,
            skill_id: skill!.id,
          },
        });
      }
    }
    return res.status(201).json({
      message: `Skills added to user: ${userPayload.username}`,
      addedSkills: skillNames,
    });
  } catch (err) {
    next(err);
  }
};

//Delete Skill By user
export const deleteSkillByUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const name = req.body.skill;

    const skill = await prisma.skills.findUnique({ where: { name } });
    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    const userPayload = req.user as jwtUserPayload;
    const userId = userPayload.id;

    // Delete the skill from user_skills table
    await prisma.user_skills.delete({
      where: {
        user_id_skill_id: {
          user_id: userId,
          skill_id: skill.id,
        },
      },
    });
    return res.status(200).json({
      message: `Skill '${name}' removed from user ${userPayload.username}`,
    });
  } catch (err) {
    next(err);
  }
};

//get the skills per user after passing the middleware
export const getUserSkills = async (
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

    // Fetch all skills for the user via the join table
    const skills = await prisma.user_skills.findMany({
      where: { user_id: userId },
      include: { skills: true }, // include the skill details
    });

    if (!skills || skills.length === 0) {
      return res.status(404).json({ message: "No skills found for this user" });
    }

    const skillNames = skills.map((s) => s.skills.name);

    return res.status(200).json({ skills: skillNames });
  } catch (err) {
    next(err);
  }
};

// Search skills by keyword (GET request using query)
export const findSkill = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get the skill query from URL: ?skill=Python
    const skillQuery = (req.query.skill as string)?.trim();

    if (!skillQuery) {
      return res.status(400).json({ message: "Skill query is required" });
    }

    const skills = await prisma.skills.findMany({
      where: {
        name: { contains: skillQuery, mode: "insensitive" },
      },
    });

    return res.status(200).json(skills); // if skill is not found return an empty array
  } catch (err) {
    next(err);
  }
};

// FOR the sake of Admin

//Add Skill to skills table
export const addSkillGlobaly = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;

    if (
      !userPayload ||
      (userPayload.role !== "admin" && userPayload.role !== "instructor")
    ) {
      return res.status(403).json({
        message: "Access denied: Admins and instructors only",
      });
    }

    // Expecting { skills: ["Python", "JavaScript"] } in request body
    const skillNames: string[] = req.body.skills;

    if (!skillNames || skillNames.length === 0) {
      return res.status(400).json({ message: "Skills are required" });
    }

    const existingSkills = await prisma.skills.findMany({
      where: { name: { in: skillNames } },
    });

    const existingSkillsNames = existingSkills.map((s) => s.name);
    const newSkillNames = skillNames.filter(
      (name) => !existingSkillsNames.includes(name)
    );

    for (const newSkillName of newSkillNames) {
      await prisma.skills.create({ data: { name: newSkillName } });
    }

    return res.status(201).json({
      newSkillNames,
      existingSkillsNames,
    });
  } catch (err) {
    next(err);
  }
};

//Delete Skill to skills table
export const deleteSkillGlobaly = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userPayload = req.user as jwtUserPayload;

    if (
      !userPayload ||
      (userPayload.role !== "admin" && userPayload.role !== "instructor")
    ) {
      return res.status(403).json({
        message: "Access denied: Admins and instructors only",
      });
    }

    // Expecting: { skills: ["Python", "React"] }
    const skillNames: string[] = req.body.skills;

    if (!skillNames || skillNames.length === 0) {
      return res.status(400).json({
        message: "Skills are required",
      });
    }

    //we need to get the skill id for each skillname, then we can first
    //delete all the records in the user_skill table because it is dependent on skills table

    //first we get the skills rows from db based on the skillnames
    const skills = await prisma.skills.findMany({
      where: { name: { in: skillNames } },
    });

    //here we are getting the skillids from the skill rows we retreived
    const skillIds = skills.map((skill) => skill.id);

    //deleting the skill-user tuple from user_skills
    await prisma.user_skills.deleteMany({
      where: { skill_id: { in: skillIds } },
    });

    //deleting the skill itself from the skills table
    const deletedSkills = await prisma.skills.deleteMany({
      where: { id: { in: skillIds } },
    });

    return res.status(200).json({
      message: "Skills deleted successfully",
      deletedSkills: skillNames,
      deletedCount: deletedSkills.count,
    });
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
