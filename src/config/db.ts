import { Client } from "pg";

const client = new Client({
  host: "localhost",
  user: "postgres",
  port: 5432, // PostgreSQL default port
  password: process.env.DB_PASSWORD as string,
  database: process.env.DATABASE as string,
});

const connectDB = async (): Promise<void> => {
  try {
    await client.connect();
    console.log("PostgreSQL connected");
  } catch (error) {
    console.error("Connection error:", error);
    process.exit(1);
  }
};

export default connectDB;
