// errorMiddleware.js
import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

const errorMiddleware = (err:ApiError | Error, req:Request, res:Response, next:NextFunction) => {
  // Check if the error is an instance of ApiError
  if (err instanceof ApiError) {
    console.error("Error from err.middleware instance of ApiError :", err)
    return res.status(err.statusCode).json({ message: err.message , success : false });
  }

  // Handle unexpected errors
  console.error("Error from err.middleware :: ",err); // Log the error (useful for debugging)
  res.status(500).json({ message: 'Internal server error' , success : false });
};

export default errorMiddleware;
