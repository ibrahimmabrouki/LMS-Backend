import { Router } from "express";
import { search, ask, syncStudent, removeStudentFromAI } from "../controllers/ai.controllers";
import { authenticateToken } from "../middlewares/auth.middleware";

const aiRouter = Router();

// POST /ai/search  — { query: "best backend developer", top_k: 3 }
aiRouter.post("/search", authenticateToken, search);

// POST /ai/ask  — { question: "who is best for backend?", top_k: 3 }
aiRouter.post("/ask", authenticateToken, ask);

// POST /ai/sync/:userId  — admin re-syncs a student after skills update
aiRouter.post("/sync/:userId", authenticateToken, syncStudent);

aiRouter.delete("/sync/:userId", authenticateToken, removeStudentFromAI);

export default aiRouter;