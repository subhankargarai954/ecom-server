import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memory storage — buffer is uploaded to Cloudinary in the controller
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Only jpg, png, webp images are allowed."));
        }
        cb(null, true);
    },
});

// Wraps the stream-based cloudinary upload into a Promise
const uploadToCloudinary = (buffer) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "ecom-products", transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto" }] },
            (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(buffer);
    });

export { upload, cloudinary, uploadToCloudinary };
