import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { IUserDocument, User } from "../models/user.models";

declare global {
  namespace Express {
    interface Request {
      user? : IUserDocument
    }
  }
}

// Define an interface for your custom JWT payload
interface CustomJwtPayload extends JwtPayload {
  _id: string;
}

// Function to decode the JWT and extract the user ID
const decodeToken = (token: string): string | undefined => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET as string
    );
    
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

// Middleware to verify the JWT
const verifyJWT = asyncHandler(
  async (req: Request, _: Response, next: NextFunction) => {
    try {
      // Extract the token from cookies or Authorization header
      const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        throw new ApiError(401, "Unauthorized request");
      }

      // Decode the token to get the user ID
      const userId = decodeToken(token);

      if (!userId) {
        throw new ApiError(401, "Invalid access token");
      }

      // Fetch the user from the database
      const user = await User.findById(userId);

      if (!user) {
        throw new ApiError(401, "Invalid access token");
      }

      // Attach the user to the request object
      req.user = user;

      // Call the next middleware in the chain
      next();
    } catch (error: any) {
      throw new ApiError(401, error?.message || "Invalid access token");
    }
  }
);

export default verifyJWT;
