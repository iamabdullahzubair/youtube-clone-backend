import { Application } from "express";

import userRouter from "./user.routes";
import tweetRouter from "./tweet.routes";
import subscriptionRouter from "./subscription.routes";
import videoRouter from "./video.routes";
import commentRouter from "./comment.routes";
import likeRouter from "./like.routes";
import playlistRouter from "./playlist.routes";
import dashboardRouter from "./dashboard.routes";

export const initializeRoutes = (app: Application) => {
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/videos", videoRouter);
  app.use("/api/v1/playlist", playlistRouter);
  app.use("/api/v1/subscriptions", subscriptionRouter);
  app.use("/api/v1/comments", commentRouter);
  app.use("/api/v1/tweets", tweetRouter);
  app.use("/api/v1/likes", likeRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
};
