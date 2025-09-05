const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({ 
  origin: 'http://localhost:3000', 
  credentials: true 
}));
app.use(express.json());

// Create uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX allowed'), false);
    }
  }
});

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Simple Vigyantra backend is working!',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/scan-resume', upload.single('file'), async (req, res) => {
  try {
    console.log('📄 File upload received');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📋 File details:', {
      filename: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });

    // Send to Python service
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    console.log('🐍 Sending to Python service...');
    const response = await axios.post(
      'http://localhost:8000/scan-resume/', 
      formData, 
      { 
        headers: formData.getHeaders(),
        timeout: 30000
      }
    );

    console.log('✅ Python service responded successfully');

    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting file:', err);
    });

    // Return processed data
    res.json({
      success: true,
      message: 'Resume processed successfully!',
      filename: req.file.originalname,
      scanResult: {
        riskLevel: response.data.risk_level || 'low',
        riskScore: response.data.risk_score || 15,
        candidateInfo: response.data.candidate_info || {},
        extractedSkills: response.data.extracted_skills || [],
        vulnerabilities: response.data.vulnerabilities || [],
        privacyIssues: response.data.privacy_issues || []
      }
    });

  } catch (error) {
    console.error('❌ Scan error:', error.message);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {});
    }

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Python service unavailable',
        message: 'Make sure Python service is running on port 8000'
      });
    }

    res.status(500).json({ 
      error: 'Scan failed',
      message: error.response?.data?.detail || error.message
    });
  }
});

// Basic error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Simple backend running on http://localhost:${PORT}`);
  console.log(`🐍 Expecting Python service at http://localhost:8000`);
  console.log(`📁 Upload directory: ${uploadDir}`);
});
