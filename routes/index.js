const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "Welcome to the Real Estate Rental System API",
    endpoints: {
      auth: {
        register: "POST /api/auth/register",
        login: "POST /api/auth/login",
        logout: "GET /api/auth/logout",
        me: "GET /api/auth/me",
      },
      admin: {
        categories: "GET, POST, PUT, DELETE /api/admin/categories",
        propertyTypes: "GET, POST, PUT, DELETE /api/admin/property-types",
        amenities: "GET, POST, PUT, DELETE /api/admin/amenities",
        locationFeatures: "GET, POST, PUT, DELETE /api/admin/location-features",
        users: "GET /api/admin/users",
        updateUserRole: "PUT /api/admin/users/:id/role",
      },
      host: {
        properties: "GET, POST, PUT, DELETE /api/host/properties",
        propertyImages: "POST, DELETE /api/host/properties/:id/images",
        bookings: "GET /api/host/bookings",
        updateBookingStatus: "PUT /api/host/bookings/:id/status",
      },
      guest: {
        properties: "GET /api/guest/properties",
        propertyDetails: "GET /api/guest/properties/:slug",
        propertyAvailability: "GET /api/guest/properties/:id/availability",
        bookings: "GET, POST /api/guest/bookings",
        cancelBooking: "PUT /api/guest/bookings/:id/cancel",
        reviews: "POST /api/guest/reviews",
        wishlists: "GET, POST, PUT, DELETE /api/guest/wishlists",
      },
    },
    status: "API is running",
  });
});

module.exports = router;
