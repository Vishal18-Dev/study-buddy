import 'dotenv/config';
console.log("[SERVER STARTUP] Active NODE_ENV:", process.env.NODE_ENV);
import './lib/env'; // Validate env vars immediately
import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { errorMiddleware } from './middleware/error.middleware';
import { startStreakCron } from './services/streak.service';

// Routes
import authRoutes from './routes/auth.routes';
import plansRoutes from './routes/plans.routes';
import checkInRoutes from './routes/checkin.routes';
import topicsRoutes from './routes/topics.routes';
import quizRoutes from './routes/quiz.routes';
import streaksRoutes from './routes/streaks.routes';
import uploadRoutes from './routes/upload.routes';
import dashboardRoutes from './routes/dashboard.routes';
import chatRoutes from './routes/chat.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import recommendationsRoutes from './routes/recommendations.routes';
import classroomRoutes from './routes/classroom.routes';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Rate Limiters ─────────────────────────────
// E2E test bypass: requests carrying the correct x-e2e-secret header skip rate limiting
const e2eSecret = process.env.E2E_API_SECRET;
const e2eSkip = (req: express.Request) =>
  !!(e2eSecret && req.headers['x-e2e-secret'] === e2eSecret);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 10000, // Limit each IP to 200 requests per 15 minutes
  message: { success: false, error: 'Too many requests from this IP, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: e2eSkip,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 100000 : (process.env.NODE_ENV === 'production' ? 30 : 10000),
  message: { success: false, error: 'Too many requests. Please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: e2eSkip,
});

// ── Security Middleware ─────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow Next.js page to render static /uploads if needed
}));

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [
      process.env.NEXTAUTH_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    const isAllowed = allowedOrigins.some((allowed) => allowed === origin || allowed === '*');
    const isVercel = origin.endsWith('.vercel.app') || origin.includes('vercel.app');
    
    if (isAllowed || isVercel) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

app.use(generalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically (MVP — replace with S3 URLs in production)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Health check ───────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ── API Routes ─────────────────────────────────
app.use('/api/auth', strictLimiter, authRoutes);
app.use('/api/plans', strictLimiter, plansRoutes);
app.use('/api/checkin', checkInRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/streaks', streaksRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/classrooms', classroomRoutes);

// ── 404 handler ────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Central error handler ──────────────────────
app.use(errorMiddleware);

// ── Start server ───────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Unslump API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);

  // Start background cron jobs
  startStreakCron();
});

export default app;
