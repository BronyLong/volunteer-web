import express from "express";

export function createTestApp(basePath, router) {
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(basePath, router);

  return app;
}
