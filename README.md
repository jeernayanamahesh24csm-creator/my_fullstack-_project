# ⚡ Energy Waste Detective

A smart dashboard that identifies unusual electricity consumption patterns and suggests ways to reduce energy bills — built with **pure rule-based anomaly detection** and **no extra hardware required**.

---

## 🖥️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express.js |
| Frontend | HTML5 + CSS3 + Vanilla JavaScript |
| Charts | Chart.js |
| Data Store | In-memory (JSON export/import supported) |

---

## ✨ Features

- 📥 **Enter or import** electricity readings manually or via JSON
- 🔍 **Detect abnormal usage** using 6 rule-based anomaly detection rules
- 💰 **Estimate monthly bills** using slab-based tariff calculation
- 📊 **Compare usage** across weeks and months with interactive charts
- 💡 **Get suggestions** tailored to the specific anomaly type detected

---

## 🔍 Anomaly Detection Rules (No Hardware Needed)

| Rule | Name | Trigger |
|------|------|---------|
| R1 | Unusual Spike | Value > mean + 2×standard deviation |
| R2 | Unusual Drop | Value < mean − 2×standard deviation |
| R3 | Night Surge | Hour 10pm–6am AND usage > 1.5× mean |
| R4 | Weekend Spike | Weekend AND usage > 1.8× weekday mean |
| R5 | Zero Reading | kWh = 0 (possible meter fault) |
| R6 | Sustained High | 3+ consecutive readings above elevated threshold |

---

## 💰 Bill Estimation (Slab Tariff)

| Slab | Units | Rate |
|------|-------|------|
| Slab 1 | 0 – 100 kWh | ₹3.50/kWh |
| Slab 2 | 101 – 300 kWh | ₹5.00/kWh |
| Slab 3 | 301 – 500 kWh | ₹6.50/kWh |
| Slab 4 | 500+ kWh | ₹8.00/kWh |
| Fixed Charge | — | ₹50/month |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/energy-waste-detective.git

# Navigate into the project
cd energy-waste-detective

# Install dependencies
npm install

# Start the server
node server.js
```

### Open in browser
```
http://localhost:3000
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/readings` | Add one or bulk readings |
| GET | `/api/readings` | Get all readings with anomaly tags |
| DELETE | `/api/readings/:id` | Delete a single reading |
| DELETE | `/api/readings` | Clear all readings |
| GET | `/api/analysis` | Full anomaly + bill + suggestions report |
| GET | `/api/export` | Download readings as JSON |
| POST | `/api/import` | Bulk import readings from JSON |
| POST | `/api/seed` | Load 30 built-in demo readings |

---

## 📁 Project Structure

```
energy-waste-detective/
├── server.js        ← Express backend + anomaly engine + API
├── package.json
├── .gitignore
└── public/
    ├── index.html   ← Dashboard layout
    ├── style.css    ← Dark-themed responsive UI
    └── app.js       ← Chart.js + all frontend logic
```

---

## 📸 Dashboard Overview

- **KPI Cards** — Readings, Total kWh, Avg, Anomaly Rate, Est. Bill, Peak
- **Timeline Chart** — Anomalies highlighted in red/orange with mean line
- **Weekly Bar Chart** — Colour-coded by anomaly frequency
- **Monthly Chart** — kWh bars + estimated bill trend (dual Y-axis)
- **Anomaly Sidebar** — Filterable list with rule tags and details
- **Savings Suggestions** — Context-aware tips per anomaly rule
- **Bill Breakdown** — Per-slab cost breakdown with total
- **Readings Table** — Searchable, with delete and status pill per row

---

## 👨‍💻 Author

**Mahesh Jeerna Yana**  
📧 jeernayanamahesh.24.csm@anits.edu.in  
🏫 ANITS – CSM Department

---

## 📄 License

MIT License — free to use, modify, and distribute.
