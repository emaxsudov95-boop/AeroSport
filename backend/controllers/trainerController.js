const mongoose = require('mongoose');
const Trainer = require('../models/Trainer');
const TrainerRequest = require('../models/TrainerRequest');
const { getFallbackTrainers, getFallbackTrainerById } = require('../utils/fallbackStore');

// @desc    Get all trainers with search & specialization filter
// @route   GET /api/trainers
// @access  Public
const getTrainers = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const { sport, search, specialization } = req.query;
      let query = {};

      if (sport && sport !== 'all') {
        query.sports = { $in: [new RegExp(sport, 'i')] };
      }

      if (specialization && specialization !== 'all') {
        query.specialization = { $regex: specialization, $options: 'i' };
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { specialization: { $regex: search, $options: 'i' } },
          { bio: { $regex: search, $options: 'i' } },
          { sports: { $in: [new RegExp(search, 'i')] } },
        ];
      }

      const trainers = await Trainer.find(query).sort({ rating: -1 });
      if (trainers && trainers.length > 0) {
        return res.json(trainers);
      }
    }
  } catch (error) {
    console.warn('MongoDB getTrainers warning:', error.message);
  }

  return res.json(getFallbackTrainers(req.query));
};

// @desc    Get trainer by ID
// @route   GET /api/trainers/:id
// @access  Public
const getTrainerById = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(req.params.id)) {
      const trainer = await Trainer.findById(req.params.id);
      if (trainer) {
        return res.json(trainer);
      }
    }
  } catch (error) {
    console.warn('MongoDB getTrainerById warning:', error.message);
  }

  const fallback = getFallbackTrainerById(req.params.id);
  if (fallback) {
    return res.json(fallback);
  }
  return res.status(404).json({ message: 'Trainer not found' });
};

// @desc    Send a message / training request to a trainer
// @route   POST /api/trainers/:id/request
// @access  Private
const createTrainerRequest = async (req, res) => {
  try {
    const { goals, preferredSchedule, message, clientName, clientEmail, clientPhone } = req.body;

    const trainer = await Trainer.findById(req.params.id);
    if (!trainer) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    if (!goals || !message) {
      return res.status(400).json({ message: 'Please specify your fitness goals and message' });
    }

    const trainerRequest = new TrainerRequest({
      user: req.user._id,
      trainer: trainer._id,
      trainerName: trainer.name,
      clientName: clientName || req.user.name,
      clientEmail: clientEmail || req.user.email,
      clientPhone: clientPhone || req.user.phone || '+1 555-0100',
      goals,
      preferredSchedule: preferredSchedule || 'Flexible',
      message,
      status: 'Pending',
    });

    const savedRequest = await trainerRequest.save();
    res.status(201).json(savedRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user's sent trainer requests
// @route   GET /api/trainers/my/requests
// @access  Private
const getMyTrainerRequests = async (req, res) => {
  try {
    const requests = await TrainerRequest.find({ user: req.user._id })
      .populate('trainer', 'image title specialization pricePerHour rating phone email')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update trainer details (name, title, specialization, price, image, bio)
// @route   PUT /api/trainers/:id
// @access  Private / Admin
const updateTrainer = async (req, res) => {
  try {
    const trainer = await Trainer.findById(req.params.id);
    if (!trainer) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    if (req.body.name) trainer.name = req.body.name.trim();
    if (req.body.title) trainer.title = req.body.title.trim();
    if (req.body.specialization) trainer.specialization = req.body.specialization.trim();
    if (req.body.pricePerHour !== undefined) trainer.pricePerHour = Number(req.body.pricePerHour);
    if (req.body.experienceYears !== undefined) trainer.experienceYears = Number(req.body.experienceYears);
    if (req.body.image) trainer.image = req.body.image.trim();
    if (req.body.bio) trainer.bio = req.body.bio.trim();
    if (req.body.phone) trainer.phone = req.body.phone.trim();
    if (req.body.email) trainer.email = req.body.email.trim();
    if (req.body.rating !== undefined) trainer.rating = Number(req.body.rating);
    if (req.body.sports && Array.isArray(req.body.sports)) trainer.sports = req.body.sports;

    const updated = await trainer.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTrainers,
  getTrainerById,
  createTrainerRequest,
  getMyTrainerRequests,
  updateTrainer,
};

