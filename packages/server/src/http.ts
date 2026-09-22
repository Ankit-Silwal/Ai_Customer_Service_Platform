import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { config } from "./config.ts";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function baseApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== config.WEB_ORIGIN
    )
      return res.status(403).json({ error: "This origin is not allowed." });
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "8mb" }));
  return app;
}
export const errors: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  if (error instanceof ZodError) {
    res
      .status(400)
      .json({
        error: "Please check the supplied values.",
        fields: error.flatten(),
      });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (
    typeof error === "object" &&
    error &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    res.status(413).json({ error: "File too large. Maximum size is 5 MB." });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "Invalid JSON." });
    return;
  }
  console.error(
    JSON.stringify({
      event: "request_failed",
      kind: error instanceof Error ? error.name : "UnknownError",
    }),
  );
  res.status(500).json({ error: "Something went wrong. Please try again." });
};
