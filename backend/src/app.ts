import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Load environmental variables
dotenv.config();

// Router imports
import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaigns';
import donationRoutes from './routes/donations';
import complianceRoutes from './routes/compliance';
import aiRoutes from './routes/ai';
import superadminRoutes from './routes/superadmin';
import externalRoutes from './routes/external';
import templatesRoutes from './routes/templates';

const app = express();

import path from 'path';

// Standard Middlewares - allow cross-origin requests from external NGO landing pages
app.use(cors({
  origin: true, // Allow external NGO domain origins (e.g. http://localhost:8000)
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-danapro-api-key', 'x-wegive-api-key']
}));
app.use(cookieParser());
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Serve generated compliance receipt PDFs statically
app.use('/receipts', express.static(path.join(__dirname, '../receipts')));

// Base health check & root landing handler
app.get(['/', '/health', '/api/health'], (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'WeGive Core Backend API Engine',
    message: 'API Server is live and operational',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      campaigns: '/api/campaigns',
      donations: '/api/donations',
      superadmin: '/api/superadmin',
      external: '/api/v1/external'
    }
  });
});

// Mounted Routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/v1/external', externalRoutes);
app.use('/api/webhooks/razorpay', externalRoutes);

// 404 Handler for undefined API routes
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

// Global Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error encountered:', err.stack || err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
  });
});

export default app;
