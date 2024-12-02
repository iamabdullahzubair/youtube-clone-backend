import { Video } from "../models/video.models";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import {
  deleteFromCloudinary,
  deleteFromCloudinaryWithRetry,
  uploadOnCloudinary,
} from "../utils/cloudinary";
import mongoose from "mongoose";
import { Request, RequestHandler, RequestParamHandler } from "express";

// types
interface MulterFiles {
  videoFile?: Express.Multer.File[];
  thumbnail?: Express.Multer.File[];
}

interface publishANewVideoBodyTypes {
  title: string;
  description: string;
  isPublished: boolean;
}

const getAllVideos = asyncHandler(async (req, res) => {
  try {
    // Optional: Add pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Fetch all videos with pagination applied
    // const videos = await Video.find().skip(skip).limit(limit).populate("owner", "username fullName avatar -_id");

    // Filtering options (e.g., title, isPublished) based on query parameters
    const matchConditions: any = {};
    if (req.query.userId) {
      matchConditions.owner = new mongoose.Types.ObjectId(
        req.query.userId as string
      );
    }
    if (req.query.title) {
      matchConditions.title = {
        $regex: req.query.title as string,
        $options: "i",
      }; // case-insensitive search
    }
    matchConditions.isPublished = true;
    // Dynamic sorting
    const sortField = (req.query.sortBy as string) || "createdAt"; // default sort by createdAt
    const sortOrder = req.query.order === "asc" ? 1 : -1; // default to descending order

    // using aggregation
    const videos = await Video.aggregatePaginate(
      Video.aggregate([
        {
          $match: matchConditions,
        },
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
            pipeline: [
              {
                $project: {
                  _id: 0,
                  username: 1,
                  fullName: 1,
                  avatar: 1,
                },
              },
            ],
          },
        },
        { $unwind: "$owner" },
        { $sort: { [sortField]: sortOrder } },
      ]),
      { page, limit }
    );

    // Response with videos and pagination metadata
    res.status(200).json(
      new ApiResponse(
        200,
        videos,
        "Successfully retrieved all videos."
      )
    );
  } catch (error: any) {
    console.error("Error retrieving videos:", error);

    // Error response with a user-friendly message
    return res
      .status(500)
      .json(
        new ApiResponse(
          500,
          null,
          "An error occurred while retrieving videos. Please try again later or contact support if the issue persists."
        )
      );
  }
});

const publishANewVideo = asyncHandler(async (req, res) => {
  const files = req.files as MulterFiles;

  let videoLocalPath;
  if (files && Array.isArray(files.videoFile) && files.videoFile.length > 0) {
    videoLocalPath = files.videoFile[0].path;
  }
  let thumbnailLocalPath;
  if (files && Array.isArray(files.thumbnail) && files.thumbnail.length > 0) {
    thumbnailLocalPath = files.thumbnail[0].path;
  }

  if (!videoLocalPath || !thumbnailLocalPath) {
    throw new ApiError(400, "video and thumbnail are required fields");
  }
  const { title, description, isPublished } =
    req.body as publishANewVideoBodyTypes;
  if (!title || !description) {
    throw new ApiError(400, "title and description are required fields");
  }
  const video = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
  if (!video || !thumbnail) {
    throw new ApiError(
      500,
      "Something went wrong while uploading on cloudinary"
    );
  }

  const videoDatainDb = await Video.create({
    videoFile: video.url,
    thumbnail: thumbnail.url,
    title,
    description,
    isPublished: isPublished || true,
    duration: video.duration,
    owner: req.user?._id,
  });

  res
    .status(200)
    .json(new ApiResponse(200, videoDatainDb, "Video uploaded successfully."));
});

