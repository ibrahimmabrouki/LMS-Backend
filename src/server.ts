import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import { prisma } from "./lib/prisma";

import app from "./app";
import connectDB from "./config/db";

// connectDB();

prisma
  .$connect()
  .then(() => {
    console.log("✅ Database connected");
  })
  .catch((err) => {
    console.error("❌ Database connection failed");
    console.error(err);
    process.exit(1);
  });

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
