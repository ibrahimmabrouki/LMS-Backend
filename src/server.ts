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


app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT as string}`);
});
