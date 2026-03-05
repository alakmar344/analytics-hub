'use strict';

const express = require('express');
const router  = express.Router();
const Event   = require('../models/Event');

/* ---------------------------------------------------------------
 * Helper: parse ?from and ?to query params into Date objects.
 * Defaults to the last 7 days if not supplied.
 * --------------------------------------------------------------- */
function parseDateRange(query) {
  const now = new Date();
  const to   = query.to   ? new Date(query.to)   : now;
  const from = query.from ? new Date(query.from)  : new Date(now - 7 * 24 * 60 * 60 * 1000);
  return { from, to };
}

/* ---------------------------------------------------------------
 * GET /api/stats
 * Returns top-level summary stats.
 * --------------------------------------------------------------- */
router.get('/stats', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const match = { timestamp: { $gte: from, $lte: to } };

    const [totalEvents, uniqueVisitors, eventBreakdown, topPages, eventsOverTime] =
      await Promise.all([
        // Total event count
        Event.countDocuments(match),

        // Unique visitors (distinct hashed IPs)
        Event.distinct('hashedIp', match).then((a) => a.length),

        // Events grouped by type
        Event.aggregate([
          { $match: match },
          { $group: { _id: '$event', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),

        // Top 10 pages by event count
        Event.aggregate([
          { $match: match },
          { $group: { _id: '$page', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),

        // Events per day for the selected range
        Event.aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    return res.json({
      from,
      to,
      totalEvents,
      uniqueVisitors,
      eventBreakdown,
      topPages,
      eventsOverTime,
    });
  } catch (err) {
    console.error('[STATS ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ---------------------------------------------------------------
 * GET /api/events
 * Returns recent raw events (paginated).
 * Query params: page (default 1), limit (default 50), event, from, to
 * --------------------------------------------------------------- */
router.get('/events', async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const filter = { timestamp: { $gte: from, $lte: to } };
    if (req.query.event) filter.event = req.query.event;

    const [events, total] = await Promise.all([
      Event.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      Event.countDocuments(filter),
    ]);

    return res.json({ page, limit, total, events });
  } catch (err) {
    console.error('[EVENTS ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
