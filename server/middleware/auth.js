// server/middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Site = require("../models/Site");
const mongoose = require("mongoose");

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Token manquant." });
    }

    // 1. SUPERADMIN_TOKEN statique (variable env)
    if (
      process.env.SUPERADMIN_TOKEN &&
      token === process.env.SUPERADMIN_TOKEN
    ) {
      req.user = {
        id: "superadmin_master",
        username: "smartpointage_admin",
        role: "superadmin",
        site_id: null,
        site_nom: "Super Admin",
        sites_ids: [],
        is_superadmin: true,
      };
      return next();
    }

    // 2. Token kiosque UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(token)) {
      const site = await Site.findOne({ kiosque_token: token, actif: true });
      if (!site)
        return res.status(401).json({ message: "Token kiosque invalide." });
      req.user = {
        id: `kiosque_${site._id}`,
        username: `kiosque_${site.code}`,
        role: "pointeur",
        site_id: site._id.toString(),
        site_nom: site.nom,
        sites_ids: [],
        is_kiosque: true,
      };
      return next();
    }

    // 3. JWT normal
    const secret = process.env.JWT_SECRET || "change-me";
    const payload = jwt.verify(token, secret);

    // 3a. God Mode JWT (genere par /api/auth/godmode)
    if (payload.is_god_mode) {
      req.user = {
        id: "god_mode",
        username: "smartpointage_admin",
        role: "superadmin",
        site_id: null,
        site_nom: "God Mode",
        sites_ids: [],
        is_god_mode: true,
      };
      return next();
    }

    // 3b. User normal — recharger depuis DB
    const user = await User.findById(payload.id)
      .select("-password")
      .populate("site_id", "nom code _id");

    if (!user || !user.actif) {
      return res
        .status(401)
        .json({ message: "Compte inactif ou introuvable." });
    }

    req.user = {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      site_id:
        user.site_id?._id?.toString() || user.site_id?.toString() || null,
      site_nom: user.site_id?.nom || null,
      sites_ids: (user.sites_ids || []).map(
        (s) => s._id?.toString() || s.toString(),
      ),
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalide ou expire." });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Acces refuse." });
    }
    return next();
  };
}

function tenantFilter(req, res, next) {
  if (!req.user) return next();

  if (req.user.role === "superadmin") {
    req.siteFilter = {};
  } else if (req.user.role === "directeur_regional") {
    req.siteFilter = {
      site_id: {
        $in: (req.user.sites_ids || []).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    };
  } else if (req.user.site_id) {
    req.siteFilter = { site_id: new mongoose.Types.ObjectId(req.user.site_id) };
  } else {
    req.siteFilter = { site_id: null };
  }

  return next();
}

module.exports = { authenticate, authorizeRoles, tenantFilter };