const getVideoById = asyncHandler(async (req, res) => {
  try {
    const id = req.params.videoId;
    const video = await Video.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "likes",
        },
      },
      {
        $addFields: {
          totalLikes: { $size: "$likes" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [
            {
              $project: {
                _id: 0,
                username: 1,
                fullName: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      { $unwind: "$owner" },
      {
        $project: {
          likes: 0,
        },
      },
    ]);

    // If no video is found, return a 404 error
    if (!video || video.length === 0) {
      return res
        .status(404)
        .json(
          new ApiResponse(
            404,
            null,
            "Video not found. Please check the video ID and try again."
          )
        );
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          video[0],
          "Successfully retrieved the video details."
        )
      );
  } catch (error: any) {
    throw new ApiError(
      500,
      "something went wrong while getting your video",
      error?.message
    );
  }
});

const updateVideoById = asyncHandler(async (req, res) => {
  try {
    const thumbnailLocalPath = req.file?.path; // Get file path if file exists
    const { title, description, isPublished } =
      req.body as publishANewVideoBodyTypes;
    const id = req.params.videoId;

    const oldVideo = await Video.findById(id);
    // Update the video with new values; if thumbnail is provided, update it as well
    const updateFields: any = { title, description, isPublished };
    if (thumbnailLocalPath) {
      const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
      updateFields.thumbnail = thumbnail.url;
      const res = await deleteFromCloudinary(oldVideo.thumbnail);
    }

    // Perform the update operation
    const updatedVideo = await Video.findByIdAndUpdate(id, updateFields, {
      new: true,
    }).populate("owner", "username fullName avatar -_id");

    // If the video was not found, return a 404 error
    if (!updatedVideo) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Video not found. Unable to update."));
    }

    // Respond with the updated video details
    res
      .status(200)
      .json(new ApiResponse(200, updatedVideo, "Video updated successfully."));
  } catch (error: any) {
    console.error("Error updating video:", error);

    // Return a user-friendly error message with guidance on next steps
    return res
      .status(500)
      .json(
        new ApiResponse(
          500,
          null,
          "An error occurred while updating the video. Please try again or contact support if the issue persists."
        )
      );
  }
});

const deleteVideoById = asyncHandler(async (req, res) => {
  const id = req.params.videoId;
  const video = await Video.findById(id);
  if (!video) {
    throw new ApiError(404, "Video not found.");
  }
  // Delete video file from Cloudinary with retry
  const videoDeleted = await deleteFromCloudinaryWithRetry(
    video.videoFile,
    "video"
  );
  if (!videoDeleted) {
    throw new ApiError(
      500,
      "Failed to delete video file from Cloudinary after multiple attempts."
    );
  }
  const thumbnailDeleted = await deleteFromCloudinaryWithRetry(video.thumbnail);
  if (!thumbnailDeleted) {
    throw new ApiError(
      500,
      "Failed to delete thumbnail from Cloudinary after multiple attempts."
    );
  }
  // Attempt to delete the video by its ID
  const deletedVideo = await Video.findByIdAndDelete(id);

  // Check if the video was found and deleted
  if (!deletedVideo) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Video not found. Unable to delete."));
  }

  // If deleted successfully, send a success response
  res
    .status(200)
    .json(
      new ApiResponse(200, { message: "Video deleted successfully." }, "Ok")
    );
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  try {
    const id = req.params.videoId;

    // Find the video by its ID
    const video = await Video.findById(id);

    // If the video is not found, return a 404 response
    if (!video) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Video not found."));
    }

    // Toggle the isPublished status
    video.isPublished = !video.isPublished;

    // Save the updated video document
    await video.save();

    // Respond with the updated status
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isPublished: video.isPublished },
          "Publish status toggled successfully."
        )
      );
  } catch (error: any) {
    console.error("Error toggling publish status:", error);

    // Return a user-friendly error message in case of any errors
    return res
      .status(500)
      .json(
        new ApiResponse(
          500,
          null,
          "An error occurred while toggling the publish status. Please try again or contact support if the issue persists."
        )
      );
  }
});

// TODO: getUserPublishedVideos

export {
  getAllVideos,
  publishANewVideo,
  getVideoById,
  updateVideoById,
  deleteVideoById,
  togglePublishStatus,
};
