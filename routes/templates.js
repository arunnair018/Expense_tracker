const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl        = require('../controllers/templateController');

router.get   ('/',    protect, ctrl.list);
router.post  ('/',    protect, ctrl.create);
router.put   ('/:id', protect, ctrl.update);
router.delete('/:id', protect, ctrl.remove);

module.exports = router;
