// controllers/jobController.js
const Job = require('../models/Jobs');
const Scan = require('../models/Scan');
const logger = require('../utils/logger');

/**
 * @desc    Create new job posting
 * @route   POST /api/jobs
 * @access  Private (HR/Admin)
 */
const createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      department,
      skills,
      requiredExperience,
      salaryRange,
      location,
      employmentType,
      priority,
      deadline
    } = req.body;

    const job = await Job.create({
      title,
      description,
      department,
      skills: skills.map(skill => skill.toLowerCase().trim()),
      requiredExperience,
      salaryRange,
      location,
      employmentType,
      priority,
      deadline,
      createdBy: req.user._id
    });

    logger.info(`Job created: ${title} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: job
    });
  } catch (error) {
    logger.error('Create job error:', error);
    res.status(500).json({ message: 'Error creating job' });
  }
};

/**
 * @desc    Get all jobs with filters
 * @route   GET /api/jobs
 * @access  Private
 */
const getJobs = async (req, res) => {
  try {
    const { status, department, priority, page = 1, limit = 10, search } = req.query;
    
    let query = {};
    
    // Build query filters
    if (status) query.status = status;
    if (department) query.department = department;
    if (priority) query.priority = priority;
    
    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { skills: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: {
        path: 'createdBy',
        select: 'username email department'
      }
    };

    const jobs = await Job.paginate(query, options);

    res.json({
      success: true,
      data: jobs.docs,
      pagination: {
        page: jobs.page,
        pages: jobs.totalPages,
        total: jobs.totalDocs,
        hasNext: jobs.hasNextPage,
        hasPrev: jobs.hasPrevPage
      }
    });
  } catch (error) {
    logger.error('Get jobs error:', error);
    res.status(500).json({ message: 'Error fetching jobs' });
  }
};

/**
 * @desc    Get candidates for a specific job
 * @route   GET /api/jobs/:id/candidates
 * @access  Private
 */
const getJobCandidates = async (req, res) => {
  try {
    const jobId = req.params.id;
    
    const candidates = await Scan.find({
      'jobMatches.job': jobId,
      status: 'completed'
    })
    .populate('uploadedBy', 'username email')
    .populate('jobMatches.job', 'title department')
    .sort({ 'topMatch.score': -1 })
    .exec();

    // Extract and format candidate data
    const candidateList = candidates.map(scan => {
      const jobMatch = scan.jobMatches.find(match => 
        match.job._id.toString() === jobId
      );

      return {
        scanId: scan.scanId,
        candidateName: scan.candidateName,
        candidateEmail: scan.candidateEmail,
        extractedSkills: scan.extractedSkills,
        experience: scan.experience,
        matchScore: jobMatch ? jobMatch.matchScore : 0,
        skillsMatched: jobMatch ? jobMatch.skillsMatched : [],
        skillsMissing: jobMatch ? jobMatch.skillsMissing : [],
        filename: scan.originalName,
        uploadDate: scan.createdAt,
        uploadedBy: scan.uploadedBy,
        reviewed: scan.reviewed,
        hrNotes: scan.hrNotes
      };
    });

    logger.info(`Retrieved ${candidateList.length} candidates for job ${jobId}`);

    res.json({
      success: true,
      data: candidateList,
      count: candidateList.length
    });
  } catch (error) {
    logger.error('Get job candidates error:', error);
    res.status(500).json({ message: 'Error fetching candidates' });
  }
};

module.exports = {
  createJob,
  getJobs,
  getJobCandidates
};
