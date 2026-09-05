import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * POST /api/upload
 * Fallback route for photo storage when client cannot directly reach Firebase Storage
 */
router.post('/upload', async (req, res) => {
  try {
    const { imageBase64, filename = 'photo.jpg' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Strip metadata prefix if present (e.g. data:image/png;base64,)
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    let ext = '.jpg';

    if (matches && matches.length === 3) {
      const mime = matches[1];
      ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(imageBase64, 'base64');
    }

    // Safety check: cap upload at 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image exceeds 10MB limit' });
    }

    const safeName = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(uploadsDir, safeName);

    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${safeName}`;
    res.json({
      success: true,
      url: publicUrl,
      sizeBytes: buffer.length
    });
  } catch (err) {
    console.error('[UploadRoutes] Error:', err);
    res.status(500).json({ error: 'Failed to upload photo', message: err.message });
  }
});

export default router;
