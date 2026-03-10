import Router from "express";
import {getAllSkills, AddSkillByUser, deleteSkillByUser, getUserSkills, findSkill, addSkillGlobaly, deleteSkillGlobaly} from "../controllers/user.skills.controllers";
import {authenticateToken, authorizeRoles} from "../middlewares/auth.middleware";

const userSkillsRouter  = Router();

userSkillsRouter.get('/getAllSkills', getAllSkills);
userSkillsRouter.put('/addSkillByUser', authenticateToken, authorizeRoles('student'), AddSkillByUser);
userSkillsRouter.delete('/deleteUserSkills', authenticateToken, authorizeRoles('student'), deleteSkillByUser);
userSkillsRouter.get('/getUserSkills', authenticateToken, authorizeRoles('student'), getUserSkills);
userSkillsRouter.get("/findSkill", authenticateToken, authorizeRoles('student'), findSkill);

//For the Admin and instructor 
userSkillsRouter.post("/addSkillGlobaly", authenticateToken, authorizeRoles("admin", "instructor"), addSkillGlobaly);
userSkillsRouter.delete("/deleteSkillGlobaly", authenticateToken, authorizeRoles("admin", "instructor"), deleteSkillGlobaly);


export default userSkillsRouter;