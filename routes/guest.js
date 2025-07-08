const express = require("express");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const auth = require("./auth");

const router = express.Router();

// Public routes for property browsing
router.get("/properties", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      sort = "newest",
      category,
      propertyType,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      city,
      country,
      listingType,
      rentalPeriod,
      amenities,
      locationFeatures,
    } = req.query;

    // Build filter conditions
    const where = { isAvailable: true };

    if (category) {
      where.categoryId = parseInt(category);
    }

    if (propertyType) {
      where.propertyTypeId = parseInt(propertyType);
    }

    if (minPrice) {
      where.price = { ...where.price, gte: parseFloat(minPrice) };
    }

    if (maxPrice) {
      where.price = { ...where.price, lte: parseFloat(maxPrice) };
    }

    if (bedrooms) {
      where.bedrooms = { gte: parseInt(bedrooms) };
    }

    if (bathrooms) {
      where.bathrooms = { gte: parseInt(bathrooms) };
    }

    if (city) {
      where.city = { contains: city };
    }

    if (country) {
      where.country = country;
    }

    if (listingType && ["RENT", "SALE"].includes(listingType)) {
      where.listingType = listingType;
    }

    if (rentalPeriod && ["DAY", "MONTH", "YEAR"].includes(rentalPeriod)) {
      where.rentalPeriod = rentalPeriod;
    }

    // Handle amenities filter (array of IDs)
    if (amenities) {
      const amenityIds = Array.isArray(amenities)
        ? amenities.map((id) => parseInt(id))
        : [parseInt(amenities)];

      where.amenities = {
        some: {
          id: { in: amenityIds },
        },
      };
    }

    // Handle location features filter (array of IDs)
    if (locationFeatures) {
      const featureIds = Array.isArray(locationFeatures)
        ? locationFeatures.map((id) => parseInt(id))
        : [parseInt(locationFeatures)];

      where.locationFeatures = {
        some: {
          id: { in: featureIds },
        },
      };
    }

    // Determine sorting
    let orderBy = {};
    switch (sort) {
      case "price_low":
        orderBy = { price: "asc" };
        break;
      case "price_high":
        orderBy = { price: "desc" };
        break;
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Get total count for pagination
    const total = await prisma.property.count({ where });

    // Get properties
    const properties = await prisma.property.findMany({
      where,
      include: {
        category: true,
        propertyType: true,
        amenities: true,
        locationFeatures: true,
        host: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            isVerified: true,
          },
        },
        images: {
          where: { isFeatured: true },
          take: 1,
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
      orderBy,
      skip,
      take,
    });

    // Calculate average ratings
    const propertiesWithRatings = await Promise.all(
      properties.map(async (property) => {
        const reviews = await prisma.review.findMany({
          where: { propertyId: property.id },
          select: { rating: true },
        });

        const averageRating =
          reviews.length > 0
            ? reviews.reduce((sum, review) => sum + review.rating, 0) /
              reviews.length
            : null;

        return {
          ...property,
          averageRating,
        };
      }),
    );

    res.json({
      properties: propertiesWithRatings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get property details by slug
router.get("/properties/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const property = await prisma.property.findUnique({
      where: { slug },
      include: {
        category: true,
        propertyType: true,
        amenities: true,
        locationFeatures: true,
        images: true,
        host: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            bio: true,
            isVerified: true,
            createdAt: true,
            _count: {
              select: {
                properties: true,
              },
            },
          },
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Calculate average rating
    const averageRating =
      property.reviews.length > 0
        ? property.reviews.reduce((sum, review) => sum + review.rating, 0) /
          property.reviews.length
        : null;

    // Get similar properties
    const similarProperties = await prisma.property.findMany({
      where: {
        OR: [
          { categoryId: property.categoryId },
          { propertyTypeId: property.propertyTypeId },
        ],
        NOT: { id: property.id },
        isAvailable: true,
      },
      include: {
        images: {
          where: { isFeatured: true },
          take: 1,
        },
      },
      take: 4,
    });

    res.json({
      property: {
        ...property,
        averageRating,
      },
      similarProperties,
    });
  } catch (error) {
    console.error("Error fetching property details:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get property availability
router.get("/properties/:id/availability", async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Start and end dates are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check if property exists and is available
    const property = await prisma.property.findUnique({
      where: { id: parseInt(id) },
      select: {
        isAvailable: true,
        availableFrom: true,
        availableTo: true,
      },
    });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (!property.isAvailable) {
      return res.json({
        available: false,
        message: "Property is not available",
      });
    }

    // Check if requested dates are within property's available range
    if (property.availableFrom && start < property.availableFrom) {
      return res.json({
        available: false,
        message: `Property is only available from ${
          property.availableFrom.toISOString().split("T")[0]
        }`,
      });
    }

    if (property.availableTo && end > property.availableTo) {
      return res.json({
        available: false,
        message: `Property is only available until ${
          property.availableTo.toISOString().split("T")[0]
        }`,
      });
    }

    // Check for existing bookings in the requested date range
    const existingBookings = await prisma.booking.findMany({
      where: {
        propertyId: parseInt(id),
        status: { in: ["pending", "confirmed"] },
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
    });

    if (existingBookings.length > 0) {
      return res.json({
        available: false,
        message: "Property is already booked for the selected dates",
        conflictingDates: existingBookings.map((booking) => ({
          startDate: booking.startDate,
          endDate: booking.endDate,
        })),
      });
    }

    res.json({ available: true });
  } catch (error) {
    console.error("Error checking property availability:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Protected routes (require authentication)

// Create booking
router.post("/bookings", auth.isAuthenticated, async (req, res) => {
  try {
    const { propertyId, startDate, endDate, guestCount } = req.body;

    if (!propertyId || !startDate || !endDate || !guestCount) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if property exists and is available
    const property = await prisma.property.findUnique({
      where: { id: parseInt(propertyId) },
    });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (!property.isAvailable) {
      return res.status(400).json({ message: "Property is not available" });
    }

    // Prevent booking your own property
    if (property.hostId === req.user.id) {
      return res
        .status(400)
        .json({ message: "You cannot book your own property" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (start >= end) {
      return res
        .status(400)
        .json({ message: "End date must be after start date" });
    }

    if (start < new Date()) {
      return res
        .status(400)
        .json({ message: "Start date cannot be in the past" });
    }

    // Check if property is available for the requested dates
    const existingBookings = await prisma.booking.findMany({
      where: {
        propertyId: parseInt(propertyId),
        status: { in: ["pending", "confirmed"] },
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
    });

    if (existingBookings.length > 0) {
      return res
        .status(400)
        .json({ message: "Property is already booked for the selected dates" });
    }

    // Calculate total price based on property price and rental period
    let totalPrice = property.price;
    const diffTime = Math.abs(end - start);
    let days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (days === 0) days = 1; // Minimum 1 day

    switch (property.rentalPeriod) {
      case "DAY":
        totalPrice = property.price * days;
        break;
      case "MONTH":
        totalPrice = property.price * (days / 30);
        break;
      case "YEAR":
        totalPrice = property.price * (days / 365);
        break;
      default:
        totalPrice = property.price;
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        propertyId: parseInt(propertyId),
        guestId: req.user.id,
        startDate: start,
        endDate: end,
        guestCount: parseInt(guestCount),
        totalPrice,
        status: "pending",
        paymentStatus: "unpaid",
      },
      include: {
        property: {
          select: {
            title: true,
            slug: true,
            hostId: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get user's bookings
router.get("/bookings", auth.isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    // Build query
    const where = { guestId: userId };

    // Filter by status if provided
    if (
      status &&
      ["pending", "confirmed", "cancelled", "completed"].includes(status)
    ) {
      where.status = status;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            slug: true,
            address: true,
            city: true,
            country: true,
            images: {
              where: { isFeatured: true },
              take: 1,
            },
            host: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(bookings);
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Cancel booking
router.put("/bookings/:id/cancel", auth.isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if booking exists and belongs to the user
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        property: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.guestId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to cancel this booking" });
    }

    if (booking.status !== "pending" && booking.status !== "confirmed") {
      return res
        .status(400)
        .json({
          message: `Cannot cancel a booking with status: ${booking.status}`,
        });
    }

    // Check if cancellation is allowed (e.g., not within 24 hours of start date)
    const now = new Date();
    const startDate = new Date(booking.startDate);
    const hoursUntilStart = (startDate - now) / (1000 * 60 * 60);

    if (hoursUntilStart < 24) {
      return res.status(400).json({
        message:
          "Cancellations must be made at least 24 hours before the booking start date",
      });
    }

    // Update booking status
    const updatedBooking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: { status: "cancelled" },
    });

    res.json({
      message: `Booking for ${booking.property.title} has been cancelled`,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add review
router.post("/reviews", auth.isAuthenticated, async (req, res) => {
  try {
    const { bookingId, propertyId, rating, comment } = req.body;

    if (!bookingId || !propertyId || !rating) {
      return res
        .status(400)
        .json({ message: "Booking ID, property ID, and rating are required" });
    }

    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    // Check if booking exists and belongs to the user
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.guestId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to review this booking" });
    }

    if (booking.propertyId !== parseInt(propertyId)) {
      return res
        .status(400)
        .json({ message: "Booking and property do not match" });
    }

    if (booking.status !== "completed") {
      return res
        .status(400)
        .json({ message: "Can only review completed bookings" });
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: { bookingId: parseInt(bookingId) },
    });

    if (existingReview) {
      return res
        .status(400)
        .json({ message: "Review already exists for this booking" });
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        bookingId: parseInt(bookingId),
        propertyId: parseInt(propertyId),
        userId: req.user.id,
        rating: parseInt(rating),
        comment,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Review submitted successfully",
      review,
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Wishlist routes
router.get("/wishlists", auth.isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;

    const wishlists = await prisma.wishlist.findMany({
      where: { userId },
      include: {
        properties: {
          include: {
            images: {
              where: { isFeatured: true },
              take: 1,
            },
          },
        },
        _count: {
          select: {
            properties: true,
          },
        },
      },
    });

    res.json(wishlists);
  } catch (error) {
    console.error("Error fetching wishlists:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/wishlists", auth.isAuthenticated, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Wishlist name is required" });
    }

    // Check if wishlist with the same name already exists
    const existingWishlist = await prisma.wishlist.findUnique({
      where: {
        userId_name: {
          userId: req.user.id,
          name,
        },
      },
    });

    if (existingWishlist) {
      return res
        .status(409)
        .json({ message: "Wishlist with this name already exists" });
    }

    const wishlist = await prisma.wishlist.create({
      data: {
        name,
        userId: req.user.id,
      },
    });

    res.status(201).json({
      message: "Wishlist created successfully",
      wishlist,
    });
  } catch (error) {
    console.error("Error creating wishlist:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/wishlists/:id", auth.isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Wishlist name is required" });
    }

    // Check if wishlist exists and belongs to the user
    const wishlist = await prisma.wishlist.findUnique({
      where: { id: parseInt(id) },
    });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    if (wishlist.userId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this wishlist" });
    }

    // Check if new name conflicts with existing wishlist
    if (name !== wishlist.name) {
      const existingWishlist = await prisma.wishlist.findUnique({
        where: {
          userId_name: {
            userId: req.user.id,
            name,
          },
        },
      });

      if (existingWishlist) {
        return res
          .status(409)
          .json({ message: "Wishlist with this name already exists" });
      }
    }

    const updatedWishlist = await prisma.wishlist.update({
      where: { id: parseInt(id) },
      data: { name },
    });

    res.json({
      message: "Wishlist updated successfully",
      wishlist: updatedWishlist,
    });
  } catch (error) {
    console.error("Error updating wishlist:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/wishlists/:id", auth.isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if wishlist exists and belongs to the user
    const wishlist = await prisma.wishlist.findUnique({
      where: { id: parseInt(id) },
    });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    if (wishlist.userId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this wishlist" });
    }

    await prisma.wishlist.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Wishlist deleted successfully" });
  } catch (error) {
    console.error("Error deleting wishlist:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add property to wishlist
router.post(
  "/wishlists/:id/properties",
  auth.isAuthenticated,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { propertyId } = req.body;

      if (!propertyId) {
        return res.status(400).json({ message: "Property ID is required" });
      }

      // Check if wishlist exists and belongs to the user
      const wishlist = await prisma.wishlist.findUnique({
        where: { id: parseInt(id) },
      });

      if (!wishlist) {
        return res.status(404).json({ message: "Wishlist not found" });
      }

      if (wishlist.userId !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Not authorized to update this wishlist" });
      }

      // Check if property exists
      const property = await prisma.property.findUnique({
        where: { id: parseInt(propertyId) },
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Check if property is already in wishlist
      const isPropertyInWishlist = await prisma.wishlist.findFirst({
        where: {
          id: parseInt(id),
          properties: {
            some: {
              id: parseInt(propertyId),
            },
          },
        },
      });

      if (isPropertyInWishlist) {
        return res
          .status(400)
          .json({ message: "Property is already in wishlist" });
      }

      // Add property to wishlist
      await prisma.wishlist.update({
        where: { id: parseInt(id) },
        data: {
          properties: {
            connect: {
              id: parseInt(propertyId),
            },
          },
        },
      });

      res.json({ message: "Property added to wishlist successfully" });
    } catch (error) {
      console.error("Error adding property to wishlist:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Remove property from wishlist
router.delete(
  "/wishlists/:id/properties/:propertyId",
  auth.isAuthenticated,
  async (req, res) => {
    try {
      const { id, propertyId } = req.params;

      // Check if wishlist exists and belongs to the user
      const wishlist = await prisma.wishlist.findUnique({
        where: { id: parseInt(id) },
      });

      if (!wishlist) {
        return res.status(404).json({ message: "Wishlist not found" });
      }

      if (wishlist.userId !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Not authorized to update this wishlist" });
      }

      // Remove property from wishlist
      await prisma.wishlist.update({
        where: { id: parseInt(id) },
        data: {
          properties: {
            disconnect: {
              id: parseInt(propertyId),
            },
          },
        },
      });

      res.json({ message: "Property removed from wishlist successfully" });
    } catch (error) {
      console.error("Error removing property from wishlist:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
