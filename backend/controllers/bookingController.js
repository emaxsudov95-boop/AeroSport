const mongoose = require('mongoose');
const Facility = require('../models/Facility');
const Booking = require('../models/Booking');
const { getFallbackFacilities, getFallbackFacilityById } = require('../utils/fallbackStore');

// @desc    Get all sports facilities (fields, gyms, halls)
// @route   GET /api/bookings/facilities
// @access  Public
const getFacilities = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const { type, search, city } = req.query;
      let query = {};

      if (type && type !== 'all') {
        query.type = type;
      }

      if (city) {
        query.city = { $regex: city, $options: 'i' };
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { surface: { $regex: search, $options: 'i' } },
        ];
      }

      const facilities = await Facility.find(query).sort({ rating: -1 });
      if (facilities && facilities.length > 0) {
        return res.json(facilities);
      }
    }
  } catch (error) {
    console.warn('MongoDB getFacilities warning:', error.message);
  }

  return res.json(getFallbackFacilities(req.query));
};

// @desc    Get single facility by ID
// @route   GET /api/bookings/facilities/:id
// @access  Public
const getFacilityById = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(req.params.id)) {
      const facility = await Facility.findById(req.params.id);
      if (facility) {
        return res.json(facility);
      }
    }
  } catch (error) {
    console.warn('MongoDB getFacilityById warning:', error.message);
  }

  const fallback = getFallbackFacilityById(req.params.id);
  if (fallback) {
    return res.json(fallback);
  }
  return res.status(404).json({ message: 'Facility not found' });
};

// @desc    Get booked slots for a facility on a specific date
// @route   GET /api/bookings/facilities/:id/slots
// @access  Public
const getFacilityBookedSlots = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required (YYYY-MM-DD)' });
    }

    const bookings = await Booking.find({
      facility: req.params.id,
      date,
      status: { $ne: 'Cancelled' },
    }).select('timeSlot');

    const bookedSlots = bookings.map((b) => b.timeSlot);
    res.json(bookedSlots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Book a mini football field or gym hall
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
  try {
    const { facilityId, date, timeSlot, contactName, contactPhone, notes } = req.body;

    if (!facilityId || !date || !timeSlot || !contactPhone) {
      return res.status(400).json({ message: 'Facility, date, time slot, and phone are required' });
    }

    const facility = await Facility.findById(facilityId);
    if (!facility) {
      return res.status(404).json({ message: 'Facility not found' });
    }

    // Check if slot is already booked
    const existingBooking = await Booking.findOne({
      facility: facilityId,
      date,
      timeSlot,
      status: { $ne: 'Cancelled' },
    });

    if (existingBooking) {
      return res.status(400).json({ message: 'This time slot is already booked. Please choose another slot.' });
    }

    const booking = new Booking({
      user: req.user._id,
      facility: facility._id,
      facilityName: facility.name,
      facilityType: facility.type,
      date,
      timeSlot,
      totalPrice: facility.pricePerHour,
      contactName: contactName || req.user.name,
      contactPhone,
      notes: notes || '',
      status: 'Confirmed',
    });

    const createdBooking = await booking.save();
    res.status(201).json(createdBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged in user's bookings
// @route   GET /api/bookings/mybookings
// @access  Private
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('facility', 'image address city surface dimensions')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel a booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to cancel this booking' });
    }

    booking.status = 'Cancelled';
    await booking.save();
    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getFacilities,
  getFacilityById,
  getFacilityBookedSlots,
  createBooking,
  getMyBookings,
  cancelBooking,
};
