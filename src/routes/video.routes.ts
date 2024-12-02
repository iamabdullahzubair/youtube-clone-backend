import { Router } from "express";
import {
  deleteVideoById,
  getAllVideos,
  getVideoById,
  publishANewVideo,
  togglePublishStatus,
  updateVideoById,
} from "../controllers/video.controllers";
import verifyJWT from "../middlewares/auth.middleware";
import { upload } from "../middlewares/multer.middleware";

const router = Router();

router
  .route("/")
  .get(getAllVideos)
  .post(
    verifyJWT,
    upload.fields([
      { name: "videoFile", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ]),
    publishANewVideo
  );
router
  .route("/:videoId")
  .get(getVideoById)
  .patch(verifyJWT, upload.single("thumbnail"), updateVideoById)
  .delete(verifyJWT, deleteVideoById);

router
.route("/toggle/publish/:videoId")
.patch(verifyJWT, togglePublishStatus);

export default router;
