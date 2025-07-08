const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Create admin user
  const adminPassword = await bcrypt.hash("Admin@123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@example.com",
      password: adminPassword,
      role: "ADMIN",
      isVerified: true,
    },
  });
  console.log("Admin user created:", admin.email);

  // Create host user
  const hostPassword = await bcrypt.hash("Host@123", 12);
  const host = await prisma.user.upsert({
    where: { email: "host@example.com" },
    update: {},
    create: {
      name: "Host User",
      email: "host@example.com",
      password: hostPassword,
      role: "HOST",
      isVerified: true,
      phone: "+1234567890",
    },
  });
  console.log("Host user created:", host.email);

  // Create guest user
  const guestPassword = await bcrypt.hash("Guest@123", 12);
  const guest = await prisma.user.upsert({
    where: { email: "guest@example.com" },
    update: {},
    create: {
      name: "Guest User",
      email: "guest@example.com",
      password: guestPassword,
      role: "GUEST",
      isVerified: true,
    },
  });
  console.log("Guest user created:", guest.email);

  // Create categories
  const categories = [
    {
      name: "Apartment",
      description: "Residential units in a building with multiple units",
    },
    {
      name: "House",
      description: "Standalone residential buildings",
    },
    {
      name: "Villa",
      description: "Luxury standalone houses with gardens",
    },
    {
      name: "Condo",
      description:
        "Individually owned units in a building with shared amenities",
    },
    {
      name: "Townhouse",
      description: "Row houses sharing walls with adjacent properties",
    },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: {
        name: category.name,
        description: category.description,
        userId: admin.id,
      },
    });
  }
  console.log("Categories created");

  // Create property types
  const propertyTypes = [
    {
      name: "Studio",
      description: "Single room serving as bedroom, living room and kitchen",
    },
    {
      name: "1 Bedroom",
      description: "Property with one separate bedroom",
    },
    {
      name: "2 Bedrooms",
      description: "Property with two separate bedrooms",
    },
    {
      name: "3+ Bedrooms",
      description: "Property with three or more bedrooms",
    },
    {
      name: "Penthouse",
      description: "Luxury apartment on the top floor of a building",
    },
  ];

  for (const propertyType of propertyTypes) {
    await prisma.propertyType.upsert({
      where: { name: propertyType.name },
      update: {},
      create: {
        name: propertyType.name,
        description: propertyType.description,
        userId: admin.id,
      },
    });
  }
  console.log("Property types created");

  // Create amenities
  const amenities = [
    { name: "WiFi", icon: "wifi" },
    { name: "Air Conditioning", icon: "fan" },
    { name: "Heating", icon: "thermometer" },
    { name: "Kitchen", icon: "utensils" },
    { name: "TV", icon: "tv" },
    { name: "Free Parking", icon: "car" },
    { name: "Swimming Pool", icon: "swimming-pool" },
    { name: "Gym", icon: "dumbbell" },
    { name: "Washer", icon: "washer" },
    { name: "Dryer", icon: "dryer" },
  ];

  for (const amenity of amenities) {
    await prisma.amenity.upsert({
      where: { name: amenity.name },
      update: {},
      create: {
        name: amenity.name,
        icon: amenity.icon,
        userId: admin.id,
      },
    });
  }
  console.log("Amenities created");

  // Create location features
  const locationFeatures = [
    { name: "Beach Access", icon: "beach" },
    { name: "Mountain View", icon: "mountain" },
    { name: "City Center", icon: "city" },
    { name: "Near Public Transport", icon: "bus" },
    { name: "Quiet Neighborhood", icon: "moon" },
    { name: "Near Restaurants", icon: "utensils" },
    { name: "Near Shopping", icon: "shopping-bag" },
    { name: "Near Schools", icon: "school" },
    { name: "Near Hospital", icon: "hospital" },
    { name: "Near Park", icon: "tree" },
  ];

  for (const feature of locationFeatures) {
    await prisma.locationFeature.upsert({
      where: { name: feature.name },
      update: {},
      create: {
        name: feature.name,
        icon: feature.icon,
        userId: admin.id,
      },
    });
  }
  console.log("Location features created");

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
