import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.models";
import { User } from "../models/user.models";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content) {
    throw new ApiError(400, "required field.");
  }
  const tweet = await Tweet.create({
    content,
    owner: req.user._id,
  });
  if (!tweet) {
    throw new ApiError(
      500,
      "Something went wrong while creating tweet. Please try again."
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Successfully tweet created."));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid Id format");
  const tweets = await Tweet.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(userId) } },
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
  ]);
  if (tweets && tweets.length == 0) throw new ApiError(404, "No any Tweets");
  return res
    .status(200)
    .json(new ApiResponse(200, tweets, "Successfully retrived tweets."));
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;
  if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid Id format");
  if (!content) throw new ApiError(400, "required field.");
  const tweet = await Tweet.findById(tweetId);
  if (!tweet) throw new ApiError(404, "Tweet Not Found.");
  if (String(tweet.owner) != String(req.user._id))
    throw new ApiError(400, "YOu are not authorized to update this tweet.");

  tweet.content = content;
  await tweet.save();

  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Updated tweet Successfuly."));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet Id.");
  }

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "Tweet Not Found.");
  }

  if (String(tweet.owner) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to delete this tweet.");
  }

  await Tweet.deleteOne({ _id: tweetId });

  res
    .status(200)
    .json(new ApiResponse(200, null, "Tweet deleted successfully."));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
