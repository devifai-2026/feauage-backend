const User = require('../../models/User');
const Order = require('../../models/Order');
const Target = require('../../models/Target');
const Product = require('../../models/Product');
const AdminActivity = require('../../models/AdminActivity');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');
const Analytics = require('../../models/Analytics'); // Your analytics model
const GuestUser = require('../../models/GuestUser');
const UserActivityLog = require('../../models/UserActivityLog');
const { toIST } = require('../../utils/dateHelpers');

// @desc    Get admin dashboard stats
// @route   GET /api/v1/admin/dashboard/stats
// @access  Private/Admin

exports.getDashboardStats = catchAsync(async (req, res, next) => {
  try {
    // Import models
    const Order = require('../../models/Order');
    const Product = require('../../models/Product');
    const User = require('../../models/User');
    const Target = require('../../models/Target');
    const Analytics = require('../../models/Analytics');

    // Get date ranges in IST
    const nowIST = toIST();
    const today = new Date(nowIST);
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(nowIST);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date(nowIST);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const sevenDaysAgo = new Date(nowIST);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get current user ID
    const currentUserId = req.user.id;

    // 1. Get all stats in parallel for better performance
    const [
      // Total counts - EXCLUDE ADMIN USERS
      totalUsers,
      totalOrders,
      totalProducts,

      // Revenue stats
      totalRevenueAllTime,
      totalRevenueLast30Days,
      todayRevenue,
      revenuePrevious30Days,

      // Order stats
      todayOrders,
      pendingOrders,
      deliveredOrders,
      totalOrdersPrevious30Days,

      // User stats - EXCLUDE ADMIN USERS
      newUsersLast30Days,
      newUsersPrevious30Days,

      // Get current month's revenue target for the logged-in user
      currentMonthTarget,

      // Analytics data for performance metrics
      analyticsData
    ] = await Promise.all([
      User.countDocuments({
        isActive: true,
        role: { $ne: 'admin' }
      }),
      Order.countDocuments(),
      Product.countDocuments({ isActive: true }),

      // Revenue stats
      Order.aggregate([
        { $match: { status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Order.aggregate([
        {
          $match: {
            status: 'delivered',
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Order.aggregate([
        {
          $match: {
            status: 'delivered',
            createdAt: { $gte: today }
          }
        },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Order.aggregate([
        {
          $match: {
            status: 'delivered',
            createdAt: {
              $gte: sixtyDaysAgo,
              $lt: thirtyDaysAgo
            }
          }
        },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),

      // Order stats
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'delivered' }),
      Order.countDocuments({
        createdAt: {
          $gte: sixtyDaysAgo,
          $lt: thirtyDaysAgo
        }
      }),

      // User growth - Exclude admin users
      User.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
        isActive: true,
        role: { $ne: 'admin' }
      }),
      User.countDocuments({
        createdAt: {
          $gte: sixtyDaysAgo,
          $lt: thirtyDaysAgo
        },
        isActive: true,
        role: { $ne: 'admin' }
      }),

      // Get current month's revenue target for the logged-in user
      Target.findOne({
        userId: currentUserId,
        targetType: 'revenue',
        period: 'monthly',
        isActive: true,
        startDate: { $lte: nowIST },
        endDate: { $gte: nowIST }
      }).sort({ createdAt: -1 }),

      // Get analytics data for performance metrics
      Analytics.aggregate([
        {
          $match: {
            timestamp: { $gte: thirtyDaysAgo },
            type: 'page_view'
          }
        },
        {
          $group: {
            _id: '$sessionId',
            firstView: { $min: '$timestamp' },
            lastView: { $max: '$timestamp' },
            pageViews: { $sum: 1 }
          }
        }
      ])
    ]);

    // 2. Calculate growth percentages
    const revenueLast30DaysValue = totalRevenueLast30Days[0]?.total || 0;
    const revenuePrevious30DaysValue = revenuePrevious30Days[0]?.total || 0;
    const revenueGrowth = revenuePrevious30DaysValue > 0
      ? ((revenueLast30DaysValue - revenuePrevious30DaysValue) / revenuePrevious30DaysValue * 100).toFixed(1)
      : revenueLast30DaysValue > 0 ? 100 : 0;

    const userGrowth = newUsersPrevious30Days > 0
      ? ((newUsersLast30Days - newUsersPrevious30Days) / newUsersPrevious30Days * 100).toFixed(1)
      : newUsersLast30Days > 0 ? 100 : 0;

    const ordersGrowth = totalOrdersPrevious30Days > 0
      ? ((totalOrders - totalOrdersPrevious30Days) / totalOrdersPrevious30Days * 100).toFixed(1)
      : totalOrders > 0 ? 100 : 0;

    // 3. Get target statistics
    let targetSummary = {
      totalTargets: 0,
      totalTargetValue: 0,
      totalAchievedValue: 0,
      avgProgress: 0,
      completedTargets: 0,
      activeTargets: 0
    };

    try {
      const targetStatsResult = await Target.getTargetStats(currentUserId);
      if (targetStatsResult.length > 0) {
        const revenueTargetStats = targetStatsResult.find(stat => stat.targetType === 'revenue');
        if (revenueTargetStats) {
          targetSummary = {
            totalTargets: revenueTargetStats.totalTargets || 0,
            totalTargetValue: revenueTargetStats.totalValue || 0,
            totalAchievedValue: revenueTargetStats.currentValue || 0,
            avgProgress: revenueTargetStats.avgProgress || 0,
            completedTargets: revenueTargetStats.completedTargets || 0,
            activeTargets: revenueTargetStats.activeTargets || 0
          };
        }
      }
    } catch (error) {
      console.error('Error fetching target stats:', error);
    }

    // 4. Get monthly revenue for chart - ONLY CURRENT YEAR
    let monthlyRevenue = [];
    const currentYear = nowIST.getFullYear();
    const currentYearStart = new Date(Date.UTC(currentYear, 0, 1, 18, 30));
    const currentYearEnd = new Date(Date.UTC(currentYear + 1, 0, 1, 18, 30));

    try {
      monthlyRevenue = await Order.aggregate([
        {
          $match: {
            status: 'delivered',
            createdAt: {
              $gte: currentYearStart,
              $lt: currentYearEnd
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$grandTotal' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { '_id.month': 1 } }
      ]);
    } catch (error) {
      console.error('Error fetching monthly revenue:', error);
      monthlyRevenue = [];
    }

    // 5. Format monthly revenue for chart
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let monthlyRevenueChartData = [];

    for (let month = 1; month <= 12; month++) {
      const monthData = monthlyRevenue.find(item =>
        item._id.year === currentYear && item._id.month === month
      );

      let revenue = 0;
      let targetForMonth = 0;

      if (monthData) {
        revenue = monthData.revenue;
        targetForMonth = Math.round(revenue * 1.15);
      }

      const currentMonth = nowIST.getMonth() + 1;

      if (month === currentMonth && currentMonthTarget) {
        targetForMonth = currentMonthTarget.targetValue;
      }

      monthlyRevenueChartData.push({
        month: monthNames[month - 1],
        revenue: revenue,
        target: targetForMonth,
        year: currentYear,
        monthNumber: month
      });
    }

    // 6. Calculate monthly target progress
    const currentMonth = nowIST.getMonth();
    let currentEarnings = 0;
    let prevMonthEarnings = 0;

    try {
      const currentMonthRevenueResult = await Order.aggregate([
        {
          $match: {
            status: 'delivered',
            createdAt: {
              $gte: new Date(Date.UTC(currentYear, currentMonth, 0, 18, 30)),
              $lt: new Date(Date.UTC(currentYear, currentMonth + 1, 0, 18, 30))
            }
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$grandTotal' }
          }
        }
      ]);

      const prevMonthRevenueResult = await Order.aggregate([
        {
          $match: {
            status: 'delivered',
            createdAt: {
              $gte: new Date(Date.UTC(currentYear, currentMonth - 1, 0, 18, 30)),
              $lt: new Date(Date.UTC(currentYear, currentMonth, 0, 18, 30))
            }
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$grandTotal' }
          }
        }
      ]);

      currentEarnings = currentMonthRevenueResult[0]?.revenue || 0;
      prevMonthEarnings = prevMonthRevenueResult[0]?.revenue || 0;
    } catch (error) {
      console.error('Error calculating monthly earnings:', error);
    }

    // Use the target from database if exists
    let monthlyTarget = 0;
    let targetProgress = 0;
    let targetStatus = 'no-target';
    let hasValidTarget = false;

    if (currentMonthTarget) {
      const targetStart = new Date(currentMonthTarget.startDate);
      const targetEnd = new Date(currentMonthTarget.endDate);

      if (nowIST >= targetStart && nowIST <= targetEnd && currentMonthTarget.isActive) {
        hasValidTarget = true;
        monthlyTarget = currentMonthTarget.targetValue;

        if (currentMonthTarget.progress >= 100) {
          targetStatus = 'completed';
        } else if (currentMonthTarget.progress > 0) {
          targetStatus = 'in-progress';
        } else {
          targetStatus = 'not-started';
        }

        if (currentMonthTarget.currentValue !== currentEarnings) {
          try {
            const newProgress = monthlyTarget > 0
              ? (currentEarnings / monthlyTarget * 100)
              : 0;

            let newStatus = currentMonthTarget.status;
            if (newProgress >= 100 && currentMonthTarget.status !== 'completed') {
              newStatus = 'completed';
            } else if (newProgress > 0 && currentMonthTarget.status === 'not-started') {
              newStatus = 'in-progress';
            }

            await Target.findByIdAndUpdate(currentMonthTarget._id, {
              currentValue: currentEarnings,
              progress: newProgress,
              status: newStatus,
              lastUpdatedBy: currentUserId,
              updatedAt: nowIST
            });
          } catch (error) {
            console.error('Error updating target:', error);
          }
        }

        targetProgress = monthlyTarget > 0
          ? (currentEarnings / monthlyTarget * 100)
          : 0;
      }
    }

    const targetIncreaseFromLastMonth = prevMonthEarnings > 0
      ? ((currentEarnings - prevMonthEarnings) / prevMonthEarnings * 100).toFixed(1)
      : currentEarnings > 0 ? 100 : 0;

    // 7. Calculate performance metrics with analytics data
    const totalRevenueValue = totalRevenueAllTime[0]?.total || 0;
    const avgOrderValue = totalOrders > 0
      ? totalRevenueValue / totalOrders
      : 0;

    // Calculate analytics-based metrics
    let totalSessions = 0;
    let totalUniqueVisitors = 0;
    let bouncedSessions = 0;
    let totalSessionDuration = 0;
    let totalPageViews = 0;

    if (analyticsData && analyticsData.length > 0) {
      totalSessions = analyticsData.length;
      totalUniqueVisitors = analyticsData.length; // For now, sessionId = unique visitor

      // Calculate bounce rate (sessions with only 1 page view)
      bouncedSessions = analyticsData.filter(session => session.pageViews === 1).length;

      // Calculate average session duration
      const sessionsWithMultipleViews = analyticsData.filter(session => session.pageViews > 1);
      if (sessionsWithMultipleViews.length > 0) {
        totalSessionDuration = sessionsWithMultipleViews.reduce((sum, session) => {
          const duration = (session.lastView - session.firstView) / 1000; // Convert to seconds
          return sum + Math.min(duration, 1800); // Cap at 30 minutes to avoid outliers
        }, 0);
      }

      // Calculate total page views
      totalPageViews = analyticsData.reduce((sum, session) => sum + session.pageViews, 0);
    }

    // Calculate performance metrics
    const performanceMetrics = {
      // Conversion Rate: User to Order conversion (most relevant for ecommerce)
      conversionRate: totalUsers > 0
        ? parseFloat((totalOrders / totalUsers * 100).toFixed(2))
        : 0,

      // Avg Session Duration: Average time spent per session (in seconds)
      avgSessionDuration: totalSessions > 0
        ? parseFloat((totalSessionDuration / totalSessions).toFixed(0))
        : 0,

      // Bounce Rate: % of single-page sessions
      bounceRate: totalSessions > 0
        ? parseFloat((bouncedSessions / totalSessions * 100).toFixed(1))
        : 0,

      // New Sessions: New registered users (more relevant than just sessions for ecommerce)
      newSessions: newUsersLast30Days,

      // Avg Order Value: Average revenue per order
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),

      // Target Completion Rate: % of completed targets
      targetCompletionRate: targetSummary.totalTargets > 0
        ? parseFloat((targetSummary.completedTargets / targetSummary.totalTargets * 100).toFixed(1))
        : 0,

      // Order Fulfillment Rate: % of delivered orders
      orderFulfillmentRate: totalOrders > 0
        ? parseFloat((deliveredOrders / totalOrders * 100).toFixed(1))
        : 0,

      // Avg Revenue Per User: Average revenue per registered user
      avgRevenuePerUser: totalUsers > 0
        ? parseFloat((totalRevenueValue / totalUsers).toFixed(2))
        : 0,

      // Additional metrics for better insights
      avgPagesPerSession: totalSessions > 0
        ? parseFloat((totalPageViews / totalSessions).toFixed(1))
        : 0,

      visitorToOrderRate: totalUniqueVisitors > 0
        ? parseFloat((totalOrders / totalUniqueVisitors * 100).toFixed(2))
        : 0,

      // Business metrics
      repeatPurchaseRate: 0, // Would need order history per user
      cartAbandonmentRate: 0 // Would need cart tracking
    };

    // 8. Get all revenue targets for the current user
    let allRevenueTargets = [];
    try {
      allRevenueTargets = await Target.find({
        userId: currentUserId,
        targetType: 'revenue',
        isActive: true
      }).sort({ startDate: 1 });
    } catch (error) {
      console.error('Error fetching revenue targets:', error);
    }

    // Prepare target vs actual data for last 6 months
    const targetVsActualData = [];
    try {
      for (let i = 5; i >= 0; i--) {
        const date = toIST();
        date.setMonth(date.getMonth() - i);
        const month = date.getMonth();
        const year = date.getFullYear();
        const monthName = monthNames[month];

        const targetForMonth = allRevenueTargets.find(t => {
          const targetStart = new Date(t.startDate);
          return targetStart.getMonth() === month &&
            targetStart.getFullYear() === year &&
            t.period === 'monthly';
        });

        const actualRevenueForMonth = await Order.aggregate([
          {
            $match: {
              status: 'delivered',
              createdAt: {
                $gte: new Date(Date.UTC(year, month, 0, 18, 30)),
                $lt: new Date(Date.UTC(year, month + 1, 0, 18, 30))
              }
            }
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$grandTotal' }
            }
          }
        ]);

        const actualRevenue = actualRevenueForMonth[0]?.revenue || 0;
        const targetValue = targetForMonth?.targetValue || actualRevenue * 1.15;

        targetVsActualData.push({
          month: monthName,
          actual: actualRevenue,
          target: targetValue,
          progress: targetValue > 0 ? (actualRevenue / targetValue * 100) : 0
        });
      }
    } catch (error) {
      console.error('Error preparing target vs actual data:', error);
    }

    // 9. Get daily active users for last 7 days
    let dailyNewUsers = [];
    try {
      dailyNewUsers = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: sevenDaysAgo },
            role: { $ne: 'admin' }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: '+05:30'
              }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    } catch (error) {
      console.error('Error fetching daily users:', error);
      dailyNewUsers = [];
    }

    // Format daily users data
    const dailyUsersChartData = [];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const date = toIST();
      date.setDate(date.getDate() - i);
      const dayIndex = date.getDay();
      const dayName = weekdays[dayIndex];
      const dateStr = date.toISOString().split('T')[0];
      const dayData = dailyNewUsers.find(d => d._id === dateStr);
      dailyUsersChartData.unshift({
        day: dayName,
        users: dayData ? dayData.count : 0
      });
    }

    // 10. Get recent orders with details
    let recentOrders = [];
    try {
      recentOrders = await Order.find()
        .sort('-createdAt')
        .limit(5)
        .populate('user', 'firstName lastName email')
        .select('orderId user grandTotal status createdAt');
    } catch (error) {
      console.error('Error fetching recent orders:', error);
      recentOrders = [];
    }

    // 11. Get recent users
    let recentUsers = [];
    try {
      recentUsers = await User.find({
        role: { $ne: 'admin' }
      })
        .sort('-createdAt')
        .limit(5)
        .select('firstName lastName email createdAt isActive');

      recentUsers = recentUsers.map(user => {
        const userObj = user.toObject();
        if (userObj.createdAt) {
          const istDate = toIST(userObj.createdAt);
          userObj.createdAt = istDate;
        }
        return userObj;
      });
    } catch (error) {
      console.error('Error fetching recent users:', error);
      recentUsers = [];
    }

    // 12. Prepare response
    const responseData = {
      status: 'success',
      data: {
        // Stats cards data
        stats: [
          {
            title: 'Total Revenue',
            value: `₹${totalRevenueValue.toLocaleString('en-IN')}`,
            change: `${parseFloat(revenueGrowth) >= 0 ? '+' : ''}${revenueGrowth}%`,
            icon: 'CurrencyDollarIcon',
            color: 'bg-green-500',
            valueRaw: totalRevenueValue
          },
          {
            title: 'Total Users',
            value: totalUsers.toLocaleString('en-IN'),
            change: `${parseFloat(userGrowth) >= 0 ? '+' : ''}${userGrowth}%`,
            icon: 'UserGroupIcon',
            color: 'bg-blue-500',
            valueRaw: totalUsers
          },
          {
            title: 'Total Orders',
            value: totalOrders.toLocaleString('en-IN'),
            change: `${parseFloat(ordersGrowth) >= 0 ? '+' : ''}${ordersGrowth}%`,
            icon: 'ShoppingCartIcon',
            color: 'bg-purple-500',
            valueRaw: totalOrders
          },
          {
            title: 'Target Progress',
            value: `${targetSummary.avgProgress.toFixed(1)}%`,
            change: targetSummary.avgProgress > 0 ? '+' : '',
            icon: 'TargetIcon',
            color: 'bg-orange-500',
            valueRaw: parseFloat(targetSummary.avgProgress || 0)
          }
        ],

        monthlyTarget: {
          hasTarget: hasValidTarget,
          target: monthlyTarget,
          currentEarnings: currentEarnings,
          progress: parseFloat(targetProgress.toFixed(2)),
          remaining: Math.max(0, monthlyTarget - currentEarnings),
          increaseFromLastMonth: parseFloat(targetIncreaseFromLastMonth),
          todayEarnings: todayRevenue[0]?.total || 0,
          targetStatus: targetStatus,
          targetDetails: hasValidTarget && currentMonthTarget ? {
            id: currentMonthTarget._id,
            name: currentMonthTarget.name,
            period: currentMonthTarget.period,
            startDate: currentMonthTarget.startDate,
            endDate: currentMonthTarget.endDate,
            status: currentMonthTarget.status,
            progress: currentMonthTarget.progress || 0,
            isActive: currentMonthTarget.isActive
          } : null,
          daysElapsed: hasValidTarget ? {
            total: Math.ceil((new Date(currentMonthTarget.endDate) - new Date(currentMonthTarget.startDate)) / (1000 * 60 * 60 * 24)),
            remaining: Math.max(0, Math.ceil((new Date(currentMonthTarget.endDate) - nowIST) / (1000 * 60 * 60 * 24)))
          } : { total: 30, remaining: 30 - nowIST.getDate() }
        },

        // Target statistics
        targetStats: {
          totalTargets: targetSummary.totalTargets,
          activeTargets: targetSummary.activeTargets,
          completedTargets: targetSummary.completedTargets,
          totalTargetValue: targetSummary.totalTargetValue,
          totalAchievedValue: targetSummary.totalAchievedValue,
          overallProgress: targetSummary.totalTargetValue > 0
            ? parseFloat((targetSummary.totalAchievedValue / targetSummary.totalTargetValue * 100).toFixed(1))
            : 0
        },

        // Revenue chart data
        revenueOverview: {
          labels: monthlyRevenueChartData.map(item => item.month),
          datasets: [
            {
              label: 'Revenue',
              data: monthlyRevenueChartData.map(item => item.revenue),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)'
            },
            {
              label: 'Target',
              data: monthlyRevenueChartData.map(item => item.target),
              borderColor: 'rgb(34, 197, 94)',
              borderDash: [5, 5],
              backgroundColor: 'transparent'
            }
          ],
          summary: {
            currentMonth: currentEarnings,
            target: monthlyTarget,
            growth: parseFloat(revenueGrowth),
            avgMonthly: Math.round(totalRevenueValue / Math.max(1, monthlyRevenueChartData.filter(item => item.revenue > 0).length || 12)),
            year: currentYear
          }
        },

        // Target vs Actual chart data
        targetVsActual: {
          labels: targetVsActualData.map(item => item.month),
          actual: targetVsActualData.map(item => item.actual),
          target: targetVsActualData.map(item => item.target),
          progress: targetVsActualData.map(item => item.progress)
        },

        // Recent orders data
        recentOrders: recentOrders.map(order => ({
          id: order._id,
          orderNumber: order.orderId,
          customer: order.user ? `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() : 'Unknown',
          email: order.user?.email || 'N/A',
          amount: order.grandTotal,
          status: order.status,
          date: order.createdAt
        })),

        // User growth progress data
        userGrowthProgress: {
          labels: dailyUsersChartData.map(item => item.day),
          data: dailyUsersChartData.map(item => item.users),
          weeklyGrowth: userGrowth,
          newUsersThisWeek: dailyUsersChartData.reduce((acc, curr) => acc + curr.users, 0),
          conversionRate: totalUsers > 0 ? parseFloat((totalOrders / totalUsers * 100).toFixed(2)) : 0
        },

        // Recent users data
        recentUsers: recentUsers.map(user => ({
          id: user._id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
          email: user.email,
          status: user.isActive ? 'Active' : 'Inactive',
          joinDate: user.createdAt
        })),

        // Performance metrics - FIXED CALCULATIONS
        performanceMetrics: {
          // Core metrics
          conversionRate: performanceMetrics.conversionRate,
          avgSessionDuration: performanceMetrics.avgSessionDuration,
          bounceRate: performanceMetrics.bounceRate,
          newSessions: performanceMetrics.newSessions,
          avgOrderValue: performanceMetrics.avgOrderValue,
          targetCompletionRate: performanceMetrics.targetCompletionRate,
          orderFulfillmentRate: performanceMetrics.orderFulfillmentRate,
          avgRevenuePerUser: performanceMetrics.avgRevenuePerUser,

          // Analytics metrics
          avgPagesPerSession: performanceMetrics.avgPagesPerSession,
          visitorToOrderRate: performanceMetrics.visitorToOrderRate,

          // Session analytics
          totalSessions: totalSessions,
          totalUniqueVisitors: totalUniqueVisitors,
          totalPageViews: totalPageViews,

          // Formula explanations for transparency
          formulas: {
            conversionRate: '(Total Orders ÷ Total Users) × 100',
            avgOrderValue: 'Total Revenue ÷ Total Orders',
            avgRevenuePerUser: 'Total Revenue ÷ Total Users',
            visitorToOrderRate: '(Total Orders ÷ Unique Visitors) × 100'
          }
        },

        // Raw data
        rawData: {
          totalUsers,
          totalOrders,
          totalProducts,
          totalRevenue: totalRevenueValue,
          pendingOrders,
          deliveredOrders,
          avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
          todayOrders,
          todayRevenue: todayRevenue[0]?.total || 0,
          newUsersLast30Days,
          revenueLast30Days: revenueLast30DaysValue,
          currentYear: currentYear,
          // Analytics raw data
          analytics: {
            totalSessions,
            totalUniqueVisitors,
            bouncedSessions,
            totalPageViews,
            avgSessionDuration: performanceMetrics.avgSessionDuration
          }
        },

        // Target insights
        targetInsights: {
          hasCurrentTarget: hasValidTarget,
          recommendation: hasValidTarget
            ? `You're ${targetProgress >= 100 ? 'exceeding' : 'at'} ${parseFloat(targetProgress.toFixed(1))}% of your monthly target.`
            : 'Set a monthly revenue target to track your performance better.',
          daysRemaining: hasValidTarget
            ? Math.max(0, Math.ceil((new Date(currentMonthTarget.endDate) - nowIST) / (1000 * 60 * 60 * 24)))
            : 30 - nowIST.getDate(),
          dailyTargetNeeded: monthlyTarget > 0
            ? Math.max(0, (monthlyTarget - currentEarnings) / Math.max(1, 30 - nowIST.getDate()))
            : 0,
          onTrack: hasValidTarget ? targetProgress >= ((nowIST.getDate() / 30) * 100) : null,
          paceNeeded: hasValidTarget ? (monthlyTarget - currentEarnings) / Math.max(1, 30 - nowIST.getDate()) : 0,
          expectedCompletion: hasValidTarget && currentEarnings > 0
            ? new Date(Date.now() + ((monthlyTarget - currentEarnings) / (currentEarnings / nowIST.getDate())) * 24 * 60 * 60 * 1000)
            : null
        }
      }
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// @desc    Get admin activities
// @route   GET /api/v1/admin/activities
// @access  Private/Admin
exports.getAdminActivities = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    AdminActivity.find().populate('adminUser', 'firstName lastName email'),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const activities = await features.query.sort('-createdAt');
  const total = await AdminActivity.countDocuments(features.filterQuery);

  res.status(200).json({
    status: 'success',
    results: activities.length,
    total,
    data: {
      activities
    }
  });
});

// @desc    Get system health
// @route   GET /api/v1/admin/health
// @access  Private/Admin
exports.getSystemHealth = catchAsync(async (req, res, next) => {
  // Check database connection
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  }[dbStatus] || 'unknown';

  // Get memory usage
  const memoryUsage = process.memoryUsage();

  // Get uptime
  const uptime = process.uptime();

  // Get recent errors from logs (simplified)
  const errorLogs = [];

  res.status(200).json({
    status: 'success',
    data: {
      database: {
        status: dbStatusText,
        connection: dbStatus === 1 ? 'healthy' : 'unhealthy'
      },
      server: {
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
        }
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }
  });
});

// @desc    Get user statistics
// @route   GET /api/v1/admin/users/stats
// @access  Private/Admin
exports.getUserStatistics = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const matchStage = {};
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const userStats = await User.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        verifiedUsers: {
          $sum: { $cond: [{ $eq: ['$isEmailVerified', true] }, 1, 0] }
        },
        adminUsers: {
          $sum: { $cond: [{ $in: ['$role', ['admin', 'superadmin']] }, 1, 0] }
        },
        customerUsers: {
          $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] }
        }
      }
    }
  ]);

  // Get daily user registrations for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyRegistrations = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats: userStats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        verifiedUsers: 0,
        adminUsers: 0,
        customerUsers: 0
      },
      dailyRegistrations
    }
  });
});

