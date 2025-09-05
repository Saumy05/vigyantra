const mongoose = require('mongoose');

const jobMatchSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  matchScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  skillsMatched: [String],
  skillsMissing: [String]
});

const ScanSchema = new mongoose.Schema({
  scanId: {
    type: String,
    unique: true,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Extracted resume data
  candidateName: String,
  candidateEmail: String,
  candidatePhone: String,
  extractedSkills: [String],
  experience: Number,
  education: [String],
  
  // Job matching results
  jobMatches: [jobMatchSchema],
  topMatch: {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job'
    },
    score: Number
  },
  
  // Processing results
  processingTime: Number, // milliseconds
  pythonServiceResult: Object,
  
  // Status tracking
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  
  // HR actions
  reviewed: {
    type: Boolean,
    default: false
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewDate: Date,
  hrNotes: String,
  
  tags: [String]
}, {
  timestamps: true
});

// Indexes for better query performance
ScanSchema.index({ uploadedBy: 1, createdAt: -1 });
ScanSchema.index({ 'topMatch.score': -1 });
ScanSchema.index({ status: 1 });
ScanSchema.index({ extractedSkills: 1 });

module.exports = mongoose.model('Scan', ScanSchema);