import { ApiResponse } from "../utils/ApiResponse";
import { Subscription } from "../models/subscription.models";
import { asyncHandler } from "../utils/asyncHandler";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError";

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const subscribedChannels = await Subscription.aggregate([
    // Match subscriptions for the current user
    { $match: { subscriber: new mongoose.Types.ObjectId(userId) } },

    // Lookup channel information from the `users` collection
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channels",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
              _id: 0, // Optional: remove the _id field
            },
          },
        ],
      },
    },

    // Unwind the `channels` array so each document contains a single channel object
    { $unwind: "$channels" },

    // Lookup to count the total subscribers for each channel
    {
      $lookup: {
        from: "subscriptions",
        localField: "channel",
        foreignField: "channel",
        as: "subscriberCount",
      },
    },

    // Add a new field `totalSubscribers` with the count of subscribers for each channel
    {
      $addFields: {
        "channels.totalSubscribers": { $size: "$subscriberCount" },
      },
    },

    // Only keep the `channels` field in the final output
    { $project: { channels: 1 } },
  ]);

  console.log("Subscribed Channels:", subscribedChannels);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannels,
        "Successfully retrived subscribed channels"
      )
    );
});
const toggleSubscription = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { channelId } = req.params;

  const isSubscribed = await Subscription.findOne({
    subscriber: userId,
    channel: channelId,
  });
  let flag: boolean;
  console.log("isSubscribed :: ", isSubscribed);
  if (isSubscribed) {
    const remove = await Subscription.deleteOne({
      subscriber: userId,
      channel: channelId,
    });
    flag = false;
    console.log("remove :: ", remove);
  } else {
    const subscribe = await Subscription.create({
      subscriber: userId,
      channel: channelId,
    });
    flag = true;
    console.log("subscribe", subscribe);
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isSubscribed: flag },
        "Successfully Toggled subscription"
      )
    );
});

// Controller to allow the channel owner to view their subscriber list
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const userId = req.user._id;

  // Check if the authenticated user is the channel owner
  if (userId.toString() !== channelId) {
    throw new ApiError(403, "You are not authorized to access this resource");
  }

  // Aggregation pipeline to fetch subscribers of the channel
  const subscribers = await Subscription.aggregate([
    { $match: { channel: new mongoose.Types.ObjectId(channelId) } },
    {
      $lookup: {
        from: "users", 
        localField: "subscriber",
        foreignField: "_id",
        as: "subscribers",
        pipeline: [
          { $project: { _id: 0, username: 1, fullName: 1, avatar: 1 } },
        ],
      },
    },
    { $unwind: "$subscribers" },
    { $replaceRoot: { newRoot: "$subscribers" } }, // This outputs only the subscriber info
  ]);

  // Return the subscriber list
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribers,
        "Successfully retrieved subscriber list"
      )
    );
});


export { getSubscribedChannels, toggleSubscription, getUserChannelSubscribers };
