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
    const { name, email, password } = req.body;
    // simple validation omitted
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: "Invalid password" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
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

module.exports = router;
