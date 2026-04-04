import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/qa/product/:productId — Get all questions + answers for a product
router.get("/product/:productId", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { page = "1", limit = "10" } = req.query;

    const take = Math.min(parseInt(limit as string) || 10, 50);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const [questions, total] = await Promise.all([
      prisma.productQuestion.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          user: { select: { name: true } },
          answers: {
            orderBy: { createdAt: "asc" },
            include: {
              user: { select: { name: true } },
            },
          },
        },
      }),
      prisma.productQuestion.count({ where: { productId } }),
    ]);

    return res.json({
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        author: q.user.name || "Anonymous",
        createdAt: q.createdAt,
        answers: q.answers.map((a) => ({
          id: a.id,
          answer: a.answer,
          author: a.user.name || "Anonymous",
          isOfficial: a.isOfficial,
          createdAt: a.createdAt,
        })),
      })),
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Get product Q&A error:", error);
    return res.status(500).json({ error: "Failed to fetch Q&A" });
  }
});

// POST /api/qa/questions — Ask a question (auth required)
router.post(
  "/questions",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        productId: z.string(),
        question: z.string().min(1).max(2000),
      });

      const body = schema.parse(req.body);

      const product = await prisma.product.findUnique({
        where: { id: body.productId },
      });
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const question = await prisma.productQuestion.create({
        data: {
          productId: body.productId,
          userId: req.user!.id,
          question: body.question,
        },
      });

      return res
        .status(201)
        .json({ message: "Question submitted", id: question.id });
    } catch (error) {
      console.error("Create question error:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      return res.status(500).json({ error: "Failed to submit question" });
    }
  }
);

// POST /api/qa/answers — Answer a question (auth required)
router.post(
  "/answers",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        questionId: z.string(),
        answer: z.string().min(1).max(2000),
      });

      const body = schema.parse(req.body);

      const question = await prisma.productQuestion.findUnique({
        where: { id: body.questionId },
      });
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      const isAdmin =
        req.user!.role === "ADMIN" || req.user!.role === "MANAGER";

      const answer = await prisma.productAnswer.create({
        data: {
          questionId: body.questionId,
          userId: req.user!.id,
          answer: body.answer,
          isOfficial: isAdmin,
        },
      });

      return res
        .status(201)
        .json({ message: "Answer submitted", id: answer.id });
    } catch (error) {
      console.error("Create answer error:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      return res.status(500).json({ error: "Failed to submit answer" });
    }
  }
);

// DELETE /api/qa/questions/:id — Delete own question or admin delete
router.delete(
  "/questions/:id",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const question = await prisma.productQuestion.findUnique({
        where: { id },
      });
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      if (
        question.userId !== req.user!.id &&
        req.user!.role !== "ADMIN" &&
        req.user!.role !== "MANAGER"
      ) {
        return res.status(403).json({ error: "Not authorized" });
      }

      await prisma.productQuestion.delete({ where: { id } });

      return res.json({ message: "Question deleted" });
    } catch (error) {
      console.error("Delete question error:", error);
      return res.status(500).json({ error: "Failed to delete question" });
    }
  }
);

export default router;
