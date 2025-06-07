const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://safety-risk-level-app.onrender.com'  // 👈 your frontend Render URL
  ],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
const upload = multer({ dest: '/tmp' });

function getQuantileThresholds(values, numQuantiles = 6) {
  const sorted = values.slice().sort((a, b) => a - b);
  const thresholds = [];
  for (let i = 1; i < numQuantiles; i++) {
    const index = Math.floor(i * sorted.length / numQuantiles);
    thresholds.push(sorted[index]);
  }
  return thresholds;
}

function getQuantileScore(value, thresholds) {
  for (let i = 0; i < thresholds.length; i++) {
    if (value <= thresholds[i]) return i;
  }
  return thresholds.length;
}

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const workbook = xlsx.readFile(req.file.path);
  const sheetName = workbook.SheetNames[0];
  const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' });

  const cleanNumber = (val) => parseFloat((val || '').toString().replace(/[^0-9.]/g, '')) || 0;

  const freqList = sheet.map(p => cleanNumber(p["2021-2025 Frequency Rate"]));
  const hgList = sheet.map(p => cleanNumber(p["HG Level"]));
  const emodList = sheet.map(p => cleanNumber(p["EMOD"]));
  const premList = sheet.map(p => cleanNumber(p["Inforce Premium"]));

  const freqThresholds = getQuantileThresholds(freqList);
  const hgThresholds = getQuantileThresholds(hgList);
  const emodThresholds = getQuantileThresholds(emodList);
  const premThresholds = getQuantileThresholds(premList);

  const results = sheet.map(policy => {
    const freq = cleanNumber(policy["2021-2025 Frequency Rate"]);
    const hg = cleanNumber(policy["HG Level"]);
    const emod = cleanNumber(policy["EMOD"]);
    const premium = cleanNumber(policy["Inforce Premium"]);

    const freqScore = getQuantileScore(freq, freqThresholds);
    const hgScore = getQuantileScore(hg, hgThresholds);
    const emodScore = getQuantileScore(emod, emodThresholds);
    const premScore = getQuantileScore(premium, premThresholds);

    const totalScore = Math.round((freqScore + hgScore + emodScore + premScore) / 4);
    let riskBand = 'Low';
    if (totalScore >= 4) riskBand = 'High';
    else if (totalScore >= 2) riskBand = 'Medium';

    return {
      ...policy,
      riskScore: totalScore,
      riskBand
    };
  });

  res.json(results);
});

app.post('/api/download', async (req, res) => {
  const data = req.body;
  if (!Array.isArray(data) || data.length === 0) return res.status(400).json({ error: 'No data to export' });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Policies');

  worksheet.columns = Object.keys(data[0]).map(key => ({
    header: key,
    key: key,
    width: 22,
  }));

  data.forEach(row => {
    const newRow = worksheet.addRow(row);

    Object.keys(row).forEach((key, idx) => {
      const cell = newRow.getCell(idx + 1);
      const value = row[key];

      if ([
        "Incurred 2021-April 2025",
        "Incurred Amount",
        "Inforce Premium",
        "Inforce Exposure",
        "Earned 2021-April 2025"
      ].includes(key)) {
        const number = parseFloat(value.toString().replace(/[^0-9.-]/g, '')) || 0;
        cell.value = number;
        cell.numFmt = '"$"#,##0';
      }

      else if (["2021 - 2025 Loss Ratio", "Loss Ratio"].includes(key)) {
        const number = parseFloat(value.toString().replace('%', '')) / 100 || 0;
        cell.value = number;
        cell.numFmt = '0.0%';
      }

      else if (key === "2021-2025 Frequency Rate") {
        const number = parseFloat(value) || 0;
        cell.value = number;
        cell.numFmt = '0.0';
      }

      else if (key === "EMOD") {
        const number = parseFloat(value) || 0;
        cell.value = number;
        cell.numFmt = '0.00';
      }

      else if (key === "Eff Date") {
        const date = new Date(value);
        if (!isNaN(date)) {
          cell.value = date;
          cell.numFmt = 'mm/dd/yyyy';
        } else {
          cell.value = value;
        }
      }

      else {
        cell.value = value;
      }
    });
  });

  const filePath = path.join(__dirname, 'Policy_Report.xlsx');
  await workbook.xlsx.writeFile(filePath);

  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.download(filePath, 'Policy_Report.xlsx', err => {
    if (err) {
      console.error('Download error:', err);
      res.status(500).send('File download failed');
    }
    fs.unlink(filePath, () => {});
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
