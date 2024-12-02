import { Router } from "express";

import {
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
} from "../controllers/subscription.controllers";
import verifyJWT from "../middlewares/auth.middleware";

const router = Router();
router.use(verifyJWT);
router.route("/channel").get((req, res) => {
    res.json({message : "channel", user : req.user})
})
router.route("/channels").get(getSubscribedChannels)
router
  .route("/channel/:channelId")
  .get(getSubscribedChannels)
  .post(toggleSubscription);

router.route("/subsribers/:channelId").get(getUserChannelSubscribers);

export default router;
