'use strict';

const express = require('express');
const router  = express.Router();
const Event   = require('../models/Event');
const hashIp  = require('../middleware/hashIp');

/**
 * POST /track
 *
 * Receives an analytics event from the client.
 *
 * Expected JSON body:
 * {
 *   "event"    : "pageview",          // required
 *   "page"     : "/home",             // required
 *   "referrer" : "https://google.com",// optional
 *   "meta"     : { "key": "value" }   // optional
 * }
 *
 * The user's IP is hashed server-side – the raw IP is never stored.
 */
router.post('/', hashIp, async (req, res) => {
  try {
    const { event, page, referrer = '', meta = {} } = req.body;

    if (!event || typeof event !== 'string') {
      return res.status(400).json({ error: 'Field "event" is required and must be a string.' });
    }
    if (!page || typeof page !== 'string') {
      return res.status(400).json({ error: 'Field "page" is required and must be a string.' });
    }

    const doc = await Event.create({
      hashedIp:  req.hashedIp,
      event:     event.trim(),
      page:      page.trim(),
      referrer:  typeof referrer === 'string' ? referrer.trim() : '',
      userAgent: req.headers['user-agent'] || '',
      meta,
    });

    console.log(`[TRACK] ${doc.event} | ${doc.page} | ip-hash: ${doc.hashedIp.slice(0, 8)}…`);

    return res.status(201).json({ ok: true, id: doc._id });
  } catch (err) {
    console.error('[TRACK ERROR]', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
