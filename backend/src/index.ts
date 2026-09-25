import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import roomRoutes from './routes/room.routes';
import messRoutes from './routes/mess.routes';
import outingRoutes from './routes/outing.routes';
import leaveRoutes from './routes/leave.routes';
import notificationRoutes from './routes/notification.routes';
import managementRoutes from './routes/management.routes';
import hostelApplicationRoutes from './routes/hostel-application.routes';
import biometricRoutes, { testBiometricRouter } from './routes/biometric.routes';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const isOriginAllowed = (origin: string): boolean => {
  if (allowedOrigins.includes(origin)) return true;
  // Allow localhost / 127.0.0.1 on any port in development
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  // Allow local LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x) on any port
  if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin)) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// Safe request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Root landing - redirect to frontend web application
app.get('/', (req, res) => {
  res.redirect(process.env.CORS_ORIGIN || 'http://localhost:5173');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'HMS Student Hostel Backend API',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', dashboardRoutes);
app.use('/api/student', roomRoutes);
app.use('/api/student', messRoutes);
app.use('/api/student', outingRoutes);
app.use('/api/student', leaveRoutes);
app.use('/api/student', notificationRoutes);
app.use('/api/student', biometricRoutes);
app.use('/api', testBiometricRouter);
app.use('/api/student/hostel-application', hostelApplicationRoutes);
app.use('/api/management', managementRoutes);

// Fallback 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found',
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err?.message || err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const server = app.listen(config.port, () => {
  console.log(`HMS Backend Server running on port ${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/api/health`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[HMS Backend] Port ${config.port} is already in use by another process.`);
    process.exit(1);
  } else {
    console.error('[HMS Backend] Server error:', err);
  }
});

// Track and cleanly destroy active sockets on shutdown (e.g. during tsx watch reload)
const activeSockets = new Set<import('net').Socket>();
server.on('connection', (socket) => {
  activeSockets.add(socket);
  socket.on('close', () => activeSockets.delete(socket));
});

const gracefulShutdown = () => {
  server.close();
  for (const socket of activeSockets) {
    socket.destroy();
  }
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export { app, server };

