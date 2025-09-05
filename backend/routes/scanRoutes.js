// routes/scanRoutes.js
const express = require('express');
const { scanResume, getScanHistory } = require('../controllers/scanController');
const { protect, hrAccess } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/scan-resume', protect, hrAccess, upload.single('resume'), scanResume);
router.get('/history', protect, getScanHistory);

module.exports = router;
