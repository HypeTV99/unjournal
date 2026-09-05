import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);

/**
 * POST /api/location/geocode
 * Standout Feature: Reverse geocode GPS coordinate to City & Country for Epiphany Maps
 */
router.post('/geocode', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and Longitude are required' });
    }

    // Call OpenStreetMap Nominatim reverse geocoding
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'UnJournal-App-GCP-Hackathon/1.0'
      }
    });

    if (!response.ok) {
      return res.json({
        success: true,
        data: {
          latitude,
          longitude,
          city: 'Ambient Location',
          country: 'Local Horizon'
        }
      });
    }

    const data = await response.json();
    const city = data.address?.city || data.address?.town || data.address?.suburb || data.address?.county || 'Current Location';
    const country = data.address?.country || 'Earth';

    return res.json({
      success: true,
      data: {
        latitude,
        longitude,
        city,
        country,
        formattedAddress: data.display_name
      }
    });

  } catch (err) {
    console.error('[Route /api/location/geocode] Error:', err);
    return res.json({
      success: true,
      data: {
        latitude: req.body.latitude || 0,
        longitude: req.body.longitude || 0,
        city: 'Ambient Coordinates',
        country: 'Secure Node'
      }
    });
  }
});

export default router;
