import mongoose, { isValidObjectId } from "mongoose";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { Like } from "../models/like.models";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Please use id in correct format");
  }
  const existingLike = await Like.findOne({
    video: new mongoose.Types.ObjectId(videoId),
    likedBy: req.user._id,
  });
  if (existingLike) {
    await Like.deleteOne({
      video: new mongoose.Types.ObjectId(videoId),
      likedBy: req.user._id,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Successfully Unliked the video"));
  } else {
    await Like.create({
      video: videoId,
      likedBy: req.user._id,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Successfully liked the video"));
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Please use id in correct format");
  }
  const existingLike = await Like.findOne({
    comment: new mongoose.Types.ObjectId(commentId),
    likedBy: req.user._id,
  });
  if (existingLike) {
    await Like.deleteOne({
      comment: new mongoose.Types.ObjectId(commentId),
      likedBy: req.user._id,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Successfully Unliked the comment"));
  } else {
    await Like.create({
      comment: commentId,
      likedBy: req.user._id,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Successfully liked the comment"));
  }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Please use id in correct format");
  }
  const existingLike = await Like.findOne({
    tweet: new mongoose.Types.ObjectId(tweetId),
    likedBy: req.user._id,
  });
  if (existingLike) {
    await Like.deleteOne({
      tweet: new mongoose.Types.ObjectId(tweetId),
      likedBy: req.user._id,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Successfully Unliked the tweet"));
  } else {
    await Like.create({
      tweet: tweetId,
      likedBy: req.user._id,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Successfully liked the tweet"));
  }
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const likedVideos = await Like.aggregate([
    { $match: { likedBy: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [{ $project: { username: 1, fullName: 1, avatar: 1 } }],
            },
          },
          { $unwind: "$owner" },
        ],
      },
    },
    {
      $addFields: {
        totalLikedVideos: { $size: "$videos" },
      },
    },
    { $project: { videos: 1 } },
  ]);

  if (likedVideos.length == 0) {
    return res.status(200).json(new ApiResponse(200, {}, "No liked videos."));
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, likedVideos[0], "Successfully fetched liked Videos")
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
