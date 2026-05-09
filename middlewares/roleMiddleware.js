export const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const userRole = req.user.role;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          message: "Akses ditolak, role tidak diizinkan",
        });
      }

      next();
    } catch (err) {
      return res.status(500).json({ message: "Server error role middleware" });
    }
  };
};
