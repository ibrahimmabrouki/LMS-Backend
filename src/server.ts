import dotenv from "dotenv";
dotenv.config();
import { prisma } from "./lib/prisma";

import app from "./app";
import connectDB from "./config/db";

// connectDB();


prisma.$connect()
  .then(() => {
    console.log("✅ Database connected");
  })
  .catch((err) => {
    console.error("❌ Database connection failed");
    console.error(err);
    process.exit(1);
  });

app.post("/users", async (req, res) => {
    try {
      const { name } = req.body;
  
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
  
      const newUser = await prisma.user.create({
        data: {
          name: name,
        },
      });
  
      res.status(201).json(newUser);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Something went wrong" });
    }
  });

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT as string}`);
});
