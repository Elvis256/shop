import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "5242880"); // 5MB
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const ALLOWED_MIMETYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

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

// Use memory storage so files are validated BEFORE touching disk
const memoryStorage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."));
    return;
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new Error("Invalid file extension. Only .jpg, .jpeg, .png, .gif, and .webp are allowed."));
    return;
  }

  cb(null, true);
};

// Validate magic bytes in memory, then write safe files to disk
export function validateUploadedFiles(req: any, res: any, next: any) {
  const files = req.files as Express.Multer.File[] | undefined;
  const file = req.file as Express.Multer.File | undefined;
  
  const filesToValidate = files || (file ? [file] : []);
  
  for (const uploadedFile of filesToValidate) {
    if (!uploadedFile.buffer) {
      return res.status(400).json({ error: "File upload processing error" });
    }

    if (!validateFileContent(uploadedFile.buffer, uploadedFile.mimetype)) {
      return res.status(400).json({ error: "Invalid file content. File does not match declared type." });
    }

    // Write validated file to disk
    const ext = path.extname(uploadedFile.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    try {
      fs.writeFileSync(filepath, uploadedFile.buffer, { mode: 0o644 });
    } catch (err) {
      return res.status(500).json({ error: "Failed to save file" });
    }

    // Update file metadata so downstream handlers see the disk path
    uploadedFile.path = filepath;
    uploadedFile.filename = filename;
    uploadedFile.destination = UPLOAD_DIR;
  }
  
  next();
}

const upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
  },
});

export const uploadSingle = upload.single("image");
export const uploadMultiple = upload.array("images", 20);
