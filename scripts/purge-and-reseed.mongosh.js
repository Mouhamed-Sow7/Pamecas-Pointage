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
  print("\n➡️  Prochaine étape : node server/seed.js");
} else {
  print("\n⚠️ Purge NON exécutée — CONFIRMER_PURGE est à false.");
}
