import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.models";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  // Validate input
  if (!name || !description) {
    throw new ApiError(400, "Name and description are required fields.");
  }

  // Optional: Check if a playlist with the same name already exists for the user
  const existingPlaylist = await Playlist.findOne({
    name,
    owner: req.user._id,
  });
  if (existingPlaylist) {
    throw new ApiError(400, "You already have a playlist with this name.");
  }

  // Create new playlist
  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user._id,
  });

  // Error handling if playlist creation fails
  if (!playlist) {
    throw new ApiError(
      500,
      "Something went wrong while creating the playlist."
    );
  }

  // Populate owner details
  await playlist.populate({
    path: "owner",
    select: "username fullName avatar -_id", // Fields you want to populate from the owner
  });

  // Return success response with owner details
  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Successfully created playlist."));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const playlists = await Playlist.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(userId) } },
    // owner ki details
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
    {
      $addFields: {
        totalVideos: { $size: "$videos" },
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        totalVideos: 1,
        owner: 1,
        updatedAt: 1,
      },
    },
  ]);

  // Check if playlists were found
  if (playlists.length === 0) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "No playlists found for this user."));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlists, "Successfully retrieved user playlists.")
    );
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const playlist = await Playlist.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(playlistId) } },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
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
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "playListOwner",
        pipeline: [{ $project: { username: 1, fullName: 1, avatar: 1 } }],
      },
    },
    { $unwind: "$playListOwner" },
    {
      $addFields: {
        totalVideos: { $size: "$videos" }, // Add a totalVideos field as the size of the videos array
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        playListOwner: 1,
        videos: 1,
        updatedAt: 1,
        totalVideos: 1, // Include totalVideos in the final response
      },
    },
  ]);
  if (playlist.length == 0) {
    throw new ApiError(404, "No Playlist found. Invalid Id");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist[0], "Successfully retrived the playlist")
    );
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  if (!playlistId || !videoId) {
    throw new ApiError(400, "PlaylistId and videoId is required.");
  }
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found.");
  }
  if (playlist.videos.includes(videoId)) {
    throw new ApiError(400, "Video already in playlist");
  }
  const updatedPlaylist = await Playlist.updateOne(
    {
      _id: new mongoose.Types.ObjectId(playlistId),
    },
    { $push: { videos: videoId } }
  );

  if (!updatedPlaylist.acknowledged) {
    throw new ApiError(500, "Failed to add video to playlist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { acknowledged: updatedPlaylist.acknowledged },
        "Successfully added video to playlist."
      )
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  if (!playlistId || !videoId) {
    throw new ApiError(400, "playlistId and videoId is required.");
  }
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "playlist not found.");
  }
  if (!playlist.videos.includes(videoId)) {
    throw new ApiError(400, "Video not found in playlist");
  }

  const updatedPlaylist = await Playlist.updateOne(
    {
      _id: new mongoose.Types.ObjectId(playlistId),
    },
    { $pull: { videos: videoId } }
  );

  if (!updatedPlaylist.acknowledged) {
    throw new ApiError(500, "Failed to remove video from playlist");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { acknowledged: updatedPlaylist.acknowledged },
        "Successfully removed video from playlist."
      )
    );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!playlistId) {
    throw new ApiError(400, "PlaylistId required.");
  }
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found.");
  }

  const deletedPlaylist = await Playlist.findByIdAndDelete(playlist);
  if (!deletedPlaylist) {
    throw new ApiError(500, "Failed to delete Playlist.");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { acknowledged: true },
        "Successfully deleted Playlist."
      )
    );
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  // Ensure at least one field (name or description) is provided
  if (!name && !description) {
    throw new ApiError(400, "Either name or description is required.");
  }

  // Find the playlist by ID
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found. Invalid ID.");
  }

  // Prepare the update data
  const updateData: any = {};
  if (name) updateData.name = name;
  if (description) updateData.description = description;

  // Update the playlist using findByIdAndUpdate
  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    updateData,
    { new: true } // Return the updated playlist object
  );

  if (!updatedPlaylist) {
    throw new ApiError(404, "No Playlist found. Invalid ID.");
  }

  // Aggregate to get the playlist details with videos and owner info
  const populatedPlaylist = await Playlist.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(playlistId) } },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
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
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "playListOwner",
        pipeline: [{ $project: { username: 1, fullName: 1, avatar: 1 } }],
      },
    },
    { $unwind: "$playListOwner" },
    {
      $addFields: {
        totalVideos: { $size: "$videos" }, // Add a totalVideos field as the size of the videos array
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        playListOwner: 1,
        videos: 1,
        updatedAt: 1,
        totalVideos: 1, // Include totalVideos in the final response
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        populatedPlaylist[0],
        "Playlist updated successfully."
      )
    );
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
