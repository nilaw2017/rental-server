require("dotenv").config();
const express = require("express");
const session = require("express-session");
const connection = require("./connection");
const cors = require("cors");
const auth = require("./routes/auth");
const passport = require("./config/passport");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

const PORT = process.env.PORT || 8000;

app.use("/", require("./routes/index"));
app.use("/api/auth", auth);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
