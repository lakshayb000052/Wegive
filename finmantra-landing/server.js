const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('===================================================');
  console.log(` FinMantra NGO Landing Page Live at: http://localhost:${PORT}`);
  console.log(` Connected to DanaPro Backend: http://localhost:5000`);
  console.log('===================================================');
});
