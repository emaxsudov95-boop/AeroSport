const mongoose = require('mongoose');
const Event = require('../models/Event');
const { getFallbackEvents, getFallbackEventById } = require('../utils/fallbackStore');

// @desc    Get all events with filters (type: marathon/cycling, search, city)
// @route   GET /api/events
// @access  Public
const getEvents = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const { type, search, city, difficulty } = req.query;
      let query = {};

      if (type && type !== 'all') {
        query.type = type;
      }

      if (difficulty && difficulty !== 'all') {
        query.difficulty = difficulty;
      }

      if (city) {
        query.city = { $regex: city, $options: 'i' };
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
        ];
      }

      const events = await Event.find(query).sort({ date: 1 });
      if (events && events.length > 0) {
        return res.json(events);
      }
    }
  } catch (error) {
    console.warn('MongoDB getEvents warning:', error.message);
  }

  return res.json(getFallbackEvents(req.query));
};

// @desc    Get event by ID
// @route   GET /api/events/:id
// @access  Public
const getEventById = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(req.params.id)) {
      const event = await Event.findById(req.params.id).populate('registeredUsers', 'name avatar');
      if (event) {
        return res.json(event);
      }
    }
  } catch (error) {
    console.warn('MongoDB getEventById warning:', error.message);
  }

  const fallback = getFallbackEventById(req.params.id);
  if (fallback) {
    return res.json(fallback);
  }
  return res.status(404).json({ message: 'Event not found' });
};

// @desc    Create/Plan a new sports event or marathon
// @route   POST /api/events
// @access  Private
const createEvent = async (req, res) => {
  try {
    const {
      title,
      type,
      category,
      date,
      time,
      location,
      city,
      distance,
      elevationGain,
      difficulty,
      maxParticipants,
      entryFee,
      prizePool,
      image,
      description,
      organizer,
    } = req.body;

    const event = new Event({
      title,
      type: type || 'marathon',
      category: category || (type === 'cycling' ? 'Road Cycling' : 'Marathon'),
      date,
      time: time || '08:00 AM',
      location,
      city,
      distance,
      elevationGain: elevationGain || '100m',
      difficulty: difficulty || 'Intermediate',
      maxParticipants: maxParticipants || 500,
      participantsCount: 1,
      registeredUsers: [req.user._id], // Creator automatically joins
      entryFee: entryFee || 0,
      prizePool: prizePool || 'Finisher Medals & Certificate',
      image: image || (type === 'cycling'
        ? 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80'
        : 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=1200&q=80'),
      description,
      organizer: organizer || req.user.name,
      createdBy: req.user._id,
    });

    const createdEvent = await event.save();
    res.status(201).json(createdEvent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Join a marathon or bicycle race
// @route   POST /api/events/:id/join
// @access  Private
const joinEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const alreadyJoined = event.registeredUsers.some(
      (userId) => userId.toString() === req.user._id.toString()
    );

    if (alreadyJoined) {
      return res.status(400).json({ message: 'You have already joined this event' });
    }

    if (event.participantsCount >= event.maxParticipants) {
      return res.status(400).json({ message: 'Event has reached maximum participants capacity' });
    }

    event.registeredUsers.push(req.user._id);
    event.participantsCount = event.registeredUsers.length;

    await event.save();
    res.json({ message: 'Successfully joined event!', event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Leave/unjoin an event
// @route   POST /api/events/:id/leave
// @access  Private
const leaveEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    event.registeredUsers = event.registeredUsers.filter(
      (userId) => userId.toString() !== req.user._id.toString()
    );
    event.participantsCount = event.registeredUsers.length;

    await event.save();
    res.json({ message: 'Successfully unregistered from event', event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user's joined events
// @route   GET /api/events/my/registrations
// @access  Private
const getMyEvents = async (req, res) => {
  try {
    const events = await Event.find({
      $or: [
        { registeredUsers: req.user._id },
        { createdBy: req.user._id }
      ]
    }).sort({ date: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  joinEvent,
  leaveEvent,
  getMyEvents,
};
