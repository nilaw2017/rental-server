const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
router.get("/", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { email: "nilaw.work@gmail.com" },
  });
  res.json(user);
});

module.exports = router;
