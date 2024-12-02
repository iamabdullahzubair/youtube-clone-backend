import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import {config} from "dotenv";

config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath: string) => {
  try {
    if (!localFilePath) return null;
    //upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: "Youtube_Clone_App",
    });

    // file has been uploaded successfull
    //console.log("file is uploaded on cloudinary ", response.url);
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    console.log("cloudinary Error :: ", error);
    fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation got failed
    return null;
  }
};
const deleteFromCloudinary = async (
  url: string,
  resourceType: "image" | "video" = "image"
) => {
  try {
    if (!url) return;

    // Extract public_id from the URL
    const publicId = url.split("/").slice(-2).join("/").split(".")[0]; // Extracts the public_id

    // Delete the file from Cloudinary using the public_id and specified resource type
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    console.log("File deleted from Cloudinary:", result); // Log the result of deletion
    return result;
  } catch (error) {
    console.error("Error deleting file:", error);
    throw new Error("Error deleting file");
  }
};

const deleteFromCloudinaryWithRetry = async (
  fileUrl: string,
  resourceType: "image" | "video" = "image",
  maxRetries: number = 3,
  delay: number = 1000 // milliseconds
): Promise<boolean> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await deleteFromCloudinary(fileUrl, resourceType);
    if (response.result === "ok") {
      return true; // Deletion succeeded
    }
    console.warn(`Attempt ${attempt} to delete ${fileUrl} failed. Retrying...`);
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retrying
    }
  }
  return false; // Deletion failed after max retries
};

export {
  uploadOnCloudinary,
  deleteFromCloudinary,
  deleteFromCloudinaryWithRetry,
};
