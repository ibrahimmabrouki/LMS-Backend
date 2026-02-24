// src/test.js (CommonJS)
const { PrismaClient } = require("../generated/prisma/client");
require("dotenv").config();

const prisma = new PrismaClient({}); // Prisma 7 requires an options object

async function test() {
  try {
    await prisma.$connect();
    console.log("✅ Prisma connected!");
  } catch (err) {
    console.error("❌ Prisma connection failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();