// @desc    Export data
// @route   POST /api/v1/admin/export
// @access  Private/Admin
exports.exportData = catchAsync(async (req, res, next) => {
  const { type, startDate, endDate } = req.body;

  if (!type) {
    return next(new AppError('Export type is required', 400));
  }

  let data;
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  switch (type) {
    case 'orders':
      data = await Order.find(matchStage)
        .populate('user', 'firstName lastName email')
        .populate('items')
        .sort('-createdAt');
      break;

    case 'users':
      data = await User.find(matchStage).select('-password');
      break;

    case 'products':
      data = await Product.find(matchStage)
        .populate('category', 'name')
        .populate('subCategory', 'name');
      break;

    default:
      return next(new AppError('Invalid export type', 400));
  }

  // In a real implementation, you would create Excel/CSV files
  // For now, return JSON
  res.status(200).json({
    status: 'success',
    data: {
      type,
      count: data.length,
      data
    }
  });
});


// @desc    Get all users with pagination, filtering and sorting
// @route   GET /api/v1/admin/users
// @access  Private/Admin
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    sort = '-createdAt', // Default: newest first
    search,
    role,
    status,
    isEmailVerified,
    startDate,
    endDate
  } = req.query;

  console.log('Received role:', role);

  // Build filter object
  const filter = {};

  // Apply role filter if specified
  if (role && role !== 'All') {
    if (role === 'admin') {
      filter.role = { $in: ['admin', 'superadmin'] };
    } else if (role === 'user') {
      // When role=user is passed, show only customer users
      filter.role = 'customer';
    } else {
      filter.role = role;
    }
  } else {
    // When role is undefined or 'All', show all users (including admins)
    // Don't add any role filter
  }

  // Apply status filter if specified
  if (status && status !== 'All') {
    filter.isActive = status === 'Active';
  }

  // Apply email verification filter if specified
  if (isEmailVerified === 'true' || isEmailVerified === 'false') {
    filter.isEmailVerified = isEmailVerified === 'true';
  }

  // Apply date range filter if specified
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  // Apply search filter if specified
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  // Parse sort parameter
  let sortObj = {};
  if (sort) {
    const sortBy = sort.split(',');
    sortBy.forEach(sortItem => {
      const [field, order] = sortItem.startsWith('-')
        ? [sortItem.substring(1), -1]
        : [sortItem, 1];
      sortObj[field] = order;
    });
  }

  // Calculate pagination
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  console.log('Filter object:', JSON.stringify(filter, null, 2));

  // Execute query with pagination
  const users = await User.find(filter)
    .select('-password -__v')
    .sort(sortObj)
    .skip(skip)
    .limit(limitNum);

  // Get total count for pagination metadata
  const total = await User.countDocuments(filter);

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  // Get user statistics for this filtered set
  const statsPipeline = [
    { $match: filter },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        verifiedUsers: {
          $sum: { $cond: [{ $eq: ['$isEmailVerified', true] }, 1, 0] }
        },
        adminUsers: {
          $sum: { $cond: [{ $in: ['$role', ['admin', 'superadmin']] }, 1, 0] }
        },
        customerUsers: {
          $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] }
        },
        managerUsers: {
          $sum: { $cond: [{ $eq: ['$role', 'manager'] }, 1, 0] }
        },
        // New this month
        newThisMonth: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$createdAt', new Date(new Date().getFullYear(), new Date().getMonth(), 1)] },
                  { $lte: ['$createdAt', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)] }
                ]
              },
              1,
              0
            ]
          }
        },
        // New today
        newToday: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$createdAt', new Date().setHours(0, 0, 0, 0)] },
                  { $lte: ['$createdAt', new Date().setHours(23, 59, 59, 999)] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ];

  const stats = await User.aggregate(statsPipeline);

  res.status(200).json({
    status: 'success',
    data: {
      users,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalUsers: total,
        hasNextPage,
        hasPrevPage,
        limit: limitNum,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null
      },
      stats: stats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        verifiedUsers: 0,
        adminUsers: 0,
        customerUsers: 0,
        managerUsers: 0,
        newThisMonth: 0,
        newToday: 0
      },
      filters: {
        search: search || '',
        role: role || '',
        status: status || '',
        startDate: startDate || '',
        endDate: endDate || ''
      }
    }
  });
});

