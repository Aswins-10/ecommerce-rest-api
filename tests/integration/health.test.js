'use strict';

const request = require('supertest');
const app     = require('../../app');

describe('Health & 404 Integration Tests', () => {
  it('GET /health should return 200 and server running status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Server is running');
  });

  it('GET /api/v1/nonexistent-route should return 404 with normalized error envelope', async () => {
    const res = await request(app).get('/api/v1/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toBe('fail');
    expect(res.body.message).toMatch(/Cannot find endpoint/i);
  });
});
