const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── In-memory data store ──────────────────────────────────────────────────────
let readings = [];

// ─── Anomaly Detection Engine ──────────────────────────────────────────────────
/**
 * Rule-based anomaly detection without any external hardware or ML libraries.
 * Rules applied:
 *  R1 – Spike Rule:      value > mean + 2×stdDev
 *  R2 – Drop Rule:       value < mean - 2×stdDev  (sudden drops can indicate outages or meter errors)
 *  R3 – Night Surge:     hour 22–06 and value > 1.5× daily mean
 *  R4 – Weekend Spike:   weekend day and value > 1.8× weekday mean
 *  R5 – Zero Reading:    reading of 0 (possible meter fault)
 *  R6 – Consecutive High: 3+ readings in a row above mean + 1×stdDev
 */
function detectAnomalies(data) {
  if (data.length < 2) return data.map(r => ({ ...r, anomaly: false, reasons: [] }));

  const values = data.map(d => d.kwh);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Compute weekday mean (Mon–Fri)
  const weekdayValues = data
    .filter(d => { const day = new Date(d.timestamp).getDay(); return day >= 1 && day <= 5; })
    .map(d => d.kwh);
  const weekdayMean = weekdayValues.length
    ? weekdayValues.reduce((a, b) => a + b, 0) / weekdayValues.length
    : mean;

  return data.map((reading, idx) => {
    const reasons = [];
    const dt = new Date(reading.timestamp);
    const hour = dt.getHours();
    const dayOfWeek = dt.getDay(); // 0=Sun, 6=Sat

    // R1 – Spike
    if (reading.kwh > mean + 2 * stdDev) {
      reasons.push({ rule: 'R1', label: 'Unusual Spike', detail: `${reading.kwh} kWh is far above average (${mean.toFixed(2)} kWh)` });
    }

    // R2 – Drop
    if (stdDev > 0 && reading.kwh < mean - 2 * stdDev) {
      reasons.push({ rule: 'R2', label: 'Unusual Drop', detail: `${reading.kwh} kWh is far below average — possible meter fault` });
    }

    // R3 – Night Surge (10pm–6am)
    if ((hour >= 22 || hour < 6) && reading.kwh > mean * 1.5) {
      reasons.push({ rule: 'R3', label: 'Night Surge', detail: `High usage (${reading.kwh} kWh) during off-peak hours (${hour}:00)` });
    }

    // R4 – Weekend Spike
    if ((dayOfWeek === 0 || dayOfWeek === 6) && reading.kwh > weekdayMean * 1.8) {
      reasons.push({ rule: 'R4', label: 'Weekend Spike', detail: `Weekend usage ${reading.kwh} kWh exceeds weekday norm (${weekdayMean.toFixed(2)} kWh)` });
    }

    // R5 – Zero Reading
    if (reading.kwh === 0) {
      reasons.push({ rule: 'R5', label: 'Zero Reading', detail: 'Zero kWh detected — possible meter fault or power outage' });
    }

    // R6 – Consecutive High (sliding window of 3)
    if (idx >= 2) {
      const prev2 = [data[idx - 2].kwh, data[idx - 1].kwh, reading.kwh];
      if (prev2.every(v => v > mean + stdDev)) {
        reasons.push({ rule: 'R6', label: 'Sustained High Usage', detail: '3+ consecutive readings above elevated threshold' });
      }
    }

    return {
      ...reading,
      anomaly: reasons.length > 0,
      severity: reasons.length >= 2 ? 'high' : reasons.length === 1 ? 'medium' : 'none',
      reasons,
      mean: parseFloat(mean.toFixed(3)),
      stdDev: parseFloat(stdDev.toFixed(3))
    };
  });
}

// ─── Bill Estimation ────────────────────────────────────────────────────────────
/**
 * Slab-based tariff similar to common utility billing:
 * 0–100 kWh  → ₹3.50/kWh
 * 101–300    → ₹5.00/kWh
 * 301–500    → ₹6.50/kWh
 * 500+       → ₹8.00/kWh
 * Fixed charge: ₹50/month
 */
