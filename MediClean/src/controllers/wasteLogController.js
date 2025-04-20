import { StatusCodes } from 'http-status-codes';
import * as wasteLogService from '../services/wasteLogService.js';

export const handleCreateWasteLog = async (req, res, next) => {
  try {
    const wasteLog = await wasteLogService.createWasteLog({
      ...req.body,
      clinicId: req.user.id
    });
    res.status(StatusCodes.CREATED).json(wasteLog);
  } catch (error) {
    next(error);
  }
};

export const handleGetWasteLogs = async (req, res, next) => {
  try {
    const filters = {
      ...req.query,
      clinicId: req.user.role === 'clinic' ? req.user.id : req.query.clinicId
    };
    const wasteLogs = await wasteLogService.getWasteLogs(filters);
    res.status(StatusCodes.OK).json(wasteLogs);
  } catch (error) {
    next(error);
  }
};

export const handleGetWasteLogById = async (req, res, next) => {
  try {
    const wasteLog = await wasteLogService.getWasteLogById(req.params.id);
    res.status(StatusCodes.OK).json(wasteLog);
  } catch (error) {
    next(error);
  }
};

export const handleUpdateWasteLog = async (req, res, next) => {
  try {
    const wasteLog = await wasteLogService.updateWasteLog(req.params.id, req.body);
    res.status(StatusCodes.OK).json(wasteLog);
  } catch (error) {
    next(error);
  }
};

export const handleDeleteWasteLog = async (req, res, next) => {
  try {
    await wasteLogService.deleteWasteLog(req.params.id);
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};

export const handleGetWasteStatistics = async (req, res, next) => {
  try {
    const filters = {
      ...req.query,
      clinicId: req.user.role === 'clinic' ? req.user.id : req.query.clinicId
    };
    const statistics = await wasteLogService.getWasteStatistics(filters);
    res.status(StatusCodes.OK).json(statistics);
  } catch (error) {
    next(error);
  }
};