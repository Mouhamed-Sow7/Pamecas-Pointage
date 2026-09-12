const cron = require("node-cron");

const Agent = require("../models/Agent");
const Site = require("../models/Site");
const Pointage = require("../models/Pointage");
const Conge = require("../models/Conge");

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function isWeekend(dateStr) {
  // Le format de date de l'app est "YYYY-MM-DD", interprété en UTC ici
  // (le Sénégal est UTC+0 toute l'année, donc ça correspond au jour local).
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Pour chaque agent actif n'ayant reçu aucun pointage à la date donnée,
 * crée un Pointage statut "absent". Idempotent : ne touche jamais un
 * agent qui a déjà un pointage (présent/retard/partiel/congé/justifié/
 * absent) ce jour-là — on ne marque que ce qui manque.
 *
 * Exclusions : agents non actifs, jour de weekend si l'agence n'a pas
 * activé "weekend_actif", agent pas encore embauché à cette date,
 * agent en congé approuvé couvrant cette date.
 */
async function marquerAbsences(dateStr = todayString()) {
  const resultat = {
    date: dateStr,
    traites: 0,
    marques: 0,
    ignores: 0,
    erreurs: 0,
    raisons: {
      pas_encore_embauche: 0,
      weekend: 0,
      deja_pointe: 0,
      conge_approuve: 0,
    },
  };

  // Sécurité : on ne traite jamais une date future — mais "aujourd'hui"
  // reste autorisé, car c'est justement sur ce jour que le cron de 21h
  // est censé tourner pour le clôturer.
  if (dateStr > todayString()) {
    console.warn(`[cron absences] ${dateStr} ignoré : date future.`);
    return resultat;
  }

  const weekend = isWeekend(dateStr);

  const agents = await Agent.find({ statut: "actif" }).select(
    "site_id instance_slug date_embauche",
  );

  if (!agents.length) return resultat;

  // Cache des configs sites (weekend_actif) pour éviter une requête par agent
  const siteIds = [...new Set(agents.map((a) => String(a.site_id)))];
  const sites = await Site.find({ _id: { $in: siteIds } }).select(
    "config.weekend_actif",
  );
  const siteById = new Map(sites.map((s) => [String(s._id), s]));

  for (const agent of agents) {
    resultat.traites += 1;
    try {
      if (
        agent.date_embauche &&
        agent.date_embauche.toISOString().slice(0, 10) > dateStr
      ) {
        resultat.ignores += 1;
        resultat.raisons.pas_encore_embauche += 1;
        continue;
      }

      const site = siteById.get(String(agent.site_id));
      if (weekend && !site?.config?.weekend_actif) {
        resultat.ignores += 1;
        resultat.raisons.weekend += 1;
        continue;
      }

      const dejaPointe = await Pointage.exists({
        agent_id: agent._id,
        date: dateStr,
      });
      if (dejaPointe) {
        resultat.ignores += 1;
        resultat.raisons.deja_pointe += 1;
        continue;
      }

      const enConge = await Conge.exists({
        agent_id: agent._id,
        statut: "approuve",
        date_debut: { $lte: dateStr },
        date_fin: { $gte: dateStr },
      });
      if (enConge) {
        resultat.ignores += 1;
        resultat.raisons.conge_approuve += 1;
        continue;
      }

      await Pointage.create({
        instance_slug: agent.instance_slug || "pamecas",
        agent_id: agent._id,
        site_id: agent.site_id,
        date: dateStr,
        statut: "absent",
        methode: "auto",
        note: "Marque absent automatiquement - aucun pointage detecte ce jour.",
      });
      resultat.marques += 1;
    } catch (err) {
      resultat.erreurs += 1;
      console.error(
        `[cron absences] erreur agent ${agent._id}:`,
        err.message,
      );
    }
  }

  console.log(
    `[cron absences] ${dateStr} - traites: ${resultat.traites}, marques absent: ${resultat.marques}, ignores: ${resultat.ignores} (${JSON.stringify(resultat.raisons)}), erreurs: ${resultat.erreurs}`,
  );
  return resultat;
}

// ─── Cron : tous les jours à 21h00 Dakar ─────────────────────────
// Volontairement tardif : on laisse passer l'heure de sortie de TOUTES
// les agences (même celles qui ferment tard) avant de trancher qu'un
// agent est absent, pour ne jamais marquer absent quelqu'un qui va
// encore pointer dans la soirée. Ajustable via ABSENCE_CRON_HOUR.
function initAbsenceCron() {
  const heure = parseInt(process.env.ABSENCE_CRON_HOUR, 10) || 21;
  cron.schedule(
    `0 ${heure} * * *`,
    async () => {
      await marquerAbsences();
    },
    { timezone: "Africa/Dakar" },
  );
  console.log(
    `Cron marquage absences initialise (tous les jours a ${heure}h00 Dakar)`,
  );
}

module.exports = { initAbsenceCron, marquerAbsences };
