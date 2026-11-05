const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const siteContentService = require('../services/siteContent.service');

/** Public — marketing pages fetch CMS content with no auth. */
const getPublicSiteContent = asyncHandler(async (req, res) => {
  const content = await siteContentService.getContent();
  sendSuccess(res, 200, { content });
});

/** Super Admin — full document for editor. */
const getAdminSiteContent = asyncHandler(async (req, res) => {
  const content = await siteContentService.getContent();
  sendSuccess(res, 200, { content });
});

const updateAdminSiteContent = asyncHandler(async (req, res) => {
  const content = await siteContentService.updateContent(req.body, req.user.id);
  sendSuccess(res, 200, { content });
});

module.exports = {
  getPublicSiteContent,
  getAdminSiteContent,
  updateAdminSiteContent,
};
