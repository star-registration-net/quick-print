import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { printURL } from './printer.js';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Endpoint to handle PDF printing
app.post('/print', async (req, res) => {
  try {
    const { url, cookies } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Get user's Downloads folder path
    const homeDir = os.homedir();
    const printFolder = path.join(homeDir, 'Downloads', 'Print');
    
    const result = await printURL(url, cookies || [], printFolder);
    
    res.json(result);
  } catch (error) {
    console.error('Print error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});