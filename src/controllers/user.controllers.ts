import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../models/user.models";
import mongoose from "mongoose";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary";

// types
type registerUserDataType = {
  username: string;
  email: string;
  fullName: string;
  password: string;
};
interface MulterFiles {
  avatar?: Express.Multer.File[];
  coverImage?: Express.Multer.File[];
}

type LoginRequestBody = {
  username?: string;
  email?: string;
  password: string;
};

const generateAccessAndRefereshTokens = async (
  userId: mongoose.Types.ObjectId
) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(400, "Invalid Credentials");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const allUsers = await User.find({});
  return res.status(200).json(new ApiResponse(200, allUsers, "All users"));
});

// get user details from frontend
// validation - not empty
// check if user already exists: username, email
// check for images, check for avatar
// upload them to cloudinary, avatar
// create user object - create entry in db
// remove password and refresh token field from response
// check for user creation
// return res

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, fullName, password }: registerUserDataType =
    req.body;

  // console.log("req body :: ", req.body)
  // console.log("req file :: ", req.files)

  if (
    [fullName, email, username, password].some(
      (field) => !field || field?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }
  const isUserExist = await User.findOne({ $or: [{ username }, { email }] });
  if (isUserExist) {
    throw new ApiError(409, "User with email or username already exist");
  }

  // avatar and coverImage implementation

  const files = req.files as MulterFiles;

  let avatarLocalPath;
  if (files && files.avatar && files.avatar.length > 0) {
    avatarLocalPath = files.avatar[0].path;
  }
  let coverImageLocalPath;
  if (files && files.coverImage && files.coverImage.length > 0) {
    coverImageLocalPath = files.coverImage[0].path;
  }
  let avatar;
  if (avatarLocalPath) {
    avatar = await uploadOnCloudinary(avatarLocalPath);
  }
  let coverImage;
  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  }

  const user = await User.create({
    fullName,
    email,
    username,
    password,
    avatar: avatar?.url || "",
    coverImage: coverImage?.url || "",
  });

  if (!user) {
    throw new ApiError(500, "Something went wrong while registering user.");
  }

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

// get details from frontend
// validation - empty , exist or not
//  if exist check password is correct or not
// if valid user generate accesstoken and refresh token
//  save the refresh token into db
//  send access and refresh to the frontend and save in cookie
const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body as LoginRequestBody;

  // Input validation
  if (!(email || username) || !password) {
    throw new ApiError(400, "Please fill all the fields");
  }

  // Check if the user exists
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // Check if the password is correct
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid user Credentials" });
  }

  // Generate a token
  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(400, "Unauthorized access");
  }
  await User.findByIdAndUpdate(
    userId,
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

// Define an interface for your custom JWT payload
interface CustomJwtPayload extends JwtPayload {
  _id: mongoose.Types.ObjectId;
}

// Function to decode the JWT and extract the user ID
const decodeToken = (token: string): mongoose.Types.ObjectId | undefined => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.REFRESH_TOKEN_SECRET as string
    );
    console.log("decode", decoded);
    // Check if decoded is of type JwtPayload and has an id
    if (typeof decoded !== "string" && (decoded as CustomJwtPayload)._id) {
      return (decoded as CustomJwtPayload)._id;
    }

    return undefined;
  } catch (error) {
    console.error("Token verification failed", error);
    return undefined;
  }
};

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const userId = decodeToken(incomingRefreshToken);
    if (!userId) {
      throw new ApiError(401, "unauthorized request");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }
    // Generate a token
    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      userId
    );

    const options = {
      httpOnly: true,
      secure: true,
    };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed"
        )
      );
  } catch (error: any) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

type changePasswordBodyType = {
  oldPassword: string;
  newPassword: string;
};
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body as changePasswordBodyType;
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Unauthorized access");
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(401, "Unauthorized access");
  }
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid Credentials");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email }: { fullName: string; email: string } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Unauthorized access");
  }
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      $set: { fullName, email },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "Account details updated successfully")
    );
});

const updateAvatar = asyncHandler(async (req, res) => {
  try {
    const file = req.file as Express.Multer.File;

    if (!file) {
      throw new ApiError(400, "avatar is required");
    }
    const avatarLocalPath = file.path;
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
      throw new ApiError(
        500,
        "something went wrong while uploading on cloudinary"
      );
    }
    const userId = req.user?._id;
    const oldAvatar = req.user?.avatar;
    if (oldAvatar) {
      await deleteFromCloudinary(oldAvatar);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: { avatar: avatar.url },
      },
      { new: true }
    ).select("-password");
    res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "avatar updated successfully."));
  } catch (error: any) {
    throw new ApiError(500, "something went wrong while updating avatar");
  }
});
const updateCoverImage = asyncHandler(async (req, res) => {
  try {
    const file = req.file as Express.Multer.File;

    if (!file) {
      throw new ApiError(400, "avatar is required");
    }
    const coverImageLocalPath = file.path;
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage) {
      throw new ApiError(
        500,
        "something went wrong while uploading on cloudinary"
      );
    }
    const userId = req.user?._id;
    const oldCoverImage = req.user.coverImage;
    if (oldCoverImage) {
      await deleteFromCloudinary(oldCoverImage);
    }
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: { coverImage: coverImage.url },
      },
      { new: true }
    ).select("-password");
    res
      .status(200)
      .json(
        new ApiResponse(200, updatedUser, "cover image updated successfully.")
      );
  } catch (error: any) {
    throw new ApiError(500, "something went wrong while updating cover image");
  }
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
        channelsSubscribedToCount: { $size: "$subscribedTo" },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exists.");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully.")
    );
});
const getWatchHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                { $project: { username: 1, fullName: 1, avatar: 1, _id: 0 } },
              ],
            },
          },
          { $unwind: "$owner" },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "User watch history fetched successfully."
      )
    );
});

export {
  getAllUsers,
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
