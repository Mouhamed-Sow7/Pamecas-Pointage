// ═══════════════════════════════════════════════════════════════
// SmartPointage — Purge complète avant reseed
// À exécuter dans MongoDB Shell (mongosh) connecté à ta base Atlas
// ═══════════════════════════════════════════════════════════════

// 1. Vérifier la connexion et le nom de la base avant de purger
print("Base actuelle : " + db.getName());

// 2. Compter avant purge (vérification visuelle)
print("Avant purge :");
print("  agents    : " + db.agents.countDocuments());
print("  sites     : " + db.sites.countDocuments());
print("  pointages : " + db.pointages.countDocuments());
print("  conges    : " + db.conges.countDocuments());
print("  users     : " + db.users.countDocuments());

// 3. PURGE — décommente la ligne ci-dessous pour confirmer l'exécution
//    (sécurité : évite un copier-coller accidentel qui supprime tout)
const CONFIRMER_PURGE = true; // ⚠️ passer à true pour exécuter

if (CONFIRMER_PURGE) {
  db.agents.deleteMany({});
  db.sites.deleteMany({});
  db.pointages.deleteMany({});
  db.conges.deleteMany({});
  db.users.deleteMany({});

  print("\n✅ Purge terminée.");
  print("Après purge :");
  print("  agents    : " + db.agents.countDocuments());
  print("  sites     : " + db.sites.countDocuments());
  print("  pointages : " + db.pointages.countDocuments());
  print("  conges    : " + db.conges.countDocuments());
  print("  users     : " + db.users.countDocuments());
  print("  1. node server/seed.js");
  print("  2. node server/seed-cms.js");
  print("  3. node server/seed-gmv.js");
  print("  4. node server/seed-demo.js");
  print("\n➡️  Ou : npm run seed && npm run seed:cms && npm run seed:gmv && npm run seed:demo");
} else {
  print("\n⚠️ Purge NON exécutée — CONFIRMER_PURGE est à false.");
}