function estimateBill(totalKwh) {
  const fixedCharge = 50;
  let bill = fixedCharge;
  let remaining = totalKwh;

  const slabs = [
    { limit: 100, rate: 3.5 },
    { limit: 200, rate: 5.0 },
    { limit: 200, rate: 6.5 },
    { limit: Infinity, rate: 8.0 }
  ];

  for (const slab of slabs) {
    if (remaining <= 0) break;
    const units = Math.min(remaining, slab.limit);
    bill += units * slab.rate;
    remaining -= units;
  }

  return parseFloat(bill.toFixed(2));
}

// ─── Suggestion Engine ──────────────────────────────────────────────────────────
function generateSuggestions(annotated) {
  const suggestions = new Set();

  annotated.forEach(r => {
    r.reasons?.forEach(reason => {
      switch (reason.rule) {
        case 'R1':
          suggestions.add('💡 Investigate appliances that may have been left running during the spike period.');
          suggestions.add('🌡️ Check if HVAC or water heater settings caused sudden high usage.');
          break;
        case 'R2':
          suggestions.add('🔧 Verify meter accuracy — unexpected drops may indicate a recording error.');
          break;
        case 'R3':
          suggestions.add('🌙 Schedule high-energy appliances (washer, dishwasher) to run during off-peak hours to lower bills.');
          suggestions.add('💤 Install smart plugs to auto-cut phantom loads overnight.');
          break;
        case 'R4':
          suggestions.add('📅 Distribute energy-heavy chores across weekdays to avoid weekend spikes.');
          suggestions.add('☀️ Consider running high-energy appliances during daylight hours if you have solar.');
          break;
        case 'R5':
          suggestions.add('📞 Contact your utility provider to confirm the zero reading and check for outages.');
          break;
        case 'R6':
          suggestions.add('🔥 Extended high usage detected — check if any appliance is stuck on (e.g. old fridge, pool pump).');
          suggestions.add('🪟 Improve home insulation to reduce HVAC run-time and sustained energy draw.');
          break;
      }
    });
  });

  // General suggestions always shown
  suggestions.add('📊 Track usage weekly to spot trends before they inflate your bill.');
  suggestions.add('💧 Water heaters account for ~18% of home energy — lower thermostat to 120°F (49°C).');

  return [...suggestions];
}

// ─── Grouping helpers ───────────────────────────────────────────────────────────
function groupByWeek(data) {
  const weeks = {};
  data.forEach(r => {
    const d = new Date(r.timestamp);
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());
    const key = startOfWeek.toISOString().split('T')[0];
    if (!weeks[key]) weeks[key] = { week: key, totalKwh: 0, count: 0, anomalies: 0 };
    weeks[key].totalKwh += r.kwh;
    weeks[key].count++;
    if (r.anomaly) weeks[key].anomalies++;
  });
  return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week));
}

function groupByMonth(data) {
  const months = {};
  data.forEach(r => {
    const d = new Date(r.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months[key]) months[key] = { month: key, totalKwh: 0, count: 0, anomalies: 0, estimatedBill: 0 };
    months[key].totalKwh += r.kwh;
    months[key].count++;
    if (r.anomaly) months[key].anomalies++;
  });
  Object.values(months).forEach(m => {
    m.totalKwh = parseFloat(m.totalKwh.toFixed(3));
    m.estimatedBill = estimateBill(m.totalKwh);
  });
  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
}

// ─── API Routes ────────────────────────────────────────────────────────────────

// POST /api/readings – Add one or more readings
app.post('/api/readings', (req, res) => {
  const body = req.body;
  const incoming = Array.isArray(body) ? body : [body];

  const added = [];
  for (const item of incoming) {
    if (item.kwh === undefined || item.kwh === null || isNaN(parseFloat(item.kwh))) {
      return res.status(400).json({ error: 'Each reading must include a numeric "kwh" field.' });
    }
    const reading = {
      id: uuidv4(),
      kwh: parseFloat(parseFloat(item.kwh).toFixed(3)),
      timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
      label: item.label || '',
      source: item.source || 'manual'
    };
    readings.push(reading);
    added.push(reading);
  }

  // Sort by timestamp after every insert
  readings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  res.status(201).json({ added: added.length, readings: added });
});

// GET /api/readings – Get all readings with anomaly annotation
app.get('/api/readings', (req, res) => {
  const annotated = detectAnomalies(readings);
  res.json(annotated);
});

