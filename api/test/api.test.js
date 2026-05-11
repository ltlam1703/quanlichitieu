const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

// Chờ server khởi động
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

// Khởi động server trước khi test
let server;
before(async () => {
  process.env.MONGO_URI = process.env.MONGO_URI ||
    'mongodb://admin:secret123@localhost:27017/expense_tracker_test?authSource=admin';
  process.env.PORT = process.env.PORT || '3000';

  // Import server (index.js export app)
  server = require('../index.js');
  await wait(1500); // chờ kết nối mongo
});

after(() => {
  if (server && server.close) server.close();
  process.exit(0);
});

describe('Health Check', () => {
  test('GET /health trả về ok', async () => {
    const { status, data } = await req('GET', '/health');
    assert.strictEqual(status, 200);
    assert.strictEqual(data.status, 'ok');
  });
});

describe('Transactions API', () => {
  let createdId;

  test('GET /api/transactions trả về mảng', async () => {
    const { status, data } = await req('GET', '/api/transactions?all=true');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data));
  });

  test('POST /api/transactions tạo giao dịch mới', async () => {
    const { status, data } = await req('POST', '/api/transactions', {
      description: 'Test ăn trưa',
      amount: 50000,
      category: 'Ăn uống',
      type: 'expense',
      tx_date: '2025-05-11',
    });
    assert.strictEqual(status, 201);
    assert.ok(data._id);
    assert.strictEqual(data.description, 'Test ăn trưa');
    assert.strictEqual(data.amount, 50000);
    createdId = data._id;
  });

  test('POST /api/transactions thiếu field bắt buộc → 400', async () => {
    const { status } = await req('POST', '/api/transactions', {
      amount: 10000,
    });
    assert.strictEqual(status, 400);
  });

  test('DELETE /api/transactions/:id xóa thành công', async () => {
    const { status, data } = await req('DELETE', `/api/transactions/${createdId}`);
    assert.strictEqual(status, 200);
    assert.ok(data.message);
  });
});
