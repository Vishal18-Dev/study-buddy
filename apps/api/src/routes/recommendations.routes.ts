import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth.middleware';
import { generateRecommendationsForTopic } from '../services/llm.service';

const router = Router();

const rateSchema = z.object({
  rating: z.enum(['1', '-1'])
});

// GET /api/recommendations/video/search
router.get('/video/search', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.query as string;
    if (!query) {
      res.status(400).json({ success: false, error: 'Query parameter is required' });
      return;
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();

    let videos: { videoId: string; title: string; duration: string }[] = [];

    try {
      const startToken = 'var ytInitialData = ';
      const endToken = ';</script>';
      const startIndex = html.indexOf(startToken);
      if (startIndex !== -1) {
        const jsonStart = startIndex + startToken.length;
        const endIndex = html.indexOf(endToken, jsonStart);
        if (endIndex !== -1) {
          const jsonStr = html.substring(jsonStart, endIndex);
          const data = JSON.parse(jsonStr);
          const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
          if (contents && Array.isArray(contents)) {
            for (const section of contents) {
              const itemSection = section.itemSectionRenderer;
              if (itemSection?.contents && Array.isArray(itemSection.contents)) {
                for (const item of itemSection.contents) {
                  if (item.videoRenderer) {
                    const v = item.videoRenderer;
                    const videoId = v.videoId;
                    const title = v.title?.runs?.[0]?.text || 'Video Tutorial';
                    const lengthText = v.lengthText?.simpleText || 'Video';
                    if (videoId) {
                      videos.push({ videoId, title, duration: lengthText });
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[YouTube Search] JSON parse failed, falling back to regex:', err);
    }

    if (videos.length === 0) {
      const matches = [...html.matchAll(/"videoId"\s*:\s*"([^"]+)"/g)];
      const uniqueIds = [...new Set(matches.map(m => m[1]))];
      videos = uniqueIds.map((id, index) => ({
        videoId: id,
        title: `Video Tutorial ${index + 1}`,
        duration: 'Video'
      }));
    }

    res.json({ success: true, data: videos.slice(0, 5) });
  } catch (err) {
    next(err);
  }
});

// GET /api/recommendations/:topicId
router.get('/:topicId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topicId = req.params.topicId;

    // Verify topic belongs to user
    const topic = await prisma.topic.findFirst({
      where: { id: topicId },
      include: {
        planDay: {
          include: {
            plan: true
          }
        }
      }
    });

    if (!topic || topic.planDay.plan.userId !== req.user!.userId) {
      res.status(404).json({ success: false, error: 'Topic not found' });
      return;
    }

    // Check if recommendations already exist
    let recs = await prisma.topicRecommendation.findMany({
      where: { topicId },
      orderBy: { rating: 'desc' }
    });

    // If none exist, generate via LLM/mock and store them
    if (recs.length === 0) {
      const suggested = await generateRecommendationsForTopic(
        topic.title,
        topic.planDay.plan.subject
      );

      // Save to database
      await prisma.topicRecommendation.createMany({
        data: suggested.map((r) => ({
          topicId,
          title: r.title,
          url: r.url,
          isPaid: r.isPaid,
          platform: r.platform
        }))
      });

      recs = await prisma.topicRecommendation.findMany({
        where: { topicId },
        orderBy: { rating: 'desc' }
      });
    }

    res.json({ success: true, data: recs });
  } catch (err) {
    next(err);
  }
});

// POST /api/recommendations/:recId/rate
router.post('/:recId/rate', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = rateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const recId = req.params.recId;
    const rateDiff = parseInt(parsed.data.rating, 10);

    const rec = await prisma.topicRecommendation.findUnique({
      where: { id: recId },
      include: {
        topic: {
          include: {
            planDay: {
              include: {
                plan: true
              }
            }
          }
        }
      }
    });

    if (!rec || rec.topic.planDay.plan.userId !== req.user!.userId) {
      res.status(404).json({ success: false, error: 'Recommendation not found' });
      return;
    }

    const updated = await prisma.topicRecommendation.update({
      where: { id: recId },
      data: {
        rating: {
          increment: rateDiff
        }
      }
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
