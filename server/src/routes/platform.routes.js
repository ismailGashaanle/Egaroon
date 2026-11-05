const express = require('express');
const ctrl = require('../controllers/siteContent.controller');

const router = express.Router();

/** Public marketing / UI content (CMS). */
router.get('/content', ctrl.getPublicSiteContent);

module.exports = router;
