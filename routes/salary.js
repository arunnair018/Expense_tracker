const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl        = require('../controllers/salaryController');

router.get   ('/',                protect, ctrl.getConfig);
router.get   ('/effective',       protect, ctrl.getEffective);
router.post  ('/',                protect, ctrl.setEntry);
router.delete('/:effectiveFrom',  protect, ctrl.deleteEntry);

module.exports = router;
