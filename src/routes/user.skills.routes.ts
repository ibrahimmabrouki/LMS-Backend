import Router from "express";
import {getAllSkills, AddSkillByUser, deleteSkillByUser, getUserSkills, findSkill, addSkillGlobaly, deleteSkillGlobaly} from "../controllers/user.skills.controllers";
import {authenticateToken, authorizeRoles} from "../middlewares/auth.middleware";

const userSkillsRouter  = Router();

userSkillsRouter.get('/getAllSkills', getAllSkills);
userSkillsRouter.put('/addSkillByUser', authenticateToken, authorizeRoles('instructor'), AddSkillByUser);
userSkillsRouter.delete('/deleteUserSkills', authenticateToken, authorizeRoles('instructor'), deleteSkillByUser);
userSkillsRouter.get('/getUserSkills', authenticateToken, authorizeRoles('instructor'), getUserSkills);
userSkillsRouter.get("/findSkill", authenticateToken, authorizeRoles('instructor'), findSkill);

//For the Admin
userSkillsRouter.post("/addSkillGlobaly", authenticateToken, authorizeRoles('admin'), addSkillGlobaly);
userSkillsRouter.delete("/deleteSkillGlobaly", authenticateToken, authorizeRoles('admin'), deleteSkillGlobaly);




export default userSkillsRouter;