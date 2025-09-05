// controllers/scanController.js
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const Scan = require('../models/Scan');
const Job = require('../models/Jobs');
const skillsMatcher = require('../utils/skillsMatching');
const logger = require('../utils/logger');

// Generate unique scan ID
const generateScanId = () => {
  return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * @desc    Upload and process resume
 * @route   POST /api/scan-resume
 * @access  Private (HR/Admin)
 */
const scanResume = async (req, res) => {
  const startTime = Date.now();
  let tempFilePath = null;
  let scanId = null;

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    tempFilePath = req.file.path;
    const originalName = req.file.originalname;
    scanId = generateScanId();

    // Create stored_resumes directory if it doesn't exist
    const permanentDir = path.join(__dirname, '../stored_resumes');
    if (!fs.existsSync(permanentDir)) {
      fs.mkdirSync(permanentDir, { recursive: true });
    }

    // Move file to permanent storage with unique name
    const permanentFileName = `${scanId}_${originalName}`;
    const permanentPath = path.join(permanentDir, permanentFileName);
    fs.renameSync(tempFilePath, permanentPath);

    logger.info(`File uploaded: ${originalName} -> ${permanentFileName}`);

    // Create initial scan record
    const scanRecord = new Scan({
      scanId,
      filename: permanentFileName,
      originalName,
      filePath: permanentPath,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      uploadedBy: req.user._id,
      status: 'processing'
    });

    await scanRecord.save();

    // Send file to Python service for processing
    const formData = new FormData();
    formData.append('file', fs.createReadStream(permanentPath), {
      filename: originalName,
      contentType: req.file.mimetype
    });

    const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    
    logger.info(`Sending file to Python service: ${pythonUrl}`);

    const pythonResponse = await axios.post(
      `${pythonUrl}/scan-resume/`, 
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 60000 // 60 second timeout
      }
    );

    const pythonResult = pythonResponse.data;

    // Extract candidate information and skills
    const extractedSkills = pythonResult.skills || pythonResult.extracted_skills || [];
    const candidateInfo = pythonResult.candidate_info || {};

    // Get all open jobs for matching
    const openJobs = await Job.find({ status: 'open' });

    // Calculate job matches
    const jobMatches = [];
    let topMatch = { job: null, score: 0 };

    for (const job of openJobs) {
      const matchScore = skillsMatcher.calculateMatchScore(extractedSkills, job.skills);
      const matchDetails = skillsMatcher.getMatchDetails(extractedSkills, job.skills);
      
      if (matchScore > 0) {
        const jobMatch = {
          job: job._id,
          matchScore,
          skillsMatched: matchDetails.matched,
          skillsMissing: matchDetails.missing
        };
        
        jobMatches.push(jobMatch);

        // Track top match
        if (matchScore > topMatch.score) {
          topMatch = { job: job._id, score: matchScore };
        }
      }
    }

    // Sort matches by score (descending)
    jobMatches.sort((a, b) => b.matchScore - a.matchScore);

    const processingTime = Date.now() - startTime;

    // Update scan record with results
    scanRecord.candidateName = candidateInfo.name || '';
    scanRecord.candidateEmail = candidateInfo.email || '';
    scanRecord.candidatePhone = candidateInfo.phone || '';
    scanRecord.extractedSkills = extractedSkills;
    scanRecord.experience = candidateInfo.experience || 0;
    scanRecord.education = candidateInfo.education || [];
    scanRecord.jobMatches = jobMatches;
    scanRecord.topMatch = topMatch.score > 0 ? topMatch : undefined;
    scanRecord.processingTime = processingTime;
    scanRecord.pythonServiceResult = pythonResult;
    scanRecord.status = 'completed';

    await scanRecord.save();

    logger.info(`Resume processing completed: ${scanId} (${processingTime}ms)`);

    // Return response
    res.json({
      success: true,
      scanId,
      filename: originalName,
      candidateInfo: {
        name: scanRecord.candidateName,
        email: scanRecord.candidateEmail,
        phone: scanRecord.candidatePhone,
        extractedSkills,
        experience: scanRecord.experience
      },
      jobMatches: jobMatches.slice(0, 5), // Return top 5 matches
      topMatch,
      processingTime,
      message: `Found ${jobMatches.length} job matches`
    });

  } catch (error) {
    logger.error('Resume scanning error:', {
      scanId,
      error: error.message,
      stack: error.stack
    });

    // Update scan record as failed if it exists
    if (scanId) {
      try {
        await Scan.findOneAndUpdate(
          { scanId },
          { 
            status: 'failed',
            pythonServiceResult: { error: error.message }
          }
        );
      } catch (updateError) {
        logger.error('Failed to update scan status:', updateError);
      }
    }

    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        message: 'Resume processing service is temporarily unavailable',
        error: 'Unable to connect to Python service'
      });
    }

    res.status(500).json({
      message: 'Resume processing failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Get scan history with filters
 * @route   GET /api/scan-history
 * @access  Private
 */
const getScanHistory = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      jobId, 
      dateFrom, 
      dateTo,
      minScore,
      search 
    } = req.query;

    let query = {};

    // Admin can see all, HR sees only their uploads
    if (req.user.role !== 'admin') {
      query.uploadedBy = req.user._id;
    }

    // Apply filters
    if (status) query.status = status;
    if (jobId) query['jobMatches.job'] = jobId;
    if (minScore) query['topMatch.score'] = { $gte: parseInt(minScore) };

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Search filter
    if (search) {
      query.$or = [
        { candidateName: { $regex: search, $options: 'i' } },
        { candidateEmail: { $regex: search, $options: 'i' } },
        { originalName: { $regex: search, $options: 'i' } },
        { extractedSkills: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const scans = await Scan.find(query)
      .populate('uploadedBy', 'username email')
      .populate('jobMatches.job', 'title department')
      .populate('topMatch.job', 'title department')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-pythonServiceResult -filePath') // Exclude sensitive data
      .exec();

    const total = await Scan.countDocuments(query);

    res.json({
      success: true,
      data: scans,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Get scan history error:', error);
    res.status(500).json({ message: 'Error fetching scan history' });
  }
};

module.exports = {
  scanResume,
  getScanHistory
};
