const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── Kết nối MongoDB ──────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });

// ── Schema / Model ───────────────────────────────────────────
const txSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  amount:      { type: Number, required: true, min: 1 },
  category:    { type: String, default: 'Khác' },
  type:        { type: String, enum: ['expense', 'income'], required: true },
  tx_date:     { type: Date, default: Date.now },
  created_at:  { type: Date, default: Date.now },
});

const Transaction = mongoose.model('Transaction', txSchema);

// ── Routes ───────────────────────────────────────────────────

// GET /api/transactions
// params: type, category, all, date, week, month, year
app.get('/api/transactions', async (req, res) => {
  try {
    const { type, category, date, week, month, year, all } = req.query;
    const filter = {};
    if (type)     filter.type = type;
    if (category) filter.category = category;

    if (all !== 'true') {
      if (date) {
        // Lọc 1 ngày cụ thể
        const d = new Date(date);
        filter.tx_date = {
          $gte: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
          $lt:  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)),
        };
      } else if (week) {
        // week = YYYY-MM-DD, tính thứ 2 -> chủ nhật của tuần đó
        const d = new Date(week);
        const day = d.getDay();
        const diffToMon = (day === 0 ? -6 : 1 - day);
        const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon);
        const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
        filter.tx_date = { $gte: mon, $lt: sun };
      } else if (month && year) {
        const y = parseInt(year), m = parseInt(month);
        filter.tx_date = {
          $gte: new Date(Date.UTC(y, m - 1, 1)),
          $lt:  new Date(Date.UTC(y, m, 1)),
        };
      } else if (year) {
        const y = parseInt(year);
        filter.tx_date = {
          $gte: new Date(Date.UTC(y, 0, 1)),
          $lt:  new Date(Date.UTC(y + 1, 0, 1)),
        };
      } else if (month) {
        const y = new Date().getFullYear(), m = parseInt(month);
        filter.tx_date = {
          $gte: new Date(Date.UTC(y, m - 1, 1)),
          $lt:  new Date(Date.UTC(y, m, 1)),
        };
      }
    }  // ← đóng if(all !== 'true') đúng chỗ

    const txs = await Transaction.find(filter).sort({ tx_date: -1, created_at: -1 });
    res.json(txs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/transactions/summary
app.get('/api/transactions/summary', async (req, res) => {
  try {
    const result = await Transaction.aggregate([
      {
        $group: {
          _id: {
            year:  { $year: '$tx_date' },
            month: { $month: '$tx_date' },
            type:  '$type',
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
    ]);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/transactions
app.post('/api/transactions', async (req, res) => {
  try {
    const tx = await Transaction.create(req.body);
    res.status(201).json(tx);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/transactions/:id
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/transactions/:id
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const tx = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(tx);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('================================');
  console.log('[INFO] API running on port ' + PORT);
  console.log('[INFO] Frontend: http://localhost:' + process.env.FRONTEND_PORT);
  console.log('[INFO] API:      http://localhost:' + PORT + '/api/transactions');
  console.log('[INFO] Health:   http://localhost:' + PORT + '/health');
  console.log('================================');
});