// DELETE /api/readings/:id – Remove a single reading
app.delete('/api/readings/:id', (req, res) => {
  const before = readings.length;
  readings = readings.filter(r => r.id !== req.params.id);
  if (readings.length === before) return res.status(404).json({ error: 'Reading not found' });
  res.json({ deleted: req.params.id });
});

// DELETE /api/readings – Clear all readings
app.delete('/api/readings', (req, res) => {
  readings = [];
  res.json({ message: 'All readings cleared.' });
});

// GET /api/analysis – Full analysis summary
app.get('/api/analysis', (req, res) => {
  if (readings.length === 0) {
    return res.json({ totalReadings: 0, totalKwh: 0, anomalies: [], suggestions: [], weekly: [], monthly: [] });
  }

  const annotated = detectAnomalies(readings);
  const anomalies = annotated.filter(r => r.anomaly);
  const totalKwh = parseFloat(readings.reduce((s, r) => s + r.kwh, 0).toFixed(3));
  const suggestions = generateSuggestions(annotated);
  const weekly = groupByWeek(annotated);
  const monthly = groupByMonth(annotated);
  const estimatedMonthlyBill = monthly.length ? monthly[monthly.length - 1].estimatedBill : estimateBill(totalKwh);

  const values = readings.map(r => r.kwh);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);

  res.json({
    totalReadings: readings.length,
    totalKwh,
    mean: parseFloat(mean.toFixed(3)),
    max,
    min,
    anomalyCount: anomalies.length,
    anomalyRate: parseFloat(((anomalies.length / readings.length) * 100).toFixed(1)),
    estimatedMonthlyBill,
    suggestions,
    annotated,
    weekly,
    monthly
  });
});

// GET /api/export – Export readings as JSON
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="energy-readings.json"');
  res.json(readings);
});

// POST /api/import – Bulk import readings from JSON
app.post('/api/import', (req, res) => {
  const data = req.body;
  if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of readings' });
  readings = [];
  for (const item of data) {
    readings.push({
      id: item.id || uuidv4(),
      kwh: parseFloat(item.kwh),
      timestamp: item.timestamp || new Date().toISOString(),
      label: item.label || '',
      source: item.source || 'imported'
    });
  }
  readings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json({ imported: readings.length });
});

// POST /api/seed – Load sample data for demo
app.post('/api/seed', (req, res) => {
  readings = [];
  const now = new Date('2026-10-01T00:00:00');
  const sampleData = [
    // Week 1 – mostly normal with one spike
    { kwh: 2.1 }, { kwh: 1.9 }, { kwh: 2.3 }, { kwh: 2.0 }, { kwh: 2.2 },
    { kwh: 8.7 }, // spike – day 6
    { kwh: 2.1 }, { kwh: 1.8 }, { kwh: 2.0 }, { kwh: 2.3 }, { kwh: 2.4 },
    // Week 2 – night surges
    { kwh: 2.0 }, { kwh: 1.9 }, { kwh: 2.1 }, { kwh: 5.6 }, { kwh: 5.9 }, // night surges
    { kwh: 2.0 }, { kwh: 1.7 },
    // Weekend spike
    { kwh: 2.2 }, { kwh: 2.1 }, { kwh: 7.4 }, { kwh: 7.1 }, // weekend
    // Consecutive high
    { kwh: 4.5 }, { kwh: 4.7 }, { kwh: 4.6 }, // R6 consecutive
    { kwh: 2.0 }, { kwh: 2.1 }, { kwh: 1.9 }, { kwh: 0.0 }, // zero reading
    { kwh: 2.2 }, { kwh: 2.0 }
  ];

  sampleData.forEach((d, i) => {
    const ts = new Date(now);
    ts.setDate(ts.getDate() + Math.floor(i / 2));
    ts.setHours(i % 2 === 0 ? 14 : 22, 0, 0, 0);
    readings.push({
      id: uuidv4(),
      kwh: d.kwh,
      timestamp: ts.toISOString(),
      label: `Sample reading ${i + 1}`,
      source: 'seed'
    });
  });

  readings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json({ seeded: readings.length });
});

// ─── Catch-all: serve index.html ───────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n⚡ Energy Waste Detective running at http://localhost:${PORT}\n`);
});
