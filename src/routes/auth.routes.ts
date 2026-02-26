import { Router } from "express";
import {login, logout, refreshAccessToken} from "../controllers/auth.controllers";

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/reftoken', refreshAccessToken);



export default router;