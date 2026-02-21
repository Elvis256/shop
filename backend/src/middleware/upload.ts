import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "5242880"); // 5MB

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Magic bytes for image validation
const MAGIC_BYTES: Record<string, Buffer[]> = {
  "image/jpeg": [Buffer.from([0xff, 0xd8, 0xff])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  "image/gif": [Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
  "image/webp": [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF header
};

function validateFileContent(buffer: Buffer, mimetype: string): boolean {
  const magicBytes = MAGIC_BYTES[mimetype];
  if (!magicBytes) return false;
  
  return magicBytes.some(magic => {
    if (buffer.length < magic.length) return false;
    return buffer.subarray(0, magic.length).equals(magic);
  });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Sanitize filename
    const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext) ? ext : ".jpg";
    const filename = `${uuidv4()}${safeExt}`;
    cb(null, filename);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  
  if (!allowedTypes.includes(file.mimetype)) {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."));
    return;
  }
  
  cb(null, true);
};

// Middleware to validate file content after upload
export function validateUploadedFiles(req: any, res: any, next: any) {
  const files = req.files as Express.Multer.File[] | undefined;
  const file = req.file as Express.Multer.File | undefined;
  
  const filesToValidate = files || (file ? [file] : []);
  
  for (const uploadedFile of filesToValidate) {
    try {
      const buffer = fs.readFileSync(uploadedFile.path);
      if (!validateFileContent(buffer, uploadedFile.mimetype)) {
        // Delete invalid file
        fs.unlinkSync(uploadedFile.path);
        return res.status(400).json({ error: "Invalid file content. File does not match declared type." });
      }
    } catch (err) {
      return res.status(500).json({ error: "File validation failed" });
    }
  }
  
  next();
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
  },
});

export const uploadSingle = upload.single("image");
export const uploadMultiple = upload.array("images", 10);