// @desc    Search users with advanced filtering
// @route   GET /api/v1/admin/users/search
// @access  Private/Admin
exports.searchUsers = catchAsync(async (req, res, next) => {
  const {
    search = '',
    role = '',
    status = '',
    isEmailVerified = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 50
  } = req.query;

  // Build filter object
  const filter = {};

  // Apply role filter
  if (role && role !== 'All') {
    if (role === 'admin') {
      filter.role = { $in: ['admin', 'superadmin'] };
    } else {
      filter.role = role;
    }
  } else {
    // Exclude admins by default
    filter.role = { $nin: ['admin', 'superadmin'] };
  }

  // Apply status filter
  if (status && status !== 'All') {
    filter.isActive = status === 'Active';
  }

  // Apply email verification filter
  if (isEmailVerified === 'true' || isEmailVerified === 'false') {
    filter.isEmailVerified = isEmailVerified === 'true';
  }

  // Apply search filter
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      {
        $expr: {
          $regexMatch: {
            input: { $concat: ['$firstName', ' ', '$lastName'] },
            regex: search,
            options: 'i'
          }
        }
      }
    ];
  }

  // Parse sort parameters
  const sortObj = {};
  sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Calculate pagination
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  // Execute query
  const users = await User.find(filter)
    .select('-password -__v')
    .sort(sortObj)
    .skip(skip)
    .limit(limitNum);

  // Get total count
  const total = await User.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    data: {
      users,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        total,
        limit: limitNum
      }
    }
  });
});

