// routes/jobRoutes.js
const express = require('express');
const {
  createJob,
  getJobs,
  getJobCandidates
} = require('../controllers/jobController');
const { protect, hrAccess } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, hrAccess, createJob);
router.get('/', protect, getJobs);
router.get('/:id/candidates', protect, hrAccess, getJobCandidates);

module.exports = router;
