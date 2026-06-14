import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

const uploadQuerySchema = z.object({
  planId: z.string().min(1, 'planId is required'),
});

// POST /api/upload/syllabus
router.post(
  '/syllabus',
  authMiddleware,
  upload.single('syllabus'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = uploadQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      const { planId } = parsed.data;
      const userId = req.user!.userId;

      // Verify plan ownership
      const plan = await prisma.plan.findFirst({ where: { id: planId, userId } });
      if (!plan) {
        res.status(404).json({ success: false, error: 'Plan not found' });
        return;
      }

      // MVP: Store file reference and stub the embedding pipeline
      // In production: use LlamaIndex to chunk PDF and store embeddings in pgvector
      console.log(`[RAG STUB] Would chunk and embed: ${req.file.path} for plan ${planId}`);

      // Create a stub SyllabusChunk to indicate file was received
      await prisma.syllabusChunk.create({
        data: {
          userId,
          planId,
          content: `[PDF uploaded: ${req.file.originalname}] — embedding pipeline stub`,
        },
      });

      res.json({
        success: true,
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          message: 'Syllabus uploaded. It will be processed and used to personalise your plan.',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
