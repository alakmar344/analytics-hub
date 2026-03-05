'use strict';

/**
 * Integration tests for POST /track and GET /api/stats, /api/events.
 *
 * Uses an in-memory MongoDB via jest mocking so no real database is needed.
 */

process.env.IP_HASH_SECRET = 'test_secret';
process.env.MONGO_URI      = 'mongodb://localhost:27017/test';  // overridden by mock

const mongoose = require('mongoose');

// ── Mock Mongoose so we never need a real MongoDB ─────────────
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');

  // Minimal in-memory store
  const store = [];

  const mockModel = {
    create: jest.fn(async (doc) => {
      const saved = { ...doc, _id: `id_${store.length}`, timestamp: new Date() };
      store.push(saved);
      return saved;
    }),
    countDocuments: jest.fn(async () => store.length),
    distinct: jest.fn(async () => [...new Set(store.map((d) => d.hashedIp))]),
    aggregate: jest.fn(async () => []),
    find: jest.fn(() => ({
      sort:  function() { return this; },
      skip:  function() { return this; },
      limit: function() { return this; },
      lean:  jest.fn(async () => store.slice().reverse()),
    })),
    _store: store,
  };

  return {
    ...actual,
    connect: jest.fn(async () => {}),
    connection: { host: 'mock' },
    model: jest.fn(() => mockModel),
    Schema: actual.Schema,
  };
});

const request = require('supertest');
const app     = require('../server/index');

// ── POST /track ───────────────────────────────────────────────
describe('POST /track', () => {
  it('returns 201 and ok:true for valid payload', async () => {
    const res = await request(app)
      .post('/track')
      .set('Content-Type', 'application/json')
      .send({ event: 'pageview', page: '/home' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 when event field is missing', async () => {
    const res = await request(app)
      .post('/track')
      .send({ page: '/home' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/event/i);
  });

  it('returns 400 when page field is missing', async () => {
    const res = await request(app)
      .post('/track')
      .send({ event: 'click' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/page/i);
  });

  it('accepts optional referrer and meta fields', async () => {
    const res = await request(app)
      .post('/track')
      .send({ event: 'click', page: '/about', referrer: 'https://google.com', meta: { btn: 'cta' } });
    expect(res.status).toBe(201);
  });
});

// ── GET /api/stats ────────────────────────────────────────────
describe('GET /api/stats', () => {
  it('returns stats object with expected keys', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalEvents');
    expect(res.body).toHaveProperty('uniqueVisitors');
    expect(res.body).toHaveProperty('eventBreakdown');
    expect(res.body).toHaveProperty('topPages');
    expect(res.body).toHaveProperty('eventsOverTime');
  });

  it('accepts custom from/to query params', async () => {
    const res = await request(app)
      .get('/api/stats?from=2024-01-01&to=2024-12-31');
    expect(res.status).toBe(200);
    expect(new Date(res.body.from).getFullYear()).toBe(2024);
  });
});

// ── GET /api/events ───────────────────────────────────────────
describe('GET /api/events', () => {
  it('returns paginated events object', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('events');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    expect(Array.isArray(res.body.events)).toBe(true);
  });
});

afterAll(() => {
  if (typeof mongoose.connection.close === 'function') {
    return mongoose.connection.close();
  }
});
