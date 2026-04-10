const express    = require('express');
const router     = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl        = require('../controllers/monthController');

router.get   ('/:month',                            protect, ctrl.getMonth);
router.post  ('/:month/:section',                   protect, ctrl.addEntry);
router.post  ('/:month/:section/bulk',              protect, ctrl.addBulkEntries);
router.post  ('/:month/:section/apply-templates',   protect, ctrl.applyTemplates);
router.put   ('/:month/:section/:entryId',          protect, ctrl.updateEntry);
router.delete('/:month/:section/:entryId',          protect, ctrl.deleteEntry);

module.exports = router;
