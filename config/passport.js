const passport = require("passport");
const LocalStrategy = require("passport-local");
const prisma = require("../routes/auth");

passport.use(
  "local",
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (username, password, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { email: username },
        });
        if (!user) {
          return done(null, false, {
            message: "User not found",
          });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return done(null, false, {
            message: "Invalid password",
          });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;
