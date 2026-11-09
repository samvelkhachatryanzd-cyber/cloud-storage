const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const auth = require('../controllers/auth.controller');
const claims = require('../controllers/claims.controller');
const receipts = require('../controllers/receipts.controller');

const router = Router();

router.post('/auth/login', auth.login);

router.use(authenticate);
router.get('/claims', claims.list);
router.post('/claims', claims.create);
router.get('/claims/:id', claims.get);
router.post('/claims/:id/receipts', receipts.upload, receipts.create);
router.get('/receipts/:id/download', receipts.download);

module.exports = router;
