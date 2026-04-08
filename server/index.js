import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { testDbConnection } from "./db.js";

import authRoutes from "./routes/auth.routes.js";
import eventsRoutes from "./routes/events.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import applicationsRoutes from "./routes/applications.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API is working" });
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/applications", applicationsRoutes);
app.use("/api/categories", categoriesRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}`);
  try {
    await testDbConnection();
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
});