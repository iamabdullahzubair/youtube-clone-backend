import express, { Application, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { config } from "dotenv";

// Load environment variables
config();

import errorMiddleware from "./middlewares/error.middleware";
import { ApiError } from "./utils/ApiError";
import { ApiResponse } from "./utils/ApiResponse";
import { upload } from "./middlewares/multer.middleware";
import { initializeRoutes } from "./routes/index";

const app: Application = express();

// Middleware configuration
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.REQUEST_LIMIT || "16kb",
  })
);
app.use(express.json({ limit: process.env.REQUEST_LIMIT || "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// initializing main application routes
initializeRoutes(app);

// Root route
app.get("/", (req: Request, res: Response) => {
  res
    .status(200)
    .json(new ApiResponse(200, {}, "Welcome to the YouTube Clone API"));
});

// Test POST route
app.post(
  "/test-post",
  upload.single("avatar"),
  (req: Request, res: Response) => {
    console.log("BODY :: ", req.body);
    res
      .status(200)
      .json(new ApiResponse(200, req.body, "YouTube Clone test post API"));
  }
);

// Unknown route handler
app.use((req: Request, res: Response) => {
  const link = "http://localhost:5000/api/api-info";
  const message = `Route not found. Please visit ${link} for more details.`;
  res.status(404).json(new ApiResponse(404, null, message));
});

// Error handling middleware (after all routes)
app.use(
  (err: ApiError | Error, req: Request, res: Response, next: NextFunction) => {
    errorMiddleware(err, req, res, next);
  }
);

export default app;
