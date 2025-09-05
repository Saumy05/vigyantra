const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
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
      cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
    }
  }
});

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Simple backend without auth is working!'
  });
});

// Scan endpoint (NO AUTHENTICATION REQUIRED)
app.post('/api/scan-resume', upload.single('file'), async (req, res) => {
  try {
    console.log('📄 File upload request received');
    
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📋 File details:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Send file to Python service
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    
    console.log('🐍 Sending file to Python service...');
    
    const pythonResponse = await axios.post(
      `${pythonServiceUrl}/scan-resume/`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000
      }
    );

    console.log('✅ Python service responded successfully');

    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    // Return the processed data
    res.json({
      success: true,
      message: 'Resume processed successfully!',
      filename: req.file.originalname,
      size: req.file.size,
      scanResult: {
        riskLevel: pythonResponse.data.risk_level || 'low',  // Ensure riskLevel exists
        riskScore: pythonResponse.data.risk_score || 15,
        vulnerabilities: pythonResponse.data.vulnerabilities || [],
        privacyIssues: pythonResponse.data.privacy_issues || [],
        extractedSkills: pythonResponse.data.extracted_skills || [],
        candidateInfo: pythonResponse.data.candidate_info || {}
      }
    });

  } catch (error) {
    console.error('❌ Processing error:', error.message);

    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Python service unavailable',
        message: 'Please make sure the Python service is running on port 8000'
      });
    }

    res.status(500).json({ 
      error: 'Processing failed',
      message: error.response?.data?.detail || error.message 
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Simple backend server running on http://localhost:${PORT}`);
  console.log(`🐍 Python service expected at: http://localhost:8000`);
  console.log(`📁 Upload directory: ${uploadsDir}`);
});
