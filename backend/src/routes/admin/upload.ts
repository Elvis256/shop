import { Router, Response } from "express";
import { AuthRequest, authenticate, requireAdmin } from "../../middleware/auth";
import { uploadSingle, validateUploadedFiles } from "../../middleware/upload";

const router = Router();
router.use(authenticate, requireAdmin);

// POST /api/admin/upload — standalone image upload for rich text editor
router.post("/", uploadSingle, validateUploadedFiles, async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file as Express.Multer.File;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    return res.status(201).json({ url: `/uploads/${file.filename}` });
  } catch (error) {
    console.error("Admin upload error:", error);
    return res.status(500).json({ error: "Failed to upload file" });
  }
});

export default router;
