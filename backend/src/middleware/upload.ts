import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import sharp from "sharp";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760"); // 10MB raw (will compress)
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 80;
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const ALLOWED_MIMETYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const DOCUMENT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];
const DOCUMENT_MIMETYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Magic bytes for image validation
const MAGIC_BYTES: Record<string, Buffer[]> = {
  "image/jpeg": [Buffer.from([0xff, 0xd8, 0xff])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  "image/gif": [Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
  "image/webp": [Buffer.from([0x52, 0x49, 0x46, 0x46])],
  "application/pdf": [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
};

function validateFileContent(buffer: Buffer, mimetype: string): boolean {
  const magicBytes = MAGIC_BYTES[mimetype];
  if (!magicBytes) return false;
  return magicBytes.some(magic => {
    if (buffer.length < magic.length) return false;
    return buffer.subarray(0, magic.length).equals(magic);
  });
}

/** Optimize image: resize to max width, convert to JPEG, compress */
async function optimizeImage(buffer: Buffer, mimetype: string): Promise<{ data: Buffer; ext: string }> {
  // Skip GIFs (animated) — just pass through
  if (mimetype === "image/gif") {
    return { data: buffer, ext: ".gif" };
  }

  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    let pipeline = image;

    // Resize if wider than max
    if (metadata.width && metadata.width > MAX_WIDTH) {
      pipeline = pipeline.resize(MAX_WIDTH, undefined, { withoutEnlargement: true });
    }

    // Convert to JPEG for best size/quality ratio
    const optimized = await pipeline
      .jpeg({ quality: JPEG_QUALITY, progressive: true })
      .toBuffer();

    return { data: optimized, ext: ".jpg" };
  } catch {
    // If Sharp fails, save original
    const ext = mimetype === "image/png" ? ".png" : mimetype === "image/webp" ? ".webp" : ".jpg";
    return { data: buffer, ext };
  }
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

// Validate magic bytes, optimize with Sharp, write to disk
export async function validateUploadedFiles(req: any, res: any, next: any) {
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

    // Optimize image
    const { data, ext } = await optimizeImage(uploadedFile.buffer, uploadedFile.mimetype);

    const filename = `${uuidv4()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    try {
      await fs.promises.writeFile(filepath, data, { mode: 0o644 });
    } catch {
      return res.status(500).json({ error: "Failed to save file" });
    }

    // Update metadata for downstream handlers
    uploadedFile.path = filepath;
    uploadedFile.filename = filename;
    uploadedFile.destination = UPLOAD_DIR;
    uploadedFile.size = data.length;
  }

  next();
}

// Validate + optimize documents (images get Sharp optimization, PDFs pass through)
export async function validateUploadedDocuments(req: any, res: any, next: any) {
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

    let data: Buffer;
    let ext: string;

    if (uploadedFile.mimetype === "application/pdf") {
      // PDFs: write raw buffer, no Sharp optimization
      data = uploadedFile.buffer;
      ext = ".pdf";
    } else {
      // Images: optimize as usual
      const optimized = await optimizeImage(uploadedFile.buffer, uploadedFile.mimetype);
      data = optimized.data;
      ext = optimized.ext;
    }

    const filename = `${uuidv4()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    try {
      await fs.promises.writeFile(filepath, data, { mode: 0o644 });
    } catch {
      return res.status(500).json({ error: "Failed to save file" });
    }

    uploadedFile.path = filepath;
    uploadedFile.filename = filename;
    uploadedFile.destination = UPLOAD_DIR;
    uploadedFile.size = data.length;
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

const documentFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!DOCUMENT_MIMETYPES.includes(file.mimetype)) {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, WebP, and PDF are allowed."));
    return;
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!DOCUMENT_EXTENSIONS.includes(ext)) {
    cb(new Error("Invalid file extension."));
    return;
  }
  cb(null, true);
};

const documentUpload = multer({
  storage: memoryStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
});

export const uploadSingle = upload.single("image");
export const uploadMultiple = upload.array("images", 20);
export const uploadDocuments = documentUpload.array("documents", 5);
