// server/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { hashPassword } = require("../utils/encryption");
const passport = require("passport");

const router = express.Router();

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role = "GUEST", phone } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate password strength
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number and special character",
      });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // Only allow ADMIN or HOST if explicitly specified (and validated elsewhere)
    const userRole = ["ADMIN", "HOST", "GUEST"].includes(role) ? role : "GUEST";

    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
        phone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    });

    req.login(newUser, (err) => {
      if (err) return res.status(500).json({ message: "Auto-login failed" });
      res.status(201).json({
        message: "User created successfully",
        user: newUser,
      });
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", passport.authenticate("local"), async (req, res) => {
  res.json({
    message: "Login Successful",
    user: req.user,
  });
});

router.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return res.status(500).json({ message: "Error logging out" });
    }
    res.json({ message: "Logged out successfully" });
  });
});

router.get("/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  res.json({ user: req.user });
});

// Check if email exists (for registration form)
router.get("/check-email/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    res.json({ exists: !!user });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Middleware to check if user has specific role
const hasRole = (roles) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (roles.includes(req.user.role)) {
      return next();
    }

    res.status(403).json({ message: "Forbidden: Insufficient permissions" });
  };
};

// Export middleware for use in other routes
router.isAuthenticated = isAuthenticated;
router.hasRole = hasRole;

module.exports = router;
