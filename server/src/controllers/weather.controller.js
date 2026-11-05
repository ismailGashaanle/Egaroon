const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { getBusiness } = require('../services/platformSettings.service');
const weatherService = require('../services/weather.service');

function assertCanReadWeather(req) {
  const enabled = Boolean(getBusiness().weatherEnabled);
  const isSuperAdmin = req.user?.role === ROLES.SUPER_ADMIN;
  if (!enabled && !isSuperAdmin) {
    throw ApiError.forbidden(
      'Weather is disabled by platform settings (weatherEnabled=false)',
      { code: 'WEATHER_DISABLED' }
    );
  }
  return enabled;
}

const lookup = asyncHandler(async (req, res) => {
  const enabled = assertCanReadWeather(req);
  const weather = await weatherService.lookup(req.query);
  sendSuccess(res, 200, { weather, weatherEnabled: enabled });
});

const listCities = asyncHandler(async (req, res) => {
  const enabled = assertCanReadWeather(req);
  const cities = await weatherService.listCities();
  sendSuccess(res, 200, { cities, weatherEnabled: enabled });
});

const listAlerts = asyncHandler(async (req, res) => {
  const enabled = assertCanReadWeather(req);
  const board = await weatherService.listAlerts({ date: req.query.date });
  sendSuccess(res, 200, { ...board, weatherEnabled: enabled });
});

const addCity = asyncHandler(async (req, res) => {
  const city = await weatherService.addCity(req.body);
  sendSuccess(res, 201, { city });
});

const removeCity = asyncHandler(async (req, res) => {
  const result = await weatherService.removeCity(req.params.id);
  sendSuccess(res, 200, result);
});

const refresh = asyncHandler(async (req, res) => {
  const cities = await weatherService.refreshAll({ days: 2 });
  const board = await weatherService.listAlerts({ date: req.query.date });
  sendSuccess(res, 200, { cities, ...board });
});

module.exports = { lookup, listCities, listAlerts, addCity, removeCity, refresh };