// @desc    Get user by ID
// @route   GET /api/v1/admin/users/:id
// @access  Private/Admin
exports.getUserById = catchAsync(async (req, res, next) => {
  const userId = req.params.id;

  /* =========================
     1. USER + CART + WISHLIST
     ========================= */
  const user = await User.findById(userId)
    .select('-password -__v')
    .populate({
      path: 'cart',
      populate: {
        path: 'items',              // Cart → CartItem
        populate: {
          path: 'product',          // CartItem → Product
          select: 'name sellingPrice offerPrice images stockStatus'
        }
      }
    })
    .populate({
      path: 'wishlist',
      select: 'name sellingPrice images'
    });

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  /* =========================
     2. USER ACTIVITY LOG
     ========================= */
  const activityLog = await UserActivityLog.find({ user: userId })
    .sort('-createdAt')
    .limit(50)
    .populate('performedBy', 'firstName lastName email');

  /* =========================
     3. RECENT ORDERS
     ========================= */
  const recentOrders = await Order.find({ user: userId })
    .sort('-createdAt')
    .limit(10)
    .select(
      'orderId grandTotal subtotal discount shippingCharge tax status paymentStatus createdAt shippingAddress items' // Added correct field names
    )
    .populate({
      path: 'items',
      populate: {
        path: 'product',
        select: 'name images sellingPrice' // Make sure 'images' exists in Product schema
      }
    })
    .lean(); // Add .lean() for better performance
  console.log({ recentOrders })

  /* =========================
     4. ORDER STATISTICS
     ========================= */
  const orderStatsAgg = await Order.aggregate([
    { $match: { user: user._id } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$grandTotal' }, // Changed from $totalAmount to $grandTotal
        avgOrderValue: { $avg: '$grandTotal' }, // Changed here too
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        pendingOrders: {
          $sum: {
            $cond: [
              { $in: ['$status', ['pending', 'processing', 'shipped']] },
              1,
              0
            ]
          }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        }
      }
    }
  ]);


  const orderStats = orderStatsAgg[0] || {
    totalOrders: 0,
    totalSpent: 0,
    avgOrderValue: 0,
    completedOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0
  };

  /* =========================
     5. MONTHLY ORDER GRAPH
     ========================= */
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyOrderAgg = await Order.aggregate([
    {
      $match: {
        user: user._id,
        createdAt: { $gte: sixMonthsAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        orderCount: { $sum: 1 },
        totalAmount: { $sum: '$grandTotal' } // Changed from '$totalAmount' to '$grandTotal'
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  const monthlyData = monthlyOrderAgg.map(m => ({
    month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}-01`,
    count: m.orderCount,
    amount: m.totalAmount
  }));

  /* =========================
     6. CATEGORY-WISE SPENDING
     ========================= */
  const categorySpending = await Order.aggregate([
    { $match: { user: user._id } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $lookup: {
        from: 'categories',
        localField: 'product.category',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: '$category' },
    {
      $group: {
        _id: '$category.name',
        totalSpent: {
          $sum: { $multiply: ['$items.quantity', '$items.price'] }
        },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { totalSpent: -1 } }
  ]);

  /* =========================
     7. LOGIN HISTORY
     ========================= */
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const loginHistory = await UserActivityLog.find({
    user: user._id,
    action: 'LOGIN',
    createdAt: { $gte: thirtyDaysAgo }
  })
    .sort('-createdAt')
    .limit(20);

  /* =========================
     8. RECENT WISHLIST ITEMS
     ========================= */
  const wishlistItems = await Product.find({
    _id: { $in: user.wishlist }
  })
    .select('name sellingPrice images category')
    .limit(5)
    .populate('category', 'name');

  /* =========================
     9. ANALYTICS SUMMARY
     ========================= */
  const analytics = {
    orderStats,
    monthlyData,
    categorySpending,
    loginCount: loginHistory.length,
    wishlistCount: user.wishlist.length,
    cartItemsCount: user.cart?.items?.length || 0
  };

  /* =========================
     10. RESPONSE
     ========================= */
  res.status(200).json({
    status: 'success',
    data: {
      user,
      activityLog,
      recentOrders,
      analytics,
      loginHistory,
      wishlistItems
    }
  });
});


// @desc    Create new user
// @route   POST /api/v1/admin/users
// @access  Private/Admin
exports.createUser = catchAsync(async (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    password,
    phone,
    role = 'user',
    isActive = true,
    isEmailVerified = false
  } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('User with this email already exists', 400));
  }

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    role,
    isActive,
    isEmailVerified
  });

  // Remove password from response
  user.password = undefined;
  user.__v = undefined;

  // Log the activity
  await UserActivityLog.create({
    user: user._id,
    action: 'USER_CREATED',
    performedBy: req.user._id,
    details: {
      createdBy: `${req.user.firstName} ${req.user.lastName}`,
      userEmail: user.email,
      role: user.role
    }
  });

  res.status(201).json({
    status: 'success',
    data: {
      user
    }
  });
});

// @desc    Update user
// @route   PUT /api/v1/admin/users/:id
// @access  Private/Admin
exports.updateUser = catchAsync(async (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    role,
    profileImage,
    addresses
  } = req.body;

  // Check if user exists
  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Check if email is being changed and if it's already taken
  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email is already taken', 400));
    }
  }

  // Prepare update data
  const updateData = {};
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (role !== undefined) updateData.role = role;
  if (profileImage !== undefined) updateData.profileImage = profileImage;
  if (addresses !== undefined) updateData.addresses = addresses;

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  ).select('-password -__v');

  // Log the activity
  await UserActivityLog.create({
    user: updatedUser._id,
    action: 'USER_UPDATED',
    performedBy: req.user._id,
    details: {
      updatedBy: `${req.user.firstName} ${req.user.lastName}`,
      updates: Object.keys(updateData)
    }
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

// @desc    Update user status (active/inactive)
// @route   PATCH /api/v1/admin/users/:id/status
// @access  Private/Admin
exports.updateUserStatus = catchAsync(async (req, res, next) => {
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return next(new AppError('isActive must be a boolean', 400));
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Prevent deactivating own account
  if (req.user._id.toString() === req.params.id && !isActive) {
    return next(new AppError('You cannot deactivate your own account', 400));
  }

  // Check for ongoing orders when deactivating user
  if (!isActive) {
    const ongoingOrdersCount = await Order.countDocuments({
      user: req.params.id,
      status: { $nin: ['delivered', 'cancelled', 'returned', 'refunded'] }
    });

    if (ongoingOrdersCount > 0) {
      return next(new AppError(
        `Cannot deactivate user. User has ${ongoingOrdersCount} ongoing order(s). Please complete or cancel these orders first.`,
        400
      ));
    }
  }

  user.isActive = isActive;
  await user.save();

  // Remove sensitive data
  user.password = undefined;
  user.__v = undefined;

  // Log the activity
  await UserActivityLog.create({
    user: user._id,
    action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    performedBy: req.user._id,
    details: {
      changedBy: `${req.user.firstName} ${req.user.lastName}`,
      previousStatus: !isActive,
      newStatus: isActive
    }
  });

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// @desc    Delete user
// @route   DELETE /api/v1/admin/users/:id
// @access  Private/Admin
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Prevent deleting own account
  if (req.user._id.toString() === req.params.id) {
    return next(new AppError('You cannot delete your own account', 400));
  }

  // Prevent deleting admin accounts unless you're a superadmin
  if (user.role === 'admin' && req.user.role !== 'superadmin') {
    return next(new AppError('Only superadmins can delete admin accounts', 403));
  }

  // Check for ongoing orders before deleting user
  const ongoingOrdersCount = await Order.countDocuments({
    user: req.params.id,
    status: { $nin: ['delivered', 'cancelled', 'returned', 'refunded'] }
  });

  if (ongoingOrdersCount > 0) {
    return next(new AppError(
      `Cannot delete user. User has ${ongoingOrdersCount} ongoing order(s). Please complete or cancel these orders first.`,
      400
    ));
  }

  // Log the activity before deletion
  await UserActivityLog.create({
    user: user._id,
    action: 'USER_DELETED',
    performedBy: req.user._id,
    details: {
      deletedBy: `${req.user.firstName} ${req.user.lastName}`,
      userEmail: user.email,
      userRole: user.role
    }
  });

  // Delete user
  await User.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Bulk update users
// @route   PATCH /api/v1/admin/users/bulk-update
// @access  Private/Admin
exports.bulkUpdateUsers = catchAsync(async (req, res, next) => {
  const { userIds, updates } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return next(new AppError('User IDs array is required', 400));
  }

  if (!updates || typeof updates !== 'object') {
    return next(new AppError('Updates object is required', 400));
  }

  // Prevent updating own account status
  if (updates.isActive === false && userIds.includes(req.user._id.toString())) {
    return next(new AppError('You cannot deactivate your own account', 400));
  }

  // Filter out invalid updates
  const allowedUpdates = ['isActive', 'role', 'isEmailVerified'];
  const filteredUpdates = {};

  Object.keys(updates).forEach(key => {
    if (allowedUpdates.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return next(new AppError('No valid updates provided', 400));
  }

  // Update users
  const result = await User.updateMany(
    { _id: { $in: userIds } },
    { $set: filteredUpdates }
  );

  // Log the activity for each user
  for (const userId of userIds) {
    await UserActivityLog.create({
      user: userId,
      action: 'BULK_USER_UPDATE',
      performedBy: req.user._id,
      details: {
        updatedBy: `${req.user.firstName} ${req.user.lastName}`,
        updates: filteredUpdates
      }
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      updates: filteredUpdates
    }
  });
});

// @desc    Get user activity log
// @route   GET /api/v1/admin/users/:id/activity
// @access  Private/Admin
exports.getUserActivity = catchAsync(async (req, res, next) => {
  const { limit = 50 } = req.query;

  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  const activityLog = await UserActivityLog.find({ user: user._id })
    .sort('-createdAt')
    .limit(parseInt(limit, 10))
    .populate('performedBy', 'firstName lastName email');

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
      },
      activityLog
    }
  });
});

// @desc    Export users to CSV/Excel
// @route   GET /api/v1/admin/users/export
// @access  Private/Admin
exports.exportUsers = catchAsync(async (req, res, next) => {
  const {
    format = 'csv',
    startDate,
    endDate,
    role,
    status
  } = req.query;

  // Build filter
  const filter = {};

  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  if (role && role !== 'All') {
    filter.role = role;
  }

  if (status && status !== 'All') {
    filter.isActive = status === 'Active';
  }

  // Get users
  const users = await User.find(filter)
    .select('-password -__v -wishlist -cart')
    .sort('-createdAt');

  // Format data based on requested format
  if (format === 'json') {
    res.status(200).json({
      status: 'success',
      data: {
        type: 'users',
        count: users.length,
        data: users
      }
    });
  } else if (format === 'csv') {
    // In a real implementation, you would use a library like json2csv
    // For now, return JSON with CSV headers
    const csvData = users.map(user => ({
      ID: user._id,
      'First Name': user.firstName,
      'Last Name': user.lastName,
      Email: user.email,
      Phone: user.phone || '',
      Role: user.role,
      Status: user.isActive ? 'Active' : 'Inactive',
      'Email Verified': user.isEmailVerified ? 'Yes' : 'No',
      'Created At': user.createdAt.toISOString(),
      'Last Login': user.lastLogin ? user.lastLogin.toISOString() : 'Never'
    }));

    res.status(200).json({
      status: 'success',
      data: {
        type: 'csv',
        count: users.length,
        headers: Object.keys(csvData[0] || {}),
        data: csvData
      }
    });
  } else {
    return next(new AppError('Invalid export format. Use "json" or "csv"', 400));
  }
});


// @desc    Revenue graph data
// @route   GET /api/v1/admin/
// @access  Private/Admin
exports.getRevenueOverview = catchAsync(async (req, res, next) => {
  try {
    const { period = '6months' } = req.query;
    const currentUserId = req.user.id;

    // Convert to IST timezone (UTC+5:30)
    const getISTDate = () => {
      const now = new Date();
      return new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    };

    const nowIST = getISTDate();
    const currentYear = nowIST.getFullYear();
    const currentMonth = nowIST.getMonth(); // 0-indexed (0 = Jan, 1 = Feb, ...)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let monthsToShow, labels, monthsData;

    // Determine period
    if (period === 'yearly') {
      // YEARLY CASE: Always show current year months (Jan to Dec)
      monthsToShow = 12;
      labels = monthNames; // Jan to Dec
      monthsData = monthNames.map((label, index) => ({
        year: currentYear,
        monthIndex: index,
        label: label,
        displayIndex: index
      }));
    } else {
      // 3 months or 6 months case
      monthsToShow = period === '3months' ? 3 : 6;
      labels = [];
      monthsData = [];

      // Generate labels for the period (most recent months first)
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const date = new Date(nowIST);
        date.setMonth(date.getMonth() - i);

        const year = date.getFullYear();
        const monthIndex = date.getMonth();
        const label = monthNames[monthIndex];

        labels.push(label);
        monthsData.push({
          year: year,
          monthIndex: monthIndex,
          label: label,
          displayIndex: monthsToShow - 1 - i
        });
      }
    }

    // Initialize arrays with zeros
    const revenueData = new Array(monthsToShow).fill(0);
    const targetData = new Array(monthsToShow).fill(0);

    // Get current month's target
    let currentMonthTarget = null;
    try {
      currentMonthTarget = await Target.findOne({
        userId: currentUserId,
        targetType: 'revenue',
        period: 'monthly',
        isActive: true,
        startDate: { $lte: nowIST },
        endDate: { $gte: nowIST }
      }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error fetching current month target:', error);
    }

    // Fetch data for each month in parallel for better performance
    const dataPromises = monthsData.map(async (monthInfo, index) => {
      const { year, monthIndex } = monthInfo;

      // Calculate start and end dates for this month in IST
      const monthStart = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
      const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));

      try {
        // Get revenue for this month
        const revenueResult = await Order.aggregate([
          {
            $match: {
              status: 'delivered',
              createdAt: {
                $gte: monthStart,
                $lt: monthEnd
              }
            }
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$grandTotal' }
            }
          }
        ]);

        let revenue = revenueResult.length > 0 ? revenueResult[0].revenue : 0;

        // Get target for this month
        let targetValue = 0;

        // If this is the current month and we have a target, use it
        if (year === currentYear && monthIndex === currentMonth && currentMonthTarget) {
          targetValue = currentMonthTarget.targetValue;
        } else {
          // Otherwise calculate target as 115% of revenue
          targetValue = Math.round(revenue * 1.15);
        }

        return {
          index: index,
          revenue: revenue,
          target: targetValue
        };

      } catch (error) {
        console.error(`Error fetching data for ${monthInfo.label} ${year}:`, error);
        return {
          index: index,
          revenue: 0,
          target: 0
        };
      }
    });

    // Wait for all promises to resolve
    const results = await Promise.all(dataPromises);

    // Populate the data arrays
    results.forEach(result => {
      revenueData[result.index] = result.revenue;
      targetData[result.index] = result.target;
    });

    // Calculate current month revenue and target
    let currentEarnings = 0;
    let monthlyTarget = 0;

    // Current month start and end in IST
    const currentMonthStart = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
    const currentMonthEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));

    try {
      const currentMonthRevenueResult = await Order.aggregate([
        {
          $match: {
            status: 'delivered',
            createdAt: {
              $gte: currentMonthStart,
              $lt: currentMonthEnd
            }
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$grandTotal' }
          }
        }
      ]);

      currentEarnings = currentMonthRevenueResult[0]?.revenue || 0;

      // Get target for current month
      if (currentMonthTarget) {
        monthlyTarget = currentMonthTarget.targetValue;
      } else {
        monthlyTarget = Math.round(currentEarnings * 1.15);
      }
    } catch (error) {
      console.error('Error calculating current month earnings:', error);
    }

    // Calculate growth based on period
    let revenueGrowth = 0;
    const currentPeriodRevenue = revenueData.reduce((a, b) => a + b, 0);

    try {
      if (period === 'yearly') {
        // For yearly, compare with previous year
        const prevYearStart = new Date(Date.UTC(currentYear - 1, 0, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
        const prevYearEnd = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));

        const prevRevenueResult = await Order.aggregate([
          {
            $match: {
              status: 'delivered',
              createdAt: {
                $gte: prevYearStart,
                $lt: prevYearEnd
              }
            }
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$grandTotal' }
            }
          }
        ]);

        const previousYearRevenue = prevRevenueResult[0]?.revenue || 0;

        if (previousYearRevenue > 0) {
          revenueGrowth = ((currentPeriodRevenue - previousYearRevenue) / previousYearRevenue * 100).toFixed(1);
        } else if (currentPeriodRevenue > 0) {
          revenueGrowth = 100;
        }
      } else {
        // For 3 months or 6 months, compare with previous period
        const prevPeriodMonths = monthsToShow;
        const prevStartDate = new Date(monthsData[0].year, monthsData[0].monthIndex, 1);
        prevStartDate.setMonth(prevStartDate.getMonth() - prevPeriodMonths);

        const prevEndDate = new Date(monthsData[0].year, monthsData[0].monthIndex, 1);

        const prevRevenueResult = await Order.aggregate([
          {
            $match: {
              status: 'delivered',
              createdAt: {
                $gte: new Date(prevStartDate.getTime() - (5.5 * 60 * 60 * 1000)),
                $lt: new Date(prevEndDate.getTime() - (5.5 * 60 * 60 * 1000))
              }
            }
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$grandTotal' }
            }
          }
        ]);

        const previousPeriodRevenue = prevRevenueResult[0]?.revenue || 0;

        if (previousPeriodRevenue > 0) {
          revenueGrowth = ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue * 100).toFixed(1);
        } else if (currentPeriodRevenue > 0) {
          revenueGrowth = 100;
        }
      }
    } catch (error) {
      console.error('Error calculating growth:', error);
    }

    // Calculate average monthly revenue
    const avgMonthly = monthsToShow > 0 ? currentPeriodRevenue / monthsToShow : 0;

    // Prepare response
    const responseData = {
      status: 'success',
      data: {
        revenueOverview: {
          labels: labels,
          datasets: [
            {
              label: 'Revenue',
              data: revenueData,
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)'
            },
            {
              label: 'Target',
              data: targetData,
              borderColor: 'rgb(34, 197, 94)',
              borderDash: [5, 5],
              backgroundColor: 'transparent'
            }
          ],
          summary: {
            currentMonth: currentEarnings,
            target: monthlyTarget,
            growth: parseFloat(revenueGrowth),
            avgMonthly: Math.round(avgMonthly),
            year: currentYear
          }
        }
      }
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error fetching revenue overview:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch revenue overview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Revenue graph data
// @route   GET /api/v1/admin/
// @access  Private/Admin


exports.getUserGrowthProgress = catchAsync(async (req, res, next) => {
  try {
    const { period = '8weeks' } = req.query;
    const getISTDate = () => {
      const now = new Date();
      return new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    };

    const nowIST = getISTDate();

    // Determine number of weeks
    let weeksToShow;
    switch (period) {
      case '4weeks':
        weeksToShow = 4;
        break;
      case '12weeks':
        weeksToShow = 12;
        break;
      case '8weeks':
      default:
        weeksToShow = 8;
    }

    // For "Last X Weeks", we want X complete weeks ending on last Sunday
    // Find last Sunday (end of most recent complete week)
    const lastSunday = new Date(nowIST);
    lastSunday.setDate(lastSunday.getDate() - nowIST.getDay()); // Go back to Sunday
    lastSunday.setHours(23, 59, 59, 999);

    // Calculate start date (X weeks before last Sunday)
    const startDate = new Date(lastSunday);
    startDate.setDate(startDate.getDate() - (weeksToShow * 7) + 1); // Start from Monday of first week

    const labels = [];
    const userGrowthData = [];
    const guestData = [];
    const guestConversionData = [];
    const visitorData = [];
    const conversionData = [];

    // Helper to format week label
    const getWeekLabel = (weekStart, weekEnd) => {
      const formatDate = (date) => {
        return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`;
      };
      return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
    };

    // Calculate each week's data
    for (let i = 0; i < weeksToShow; i++) {
      // Week runs from Monday to Sunday
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (i * 7));

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // End on Sunday (6 days after Monday)
      weekEnd.setHours(23, 59, 59, 999);

      // Adjust for IST
      const weekStartIST = new Date(weekStart.getTime() - (5.5 * 60 * 60 * 1000));
      const weekEndIST = new Date(weekEnd.getTime() - (5.5 * 60 * 60 * 1000));

      labels.push(getWeekLabel(weekStart, weekEnd));

      try {
        // 1. Get new registered users for this week
        const newUsersResult = await User.countDocuments({
          createdAt: {
            $gte: weekStartIST,
            $lte: weekEndIST
          },
          role: { $ne: 'admin' },
          isActive: true
        });

        userGrowthData.push(newUsersResult);

        // 2. Get new guest users for this week
        const newGuestsResult = await GuestUser.countDocuments({
          createdAt: {
            $gte: weekStartIST,
            $lte: weekEndIST
          },
          convertedToUser: false,
          isActive: true
        });

        guestData.push(newGuestsResult);

        // 3. Get guest-to-user conversions for this week
        const convertedGuestsResult = await GuestUser.countDocuments({
          convertedAt: {
            $gte: weekStartIST,
            $lte: weekEndIST
          },
          convertedToUser: true
        });

        guestConversionData.push(convertedGuestsResult);

        // 4. Get unique visitors (sessions) for this week
        const uniqueVisitorsResult = await Analytics.aggregate([
          {
            $match: {
              timestamp: {
                $gte: weekStartIST,
                $lte: weekEndIST
              },
              type: 'page_view'
            }
          },
          {
            $group: {
              _id: '$sessionId'
            }
          },
          {
            $count: "uniqueVisitors"
          }
        ]);

        const totalVisitors = uniqueVisitorsResult[0]?.uniqueVisitors || 0;
        visitorData.push(totalVisitors);

        // 3. Get orders for this week
        const ordersResult = await Order.countDocuments({
          createdAt: {
            $gte: weekStartIST,
            $lte: weekEndIST
          },
          status: { $in: ['delivered', 'processing', 'shipped', 'pending'] }
        });

        // 4. Calculate conversion rate: (Orders / Visitors) × 100
        let conversionRate = 0;
        if (totalVisitors > 0) {
          conversionRate = (ordersResult / totalVisitors) * 100;
        }

        conversionData.push(parseFloat(conversionRate.toFixed(2)));

      } catch (error) {
        console.error(`Error fetching data for week ${i + 1}:`, error);
        userGrowthData.push(0);
        guestData.push(0);
        guestConversionData.push(0);
        visitorData.push(0);
        conversionData.push(0);
      }
    }

    // Calculate overall metrics
    const totalNewUsers = userGrowthData.reduce((a, b) => a + b, 0);
    const totalVisitorsPeriod = visitorData.reduce((a, b) => a + b, 0);
    const totalOrdersPeriod = await Order.countDocuments({
      createdAt: {
        $gte: new Date(startDate.getTime() - (5.5 * 60 * 60 * 1000)),
        $lte: new Date(lastSunday.getTime() - (5.5 * 60 * 60 * 1000))
      },
      status: { $in: ['delivered', 'processing', 'shipped', 'pending'] }
    });

    // Weekly growth percentage - compare last complete week with previous week
    let weeklyGrowth = 0;
    if (userGrowthData.length >= 2) {
      const lastWeekUsers = userGrowthData[userGrowthData.length - 1]; // Week 8 (Dec 25-31)
      const previousWeekUsers = userGrowthData[userGrowthData.length - 2]; // Week 7 (Dec 18-24)

      if (previousWeekUsers > 0) {
        weeklyGrowth = ((lastWeekUsers - previousWeekUsers) / previousWeekUsers * 100);
      } else if (lastWeekUsers > 0) {
        weeklyGrowth = 100; // Growth from 0
      }
    }

    // Overall conversion rate for the period
    const overallConversionRate = totalVisitorsPeriod > 0
      ? (totalOrdersPeriod / totalVisitorsPeriod * 100)
      : 0;

    // Visitor-to-user conversion rate
    const visitorToUserConversion = totalVisitorsPeriod > 0
      ? (totalNewUsers / totalVisitorsPeriod * 100)
      : 0;

    // Most recent week (Week 8 - Dec 25-31)
    const mostRecentWeekIndex = userGrowthData.length - 1;
    const currentWeekNewUsers = userGrowthData[mostRecentWeekIndex] || 0;
    const currentWeekConversion = conversionData[mostRecentWeekIndex] || 0;
    const currentWeekVisitors = visitorData[mostRecentWeekIndex] || 0;

    // Get orders for most recent week
    const mostRecentWeekStart = new Date(startDate);
    mostRecentWeekStart.setDate(mostRecentWeekStart.getDate() + (mostRecentWeekIndex * 7));
    const mostRecentWeekEnd = new Date(mostRecentWeekStart);
    mostRecentWeekEnd.setDate(mostRecentWeekEnd.getDate() + 6);

    const currentWeekOrders = await Order.countDocuments({
      createdAt: {
        $gte: new Date(mostRecentWeekStart.getTime() - (5.5 * 60 * 60 * 1000)),
        $lte: new Date(mostRecentWeekEnd.getTime() - (5.5 * 60 * 60 * 1000))
      }
    });

    // For "This Week" in UI, we should show data for the MOST RECENT WEEK in the chart
    // NOT the current partial week (Jan 1-7)
    const responseData = {
      status: 'success',
      data: {
        userGrowthProgress: {
          // Chart data - shows last X complete weeks
          labels: labels,
          datasets: [
            {
              label: 'New Users',
              data: userGrowthData,
              borderColor: 'rgb(139, 92, 246)',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              fill: true,
              tension: 0.5,
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'Conversion Rate %',
              data: conversionData,
              borderColor: 'rgb(14, 165, 233)',
              backgroundColor: 'transparent',
              borderWidth: 2,
              tension: 0.5,
              yAxisID: "y1",
              pointRadius: 4,
              pointHoverRadius: 6
            }
          ],

          // Summary metrics - refer to MOST RECENT WEEK in chart
          weeklyGrowth: parseFloat(weeklyGrowth.toFixed(1)),
          newUsersThisWeek: currentWeekNewUsers, // Users in most recent week (Dec 25-31)
          conversionRate: parseFloat(overallConversionRate.toFixed(2)), // Overall for period

          summary: {
            totalNewUsers: totalNewUsers,
            totalVisitors: totalVisitorsPeriod,
            totalOrders: totalOrdersPeriod,
            avgWeeklyUsers: Math.round(totalNewUsers / weeksToShow),
            avgWeeklyVisitors: Math.round(totalVisitorsPeriod / weeksToShow),
            visitorToUserRate: parseFloat(visitorToUserConversion.toFixed(2)),
            period: period,
            weeksCount: weeksToShow,
            dateRange: {
              start: startDate.toISOString().split('T')[0],
              end: lastSunday.toISOString().split('T')[0],
              note: 'Complete weeks only (excludes current partial week)'
            },

            // Most recent week details (Week 8 in 8-week view)
            mostRecentWeek: {
              label: labels[labels.length - 1] || '',
              visitors: currentWeekVisitors,
              newUsers: currentWeekNewUsers,
              conversion: currentWeekConversion,
              orders: currentWeekOrders
            }
          }
        }
      }
    };

    console.log('User Growth Data:', {
      period,
      weeksToShow,
      dateRange: `${startDate.toDateString()} to ${lastSunday.toDateString()}`,
      totalNewUsers,
      mostRecentWeek: {
        label: labels[labels.length - 1],
        newUsers: currentWeekNewUsers,
        conversion: currentWeekConversion
      }
    });

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error fetching user growth progress:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user growth data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Additional endpoint for more detailed analytics
exports.getUserConversionDetails = catchAsync(async (req, res, next) => {
  try {
    const getISTDate = () => {
      const now = new Date();
      return new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    };

    const nowIST = getISTDate();
    const thirtyDaysAgo = new Date(nowIST);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get analytics with user conversion tracking
    const analyticsData = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: thirtyDaysAgo },
          type: 'page_view'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $addFields: {
          isRegistered: { $cond: [{ $gt: [{ $size: '$userInfo' }, 0] }, true, false] },
          registeredAt: { $arrayElemAt: ['$userInfo.createdAt', 0] }
        }
      },
      {
        $group: {
          _id: '$sessionId',
          firstVisit: { $min: '$timestamp' },
          lastVisit: { $max: '$timestamp' },
          pageViews: { $sum: 1 },
          isRegistered: { $max: { $cond: ['$isRegistered', 1, 0] } },
          registeredAt: { $first: '$registeredAt' },
          referrer: { $first: '$referrer' },
          userAgent: { $first: '$userAgent' }
        }
      }
    ]);

    // Get orders from registered users
    const registeredUserIds = analyticsData
      .filter(session => session.isRegistered === 1)
      .map(session => session._id);

    const convertingUsers = await Order.distinct('user', {
      createdAt: { $gte: thirtyDaysAgo }
    });

    const responseData = {
      status: 'success',
      data: {
        conversionFunnel: {
          totalSessions: analyticsData.length,
          registeredSessions: analyticsData.filter(s => s.isRegistered === 1).length,
          convertingSessions: convertingUsers.length,
          conversionRate: analyticsData.length > 0
            ? (convertingUsers.length / analyticsData.length * 100).toFixed(2)
            : 0,
          avgSessionDuration: '2m 34s', // You can calculate this from analytics
          bounceRate: '42%' // You can calculate this from analytics
        }
      }
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error fetching conversion details:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch conversion details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Set monthly target for dashboard
// @route   POST /api/v1/admin/dashboard/set-target
// @access  Private/Admin
exports.setMonthlyTarget = catchAsync(async (req, res, next) => {
  try {
    const { targetValue, targetType = 'revenue', description } = req.body;
    const userId = req.user.id;

    if (!targetValue || targetValue <= 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Target value is required and must be greater than 0'
      });
    }

    // Get current month start and end dates
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Check if there's already an active target for this month and type
    const existingTarget = await Target.findOne({
      userId,
      targetType,
      startDate: { $lte: now },
      endDate: { $gte: now },
      status: 'active',
      isActive: true
    });

    let target;

    if (existingTarget) {
      // Update existing target
      existingTarget.targetValue = targetValue;
      if (description) existingTarget.description = description;
      existingTarget.lastUpdatedBy = userId;
      await existingTarget.save();
      target = existingTarget;
    } else {
      // Create new target
      target = await Target.create({
        userId,
        targetType,
        targetValue,
        period: 'monthly',
        startDate,
        endDate,
        currentValue: 0,
        status: 'active',
        isActive: true,
        description: description || `Monthly ${targetType} target for ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        createdBy: userId,
        lastUpdatedBy: userId
      });

      // Calculate current value based on target type
      if (targetType === 'revenue') {
        const revenueData = await Order.aggregate([
          {
            $match: {
              status: 'delivered',
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          { $group: { _id: null, total: { $sum: '$grandTotal' } } }
        ]);
        target.currentValue = revenueData[0]?.total || 0;
      } else if (targetType === 'orders') {
        target.currentValue = await Order.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }
        });
      } else if (targetType === 'users') {
        target.currentValue = await User.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
          role: { $ne: 'admin' }
        });
      }

      await target.save();
    }

    res.status(existingTarget ? 200 : 201).json({
      status: 'success',
      message: existingTarget ? 'Target updated successfully' : 'Target created successfully',
      data: {
        target: {
          id: target._id,
          targetType: target.targetType,
          targetValue: target.targetValue,
          currentValue: target.currentValue,
          progress: target.progress,
          period: target.period,
          startDate: target.startDate,
          endDate: target.endDate,
          status: target.status,
          daysRemaining: target.daysRemaining,
          achievementPercentage: target.achievementPercentage
        }
      }
    });

  } catch (error) {
    console.error('Error setting monthly target:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to set monthly target',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get monthly target for dashboard
// @route   GET /api/v1/admin/dashboard/monthly-target
// @access  Private/Admin
exports.getMonthlyTarget = catchAsync(async (req, res, next) => {
  try {
    const { targetType = 'revenue' } = req.query;
    const userId = req.user.id;

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get current month target
    let target = await Target.findOne({
      userId,
      targetType,
      startDate: { $lte: now },
      endDate: { $gte: now },
      status: 'active',
      isActive: true
    });

    if (!target) {
      return res.status(200).json({
        status: 'success',
        data: {
          target: null,
          message: 'No target set for this month'
        }
      });
    }

    // Update current value based on target type
    if (targetType === 'revenue') {
      const revenueData = await Order.aggregate([
        {
          $match: {
            status: 'delivered',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]);
      target.currentValue = revenueData[0]?.total || 0;
    } else if (targetType === 'orders') {
      target.currentValue = await Order.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });
    } else if (targetType === 'users') {
      target.currentValue = await User.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        role: { $ne: 'admin' }
      });
    }

    await target.save();

    res.status(200).json({
      status: 'success',
      data: {
        target: {
          id: target._id,
          targetType: target.targetType,
          targetValue: target.targetValue,
          currentValue: target.currentValue,
          progress: target.progress,
          period: target.period,
          startDate: target.startDate,
          endDate: target.endDate,
          status: target.status,
          daysRemaining: target.daysRemaining,
          achievementPercentage: target.achievementPercentage,
          periodLabel: target.periodLabel
        }
      }
    });

  } catch (error) {
    console.error('Error getting monthly target:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get monthly target',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get recent orders for dashboard
// @route   GET /api/v1/admin/dashboard/recent-orders
// @access  Private/Admin
exports.getRecentOrders = catchAsync(async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'firstName lastName email profileImage')
      .select('orderNumber status grandTotal paymentStatus shippingStatus createdAt items');

    res.status(200).json({
      status: 'success',
      results: recentOrders.length,
      data: {
        orders: recentOrders
      }
    });

  } catch (error) {
    console.error('Error getting recent orders:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get recent orders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get recent users for dashboard
// @route   GET /api/v1/admin/dashboard/recent-users
// @access  Private/Admin
exports.getRecentUsers = catchAsync(async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const recentUsers = await User.find({ role: { $ne: 'admin' } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('firstName lastName email profileImage createdAt isActive lastLogin');

    // Get order counts for each user
    const usersWithStats = await Promise.all(
      recentUsers.map(async (user) => {
        const orderCount = await Order.countDocuments({ user: user._id });
        const totalSpent = await Order.aggregate([
          { $match: { user: user._id, status: 'delivered' } },
          { $group: { _id: null, total: { $sum: '$grandTotal' } } }
        ]);

        return {
          ...user.toObject(),
          orderCount,
          totalSpent: totalSpent[0]?.total || 0
        };
      })
    );

    res.status(200).json({
      status: 'success',
      results: usersWithStats.length,
      data: {
        users: usersWithStats
      }
    });

  } catch (error) {
    console.error('Error getting recent users:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get recent users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get performance metrics for dashboard
// @route   GET /api/v1/admin/dashboard/performance-metrics
// @access  Private/Admin
exports.getPerformanceMetrics = catchAsync(async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get order metrics
    const [
      totalOrdersLast30Days,
      totalOrdersPrev30Days,
      deliveredOrdersLast30Days,
      avgOrderValue,
      revenueByPaymentMethod
    ] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Order.countDocuments({ createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      Order.countDocuments({ status: 'delivered', createdAt: { $gte: thirtyDaysAgo } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, avgValue: { $avg: '$grandTotal' } } }
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$paymentMethod', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
      ])
    ]);

    // Calculate fulfillment rate
    const fulfillmentRate = totalOrdersLast30Days > 0
      ? ((deliveredOrdersLast30Days / totalOrdersLast30Days) * 100).toFixed(2)
      : 0;

    // Calculate order growth
    const orderGrowth = totalOrdersPrev30Days > 0
      ? (((totalOrdersLast30Days - totalOrdersPrev30Days) / totalOrdersPrev30Days) * 100).toFixed(2)
      : 0;

    // Get product metrics
    const totalProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({
      isActive: true,
      stock: { $lte: 10, $gt: 0 }
    });
    const outOfStockProducts = await Product.countDocuments({
      isActive: true,
      stock: 0
    });

    // Get user metrics
    const newUsersLast30Days = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      role: { $ne: 'admin' }
    });
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: thirtyDaysAgo },
      role: { $ne: 'admin' }
    });

    res.status(200).json({
      status: 'success',
      data: {
        orders: {
          totalOrders: totalOrdersLast30Days,
          orderGrowth: parseFloat(orderGrowth),
          fulfillmentRate: parseFloat(fulfillmentRate),
          avgOrderValue: avgOrderValue[0]?.avgValue?.toFixed(2) || 0,
          revenueByPaymentMethod
        },
        products: {
          totalProducts,
          lowStockProducts,
          outOfStockProducts,
          healthyStockRate: totalProducts > 0
            ? (((totalProducts - lowStockProducts - outOfStockProducts) / totalProducts) * 100).toFixed(2)
            : 100
        },
        users: {
          newUsers: newUsersLast30Days,
          activeUsers,
          engagementRate: newUsersLast30Days > 0
            ? ((activeUsers / newUsersLast30Days) * 100).toFixed(2)
            : 0
        }
      }
    });

  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get performance metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


