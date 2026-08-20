import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'links.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to read/write persistent storage
const readLinks = () => {
  try {
    if (!fs.existsSync(DB_FILE)) return [];
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error reading links file:', err.message);
    return [];
  }
};

const saveLinks = (links) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(links, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing links file:', err.message);
  }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (for EC2 / ALB / Docker healthcheck)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    host: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
  });
});

// System stats endpoint
app.get('/api/stats', (req, res) => {
  const links = readLinks();
  const totalClicks = links.reduce((sum, link) => sum + (link.clicks || 0), 0);

  res.json({
    totalLinks: links.length,
    totalClicks,
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(os.totalmem() / 1024 / 1024)}MB`
  });
});

// Get all links
app.get('/api/links', (req, res) => {
  const links = readLinks();
  // Sort descending by creation date
  links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(links);
});

// Create shortened link & QR Code
app.post('/api/shorten', async (req, res) => {
  try {
    let { originalUrl, customCode, title } = req.body;

    if (!originalUrl) {
      return res.status(400).json({ error: 'Original URL is required.' });
    }

    // Ensure URL has protocol
    if (!/^https?:\/\//i.test(originalUrl)) {
      originalUrl = 'https://' + originalUrl;
    }

    // Validate URL format
    try {
      new URL(originalUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL provided.' });
    }

    const links = readLinks();
    let code = customCode ? customCode.trim() : '';

    if (code) {
      // Validate custom code format (alphanumeric and hyphens only)
      if (!/^[a-zA-Z0-9-_]{3,20}$/.test(code)) {
        return res.status(400).json({
          error: 'Custom code must be 3-20 characters long and contain only letters, numbers, hyphens, and underscores.'
        });
      }

      // Check for conflict with reserved paths or existing code
      const reserved = ['api', 'health', 'public', 'static', 'assets', 'favicon.ico'];
      if (reserved.includes(code.toLowerCase()) || links.some(l => l.code.toLowerCase() === code.toLowerCase())) {
        return res.status(409).json({ error: `Short code "${code}" is already taken or reserved.` });
      }
    } else {
      // Generate 6-char random code
      let isUnique = false;
      while (!isUnique) {
        code = crypto.randomBytes(4).toString('base64url').slice(0, 6);
        if (!links.some(l => l.code === code)) {
          isUnique = true;
        }
      }
    }

    // Determine host origin for full short URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const shortUrl = `${protocol}://${host}/${code}`;

    // Generate high quality QR code data URL
    const qrCode = await QRCode.toDataURL(shortUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    const newLink = {
      id: crypto.randomUUID(),
      title: title ? title.trim() : new URL(originalUrl).hostname,
      originalUrl,
      code,
      shortUrl,
      qrCode,
      clicks: 0,
      createdAt: new Date().toISOString(),
      lastAccessedAt: null
    };

    links.push(newLink);
    saveLinks(links);

    res.status(201).json(newLink);
  } catch (err) {
    console.error('Error creating short link:', err);
    res.status(500).json({ error: 'Internal Server Error. Please try again.' });
  }
});

// Delete a link
app.delete('/api/links/:id', (req, res) => {
  const { id } = req.params;
  const links = readLinks();
  const filtered = links.filter(l => l.id !== id);

  if (links.length === filtered.length) {
    return res.status(404).json({ error: 'Link not found.' });
  }

  saveLinks(filtered);
  res.json({ message: 'Link deleted successfully.' });
});

// Redirection handler (keep at the bottom before static fallback)
app.get('/:code', (req, res, next) => {
  const { code } = req.params;

  // Don't intercept API or static files
  if (code.startsWith('api') || code === 'health' || code.includes('.')) {
    return next();
  }

  const links = readLinks();
  const linkIndex = links.findIndex(l => l.code.toLowerCase() === code.toLowerCase());

  if (linkIndex !== -1) {
    // Increment clicks and record timestamp
    links[linkIndex].clicks = (links[linkIndex].clicks || 0) + 1;
    links[linkIndex].lastAccessedAt = new Date().toISOString();
    saveLinks(links);

    return res.redirect(302, links[linkIndex].originalUrl);
  }

  // Not found - show friendly 404 page
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - Link Not Found</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #090d16;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          text-align: center;
        }
        .card {
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 2.5rem;
          border-radius: 1rem;
          max-width: 420px;
          backdrop-filter: blur(12px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }
        h1 { color: #f43f5e; font-size: 3rem; margin: 0 0 0.5rem 0; }
        p { color: #94a3b8; line-height: 1.5; margin-bottom: 1.5rem; }
        a {
          display: inline-block;
          background: linear-gradient(135deg, #6366f1, #3b82f6);
          color: white;
          padding: 0.75rem 1.5rem;
          text-decoration: none;
          border-radius: 0.5rem;
          font-weight: 600;
          transition: transform 0.2s, opacity 0.2s;
        }
        a:hover { opacity: 0.9; transform: translateY(-2px); }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>404</h1>
        <h2>Short Link Not Found</h2>
        <p>The link <code>/${code}</code> doesn't exist or has expired.</p>
        <a href="/">Create a New Link</a>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 URL Shortener & QR Service running on http://0.0.0.0:${PORT}`);
  console.log(`📂 Data directory: ${DATA_DIR}`);
});
