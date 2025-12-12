const { User, ExamAttempt, UserSubscription, Payment } = require('../models');
const { LANGUAGES, EXAM_STATUS, PAYMENT_STATUS } = require('../utils/constants');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { fullName, phone, email } = req.body;

    // Check if email already exists
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user._id }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        ...(fullName && { fullName }),
        ...(phone && { phone }),
        ...(email && { email })
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change preferred language
// @route   PUT /api/users/language
// @access  Private
const changeLanguage = async (req, res, next) => {
  try {
    const { language } = req.body;

    if (!language || !Object.values(LANGUAGES).includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language. Allowed: rw, en, fr'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { preferredLanguage: language },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Language updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user learning statistics
// @route   GET /api/users/stats
// @access  Private
const getUserStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get exam statistics
    const totalExams = await ExamAttempt.countDocuments({
      user: userId,
      status: EXAM_STATUS.COMPLETED
    });

    const passedExams = await ExamAttempt.countDocuments({
      user: userId,
      status: EXAM_STATUS.COMPLETED,
      passed: true
    });

    const avgScoreResult = await ExamAttempt.aggregate([
      {
        $match: {
          user: userId,
          status: EXAM_STATUS.COMPLETED
        }
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$score' }
        }
      }
    ]);

    const averageScore = avgScoreResult.length > 0 ? avgScoreResult[0].avgScore : 0;

    // Get latest exam
    const latestExam = await ExamAttempt.findOne({
      user: userId,
      status: EXAM_STATUS.COMPLETED
    }).sort({ createdAt: -1 });

    // Get active subscription
    const activeSubscription = await UserSubscription.findOne({
      user: userId,
      isActive: true,
      endDate: { $gt: new Date() }
    }).populate('subscription');

    const passRate = totalExams > 0 ? ((passedExams / totalExams) * 100).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalExams,
        passedExams,
        failedExams: totalExams - passedExams,
        passRate: parseFloat(passRate),
        averageScore: averageScore ? parseFloat(averageScore).toFixed(2) : 0,
        latestExamDate: latestExam?.createdAt,
        latestExamScore: latestExam?.score,
        latestExamPassed: latestExam?.passed,
        hasActiveSubscription: !!activeSubscription,
        examAttemptsRemaining: activeSubscription 
          ? activeSubscription.subscription.features.examAttempts - activeSubscription.examAttemptsUsed 
          : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user by ID (public profile)
// @route   GET /api/users/:id
// @access  Public
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('fullName email createdAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// ADMIN ROUTES
// ========================

// @desc    Get all users (Admin)
// @route   GET /api/users/admin/all
// @access  Private/Admin
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role, isActive } = req.query;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = {};
    
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      filter.role = role;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const count = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: { users }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user details (Admin)
// @route   GET /api/users/admin/:id
// @access  Private/Admin
const getUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user statistics
    const totalExams = await ExamAttempt.countDocuments({ user: id });
    const activeSubscription = await UserSubscription.findOne({
      user: id,
      isActive: true,
      endDate: { $gt: new Date() }
    }).populate('subscription');

    const totalSpent = await Payment.aggregate([
      {
        $match: {
          user: user._id,
          status: PAYMENT_STATUS.COMPLETED
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        user,
        statistics: {
          totalExams,
          hasActiveSubscription: !!activeSubscription,
          subscriptionEndsAt: activeSubscription?.endDate,
          totalSpent: totalSpent.length > 0 ? totalSpent[0].total : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Ban/Unban user (Admin)
// @route   PUT /api/users/admin/:id/ban
// @access  Private/Admin
const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent banning yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot ban yourself'
      });
    }

    // Prevent banning other admins
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'You cannot ban another admin'
      });
    }

    // Toggle active status
    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'banned'} successfully`,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change user role (Admin)
// @route   PUT /api/users/admin/:id/role
// @access  Private/Admin
const changeUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['client', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Allowed: client, admin'
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent changing your own role
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role'
      });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User role changed to ${role} successfully`,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get platform analytics (Admin)
// @route   GET /api/users/admin/analytics
// @access  Private/Admin
const getAnalytics = async (req, res, next) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: new Date(new Date().setDate(1)) }
    });

    // Subscriptions
    const activeSubscriptions = await UserSubscription.countDocuments({
      isActive: true,
      endDate: { $gt: new Date() }
    });

    // Revenue
    const totalRevenue = await Payment.aggregate([
      {
        $match: { status: PAYMENT_STATUS.COMPLETED }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const revenueThisMonth = await Payment.aggregate([
      {
        $match: {
          status: PAYMENT_STATUS.COMPLETED,
          createdAt: { $gte: new Date(new Date().setDate(1)) }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Exams
    const totalExams = await ExamAttempt.countDocuments({
      status: EXAM_STATUS.COMPLETED
    });

    const examsThisMonth = await ExamAttempt.countDocuments({
      status: EXAM_STATUS.COMPLETED,
      createdAt: { $gte: new Date(new Date().setDate(1)) }
    });

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          newThisMonth: newUsersThisMonth
        },
        subscriptions: {
          active: activeSubscriptions
        },
        revenue: {
          total: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
          thisMonth: revenueThisMonth.length > 0 ? revenueThisMonth[0].total : 0
        },
        exams: {
          total: totalExams,
          thisMonth: examsThisMonth
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account (Admin or Self)
// @route   DELETE /api/users/:id
// @access  Private
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user is deleting their own account or is admin
    if (req.user._id.toString() !== id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own account'
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admins from deleting other admins
    if (user.role === 'admin' && req.user.role === 'admin' && req.user._id.toString() !== id) {
      return res.status(400).json({
        success: false,
        message: 'Admins cannot delete other admin accounts'
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'User account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Client routes
  getProfile,
  updateProfile,
  changeLanguage,
  getUserStats,
  getUserById,
  deleteUser,
  
  // Admin routes
  getAllUsers,
  getUserDetails,
  toggleUserStatus,
  changeUserRole,
  getAnalytics
};