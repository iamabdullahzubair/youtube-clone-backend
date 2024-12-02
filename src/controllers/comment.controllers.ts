import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.models";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id.");
  }
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  // Dynamic sorting
  const sortField = (req.query.sortBy as string) || "createdAt"; // default sort by createdAt
  const sortOrder = req.query.order === "asc" ? 1 : -1; // default to descending order

  const comments = await Comment.aggregatePaginate(
    Comment.aggregate([
      { $match: { video: new mongoose.Types.ObjectId(videoId) } },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerInfo",
          pipeline: [{ $project: { username: 1, avatar: 1 } }],
        },
      },
      { $unwind: "$ownerInfo" },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "comment",
          as: "likes",
        },
      },
      {
        $addFields: {
          totalLikes: { $size: "$likes" },
        },
      },
      {$sort : {[sortField] : sortOrder}},
      {
        $project: {
          content: 1,
          owner: "$ownerInfo",
          totalLikes: 1,
          createdAt: 1,
        },
      },
    ]),
    { page, limit }
  );

  res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments retrieved successfully."));
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;
  const ownerId = req.user._id; // Assuming authenticated user ID is in req.user

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id.");
  }
  if (!content || !videoId) {
    throw new ApiError(400, "Content and video ID are required.");
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: ownerId,
  });

  res
    .status(201)
    .json(new ApiResponse(201, comment, "Comment added successfully."));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment Id.");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment Not Found.");
  }

  if (String(comment.owner) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to update this comment.");
  }

  comment.content = content;
  await comment.save();

  res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment updated successfully."));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment Id.");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found.");
  }

  if (String(comment.owner) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to delete this comment.");
  }

  await Comment.deleteOne({ _id: commentId });

  res
    .status(200)
    .json(new ApiResponse(200, null, "Comment deleted successfully."));
});

export { getVideoComments, addComment, updateComment, deleteComment };
