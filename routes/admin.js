const express = require("express");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const auth = require("./auth");

const router = express.Router();

// Middleware to ensure user is admin
const isAdmin = auth.hasRole(["ADMIN"]);

// Categories
router.get("/categories", auth.isAuthenticated, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/categories", auth.isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const existing = await prisma.category.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(409).json({ message: "Category already exists" });
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        userId: req.user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json(category);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/categories/:id",
  auth.isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Check if name is already taken by another category
      const existing = await prisma.category.findFirst({
        where: {
          name,
          NOT: { id: parseInt(id) },
        },
      });

      if (existing) {
        return res
          .status(409)
          .json({ message: "Category name already exists" });
      }

      const category = await prisma.category.update({
        where: { id: parseInt(id) },
        data: {
          name,
          description,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.delete(
  "/categories/:id",
  auth.isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if category is in use
      const propertiesUsingCategory = await prisma.property.count({
        where: { categoryId: parseInt(id) },
      });

      if (propertiesUsingCategory > 0) {
        return res.status(400).json({
          message: `Cannot delete: ${propertiesUsingCategory} properties are using this category`,
        });
      }

      await prisma.category.delete({
        where: { id: parseInt(id) },
      });

      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Property Types
router.get("/property-types", auth.isAuthenticated, async (req, res) => {
  try {
    const propertyTypes = await prisma.propertyType.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    res.json(propertyTypes);
  } catch (error) {
    console.error("Error fetching property types:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/property-types",
  auth.isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      const existing = await prisma.propertyType.findUnique({
        where: { name },
      });

      if (existing) {
        return res
          .status(409)
          .json({ message: "Property type already exists" });
      }

      const propertyType = await prisma.propertyType.create({
        data: {
          name,
          description,
          userId: req.user.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.status(201).json(propertyType);
    } catch (error) {
      console.error("Error creating property type:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.put(
  "/property-types/:id",
  auth.isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Check if name is already taken by another property type
      const existing = await prisma.propertyType.findFirst({
        where: {
          name,
          NOT: { id: parseInt(id) },
        },
      });

      if (existing) {
        return res
          .status(409)
          .json({ message: "Property type name already exists" });
      }

      const propertyType = await prisma.propertyType.update({
        where: { id: parseInt(id) },
        data: {
          name,
          description,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.json(propertyType);
    } catch (error) {
      console.error("Error updating property type:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.delete(
  "/property-types/:id",
  auth.isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if property type is in use
      const propertiesUsingType = await prisma.property.count({
        where: { propertyTypeId: parseInt(id) },
      });

      if (propertiesUsingType > 0) {
        return res.status(400).json({
          message: `Cannot delete: ${propertiesUsingType} properties are using this type`,
        });
      }

      await prisma.propertyType.delete({
        where: { id: parseInt(id) },
      });

      res.json({ message: "Property type deleted successfully" });
    } catch (error) {
      console.error("Error deleting property type:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Amenities
router.get("/amenities", auth.isAuthenticated, async (req, res) => {
  try {
    const amenities = await prisma.amenity.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    res.json(amenities);
  } catch (error) {
    console.error("Error fetching amenities:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/amenities", auth.isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { name, icon } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const existing = await prisma.amenity.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(409).json({ message: "Amenity already exists" });
    }

    const amenity = await prisma.amenity.create({
      data: {
        name,
        icon,
        userId: req.user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json(amenity);
  } catch (error) {
    console.error("Error creating amenity:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/amenities/:id",
  auth.isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, icon } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Check if name is already taken by another amenity
      const existing = await prisma.amenity.findFirst({
        where: {
          name,
          NOT: { id: parseInt(id) },
        },
      });

      if (existing) {
        return res.status(409).json({ message: "Amenity name already exists" });
      }

      const amenity = await prisma.amenity.update({
        where: { id: parseInt(id) },
        data: {
          name,
          icon,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.json(amenity);
    } catch (error) {
      console.error("Error updating amenity:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.delete(
  "/amenities/:id",
  auth.isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Remove amenity from all properties
      await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM _AmenityToProperty WHERE A = ${parseInt(
          id,
        )}`,
        prisma.amenity.delete({
          where: { id: parseInt(id) },
        }),
      ]);

      res.json({ message: "Amenity deleted successfully" });
    } catch (error) {
      console.error("Error deleting amenity:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Location Features
router.get("/location-features", auth.isAuthenticated, async (req, res) => {
  try {
    const locationFeatures = await prisma.locationFeature.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    res.json(locationFeatures);
  } catch (error) {
    console.error("Error fetching location features:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/location-features",
  auth.isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { name, icon } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      const existing = await prisma.locationFeature.findUnique({
        where: { name },
      });

      if (existing) {
        return res
          .status(409)
          .json({ message: "Location feature already exists" });
      }

      const locationFeature = await prisma.locationFeature.create({
        data: {
          name,
          icon,
          userId: req.user.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.status(201).json(locationFeature);
    } catch (error) {
      console.error("Error creating location feature:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.put(
  "/location-features/:id",
  auth.isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, icon } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Check if name is already taken by another location feature
      const existing = await prisma.locationFeature.findFirst({
        where: {
          name,
          NOT: { id: parseInt(id) },
        },
      });

      if (existing) {
        return res
          .status(409)
          .json({ message: "Location feature name already exists" });
      }

      const locationFeature = await prisma.locationFeature.update({
        where: { id: parseInt(id) },
        data: {
          name,
          icon,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.json(locationFeature);
    } catch (error) {
      console.error("Error updating location feature:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.delete(
  "/location-features/:id",
  auth.isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Remove location feature from all properties
      await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM _LocationFeatureToProperty WHERE A = ${parseInt(
          id,
        )}`,
        prisma.locationFeature.delete({
          where: { id: parseInt(id) },
        }),
      ]);

      res.json({ message: "Location feature deleted successfully" });
    } catch (error) {
      console.error("Error deleting location feature:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// User management
router.get("/users", auth.isAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        profileImage: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            properties: true,
            bookings: true,
            reviews: true,
          },
        },
      },
    });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/users/:id/role",
  auth.isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!role || !["ADMIN", "HOST", "GUEST"].includes(role)) {
        return res.status(400).json({ message: "Valid role is required" });
      }

      const user = await prisma.user.update({
        where: { id: parseInt(id) },
        data: { role },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      res.json({ message: "User role updated successfully", user });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
