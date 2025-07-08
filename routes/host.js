const express = require("express");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const auth = require("./auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const slugify = require("slugify");

const router = express.Router();

// Middleware to ensure user is host or admin
const isHostOrAdmin = auth.hasRole(["HOST", "ADMIN"]);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/properties");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(
      new Error(
        "Error: File upload only supports images (jpeg, jpg, png, webp)",
      ),
    );
  },
});

// Get host's properties
router.get(
  "/properties",
  auth.isAuthenticated,
  isHostOrAdmin,
  async (req, res) => {
    try {
      const userId = req.user.id;

      // If admin, allow filtering by hostId
      const hostId =
        req.user.role === "ADMIN" && req.query.hostId
          ? parseInt(req.query.hostId)
          : userId;

      const properties = await prisma.property.findMany({
        where: { hostId },
        include: {
          category: true,
          propertyType: true,
          amenities: true,
          locationFeatures: true,
          images: {
            where: { isFeatured: true },
            take: 1,
          },
          _count: {
            select: {
              bookings: true,
              reviews: true,
              wishlist: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(properties);
    } catch (error) {
      console.error("Error fetching host properties:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Get single property details (for editing)
router.get(
  "/properties/:id",
  auth.isAuthenticated,
  isHostOrAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const property = await prisma.property.findUnique({
        where: { id: parseInt(id) },
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
              email: true,
            },
          },
        },
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Check if user is the host or admin
      if (property.hostId !== userId && req.user.role !== "ADMIN") {
        return res
          .status(403)
          .json({ message: "Not authorized to view this property" });
      }

      res.json(property);
    } catch (error) {
      console.error("Error fetching property details:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Create new property
router.post(
  "/properties",
  auth.isAuthenticated,
  isHostOrAdmin,
  async (req, res) => {
    try {
      const {
        title,
        description,
        price,
        listingType,
        rentalPeriod,
        bedrooms,
        bathrooms,
        area,
        address,
        city,
        state,
        country,
        zipCode,
        latitude,
        longitude,
        categoryId,
        propertyTypeId,
        amenityIds,
        locationFeatureIds,
        availableFrom,
        availableTo,
      } = req.body;

      // Basic validation
      if (
        !title ||
        !description ||
        !price ||
        !listingType ||
        !address ||
        !city ||
        !country
      ) {
        return res.status(400).json({ message: "Required fields missing" });
      }

      if (listingType === "RENT" && !rentalPeriod) {
        return res
          .status(400)
          .json({ message: "Rental period is required for rentals" });
      }

      // Create slug from title
      let slug = slugify(title, {
        lower: true,
        strict: true,
      });

      // Check if slug exists, if so, append random string
      const existingSlug = await prisma.property.findUnique({
        where: { slug },
      });

      if (existingSlug) {
        slug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
      }

      // Create property
      const property = await prisma.property.create({
        data: {
          title,
          slug,
          description,
          price: parseFloat(price),
          listingType,
          rentalPeriod: listingType === "RENT" ? rentalPeriod : null,
          bedrooms: bedrooms ? parseInt(bedrooms) : null,
          bathrooms: bathrooms ? parseInt(bathrooms) : null,
          area: area ? parseFloat(area) : null,
          address,
          city,
          state,
          country,
          zipCode,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          hostId: req.user.id,
          categoryId: parseInt(categoryId),
          propertyTypeId: parseInt(propertyTypeId),
          availableFrom: availableFrom ? new Date(availableFrom) : null,
          availableTo: availableTo ? new Date(availableTo) : null,
          amenities: amenityIds
            ? {
                connect: amenityIds.map((id) => ({ id: parseInt(id) })),
              }
            : undefined,
          locationFeatures: locationFeatureIds
            ? {
                connect: locationFeatureIds.map((id) => ({ id: parseInt(id) })),
              }
            : undefined,
        },
      });

      res.status(201).json({
        message: "Property created successfully",
        property,
      });
    } catch (error) {
      console.error("Error creating property:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Update property
router.put(
  "/properties/:id",
  auth.isAuthenticated,
  isHostOrAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        price,
        listingType,
        rentalPeriod,
        bedrooms,
        bathrooms,
        area,
        address,
        city,
        state,
        country,
        zipCode,
        latitude,
        longitude,
        categoryId,
        propertyTypeId,
        amenityIds,
        locationFeatureIds,
        isAvailable,
        availableFrom,
        availableTo,
      } = req.body;

      // Check if property exists and belongs to the user
      const existingProperty = await prisma.property.findUnique({
        where: { id: parseInt(id) },
        select: { hostId: true },
      });

      if (!existingProperty) {
        return res.status(404).json({ message: "Property not found" });
      }

      if (
        existingProperty.hostId !== req.user.id &&
        req.user.role !== "ADMIN"
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to update this property" });
      }

      // Update property
      const property = await prisma.property.update({
        where: { id: parseInt(id) },
        data: {
          title,
          description,
          price: price ? parseFloat(price) : undefined,
          listingType,
          rentalPeriod: listingType === "RENT" ? rentalPeriod : null,
          bedrooms: bedrooms ? parseInt(bedrooms) : null,
          bathrooms: bathrooms ? parseInt(bathrooms) : null,
          area: area ? parseFloat(area) : null,
          address,
          city,
          state,
          country,
          zipCode,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          categoryId: categoryId ? parseInt(categoryId) : undefined,
          propertyTypeId: propertyTypeId ? parseInt(propertyTypeId) : undefined,
          isAvailable: isAvailable !== undefined ? isAvailable : undefined,
          availableFrom: availableFrom ? new Date(availableFrom) : null,
          availableTo: availableTo ? new Date(availableTo) : null,
          amenities: amenityIds
            ? {
                set: amenityIds.map((id) => ({ id: parseInt(id) })),
              }
            : undefined,
          locationFeatures: locationFeatureIds
            ? {
                set: locationFeatureIds.map((id) => ({ id: parseInt(id) })),
              }
            : undefined,
        },
      });

      res.json({
        message: "Property updated successfully",
        property,
      });
    } catch (error) {
      console.error("Error updating property:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Delete property
router.delete(
  "/properties/:id",
  auth.isAuthenticated,
  isHostOrAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if property exists and belongs to the user
      const existingProperty = await prisma.property.findUnique({
        where: { id: parseInt(id) },
        select: { hostId: true },
      });

      if (!existingProperty) {
        return res.status(404).json({ message: "Property not found" });
      }

      if (
        existingProperty.hostId !== req.user.id &&
        req.user.role !== "ADMIN"
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete this property" });
      }

      // Check if property has bookings
      const bookingsCount = await prisma.booking.count({
        where: { propertyId: parseInt(id) },
      });

      if (bookingsCount > 0) {
        return res.status(400).json({
          message: "Cannot delete property with existing bookings",
        });
      }

      // Delete property images first
      const images = await prisma.propertyImage.findMany({
        where: { propertyId: parseInt(id) },
      });

      // Delete image files from disk
      for (const image of images) {
        const imagePath = path.join(
          __dirname,
          "../uploads/properties",
          path.basename(image.url),
        );
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      // Delete property and related records
      await prisma.$transaction([
        prisma.propertyImage.deleteMany({
          where: { propertyId: parseInt(id) },
        }),
        prisma.property.delete({
          where: { id: parseInt(id) },
        }),
      ]);

      res.json({ message: "Property deleted successfully" });
    } catch (error) {
      console.error("Error deleting property:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Upload property images
router.post(
  "/properties/:id/images",
  auth.isAuthenticated,
  isHostOrAdmin,
  upload.array("images", 10), // Allow up to 10 images
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isFeatured } = req.body;

      // Check if property exists and belongs to the user
      const property = await prisma.property.findUnique({
        where: { id: parseInt(id) },
        select: { hostId: true },
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      if (property.hostId !== req.user.id && req.user.role !== "ADMIN") {
        return res
          .status(403)
          .json({ message: "Not authorized to update this property" });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No images uploaded" });
      }

      // Get current image count
      const currentImagesCount = await prisma.propertyImage.count({
        where: { propertyId: parseInt(id) },
      });

      // Check if adding these images would exceed the limit
      if (currentImagesCount + req.files.length > 20) {
        return res.status(400).json({
          message: "Maximum of 20 images allowed per property",
        });
      }

      // If this is the first image or isFeatured is true, set as featured
      let shouldSetFeatured = isFeatured === "true";

      // If this is the first image, always set as featured
      if (currentImagesCount === 0) {
        shouldSetFeatured = true;
      }

      // If setting a new featured image, unset the current featured image
      if (shouldSetFeatured) {
        await prisma.propertyImage.updateMany({
          where: {
            propertyId: parseInt(id),
            isFeatured: true,
          },
          data: { isFeatured: false },
        });
      }

      // Create image records
      const imagePromises = req.files.map((file, index) => {
        const imageUrl = `/uploads/properties/${file.filename}`;

        return prisma.propertyImage.create({
          data: {
            url: imageUrl,
            propertyId: parseInt(id),
            isFeatured: shouldSetFeatured && index === 0, // Only set the first image as featured if requested
          },
        });
      });

      const images = await Promise.all(imagePromises);

      res.status(201).json({
        message: "Images uploaded successfully",
        images,
      });
    } catch (error) {
      console.error("Error uploading images:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Delete property image
router.delete(
  "/properties/:propertyId/images/:imageId",
  auth.isAuthenticated,
  isHostOrAdmin,
  async (req, res) => {
    try {
      const { propertyId, imageId } = req.params;

      // Check if property exists and belongs to the user
      const property = await prisma.property.findUnique({
        where: { id: parseInt(propertyId) },
        select: { hostId: true },
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      if (property.hostId !== req.user.id && req.user.role !== "ADMIN") {
        return res
          .status(403)
          .json({ message: "Not authorized to update this property" });
      }

      // Get the image
      const image = await prisma.propertyImage.findUnique({
        where: { id: parseInt(imageId) },
      });

      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }

      // Delete the image file
      const imagePath = path.join(
        __dirname,
        "../uploads/properties",
        path.basename(image.url),
      );
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      // Delete the image record
      await prisma.propertyImage.delete({
        where: { id: parseInt(imageId) },
      });

      // If the deleted image was featured, set another image as featured
      if (image.isFeatured) {
        const anotherImage = await prisma.propertyImage.findFirst({
          where: { propertyId: parseInt(propertyId) },
        });

        if (anotherImage) {
          await prisma.propertyImage.update({
            where: { id: anotherImage.id },
            data: { isFeatured: true },
          });
        }
      }

      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Set featured image
router.put(
  "/properties/:propertyId/images/:imageId/featured",
  auth.isAuthenticated,
  isHostOrAdmin,
  async (req, res) => {
    try {
      const { propertyId, imageId } = req.params;

      // Check if property exists and belongs to the user
      const property = await prisma.property.findUnique({
        where: { id: parseInt(propertyId) },
        select: { hostId: true },
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      if (property.hostId !== req.user.id && req.user.role !== "ADMIN") {
        return res
          .status(403)
          .json({ message: "Not authorized to update this property" });
      }

      // Check if image exists
      const image = await prisma.propertyImage.findUnique({
        where: {
          id: parseInt(imageId),
          propertyId: parseInt(propertyId),
        },
      });

      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }

      // Unset current featured image
      await prisma.propertyImage.updateMany({
        where: {
          propertyId: parseInt(propertyId),
          isFeatured: true,
        },
        data: { isFeatured: false },
      });

      // Set new featured image
      await prisma.propertyImage.update({
        where: { id: parseInt(imageId) },
        data: { isFeatured: true },
      });

      res.json({ message: "Featured image updated successfully" });
    } catch (error) {
      console.error("Error updating featured image:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Get host bookings
router.get(
  "/bookings",
  auth.isAuthenticated,
  isHostOrAdmin,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { status } = req.query;

      // Build query
      const where = {
        property: {
          hostId: userId,
        },
      };

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
            },
          },
          guest: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(bookings);
    } catch (error) {
      console.error("Error fetching host bookings:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Update booking status
router.put(
  "/bookings/:id/status",
  auth.isAuthenticated,
  isHostOrAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (
        !status ||
        !["confirmed", "cancelled", "completed"].includes(status)
      ) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Check if booking exists
      const booking = await prisma.booking.findUnique({
        where: { id: parseInt(id) },
        include: {
          property: {
            select: {
              hostId: true,
              title: true,
            },
          },
        },
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Check if user is the host
      if (
        booking.property.hostId !== req.user.id &&
        req.user.role !== "ADMIN"
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to update this booking" });
      }

      // Update booking status
      const updatedBooking = await prisma.booking.update({
        where: { id: parseInt(id) },
        data: { status },
      });

      res.json({
        message: `Booking for ${booking.property.title} has been ${status}`,
        booking: updatedBooking,
      });
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Get host dashboard stats
router.get(
  "/dashboard",
  auth.isAuthenticated,
  isHostOrAdmin,
  async (req, res) => {
    try {
      const userId = req.user.id;

      // Get total properties count
      const propertiesCount = await prisma.property.count({
        where: { hostId: userId },
      });

      // Get bookings stats
      const bookingsStats = await prisma.booking.groupBy({
        by: ["status"],
        where: {
          property: {
            hostId: userId,
          },
        },
        _count: {
          id: true,
        },
      });

      // Format bookings stats
      const bookings = {
        total: 0,
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        completed: 0,
      };

      bookingsStats.forEach((stat) => {
        bookings[stat.status] = stat._count.id;
        bookings.total += stat._count.id;
      });

      // Get total revenue
      const revenue = await prisma.booking.aggregate({
        where: {
          property: {
            hostId: userId,
          },
          status: {
            in: ["confirmed", "completed"],
          },
        },
        _sum: {
          totalPrice: true,
        },
      });

      // Get recent bookings
      const recentBookings = await prisma.booking.findMany({
        where: {
          property: {
            hostId: userId,
          },
        },
        include: {
          property: {
            select: {
              title: true,
              slug: true,
            },
          },
          guest: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      res.json({
        properties: {
          total: propertiesCount,
        },
        bookings,
        revenue: {
          total: revenue._sum.totalPrice || 0,
        },
        recentBookings,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
