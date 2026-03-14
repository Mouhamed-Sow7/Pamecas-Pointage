const express = require('express');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const Pointage = require('../models/Pointage');
const Site = require('../models/Site');
const Agent = require('../models/Agent');

const router = express.Router();

router.use(authenticate);

function todayString() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

router.get('/dashboard-today', async (req, res) => {
  try {
    const { site_id } = req.query;
    const dateStr = todayString();

    const match = { date: dateStr };
    if (site_id && mongoose.Types.ObjectId.isValid(site_id)) {
      match.site_id = new mongoose.Types.ObjectId(site_id);
    }

    const kpiAgg = await Pointage.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$statut',
          count: { $sum: 1 }
        }
      }
    ]);

    let presents = 0;
    let absents = 0;
    let retards = 0;

    kpiAgg.forEach((row) => {
      if (row._id === 'present') presents = row.count;
      if (row._id === 'absent') absents = row.count;
      if (row._id === 'retard') retards = row.count;
    });

    const total = presents + absents + retards;
    const taux = total > 0 ? Math.round((presents / total) * 100) : 0;

    const perSiteAgg = await Pointage.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$site_id',
          presents: {
            $sum: {
              $cond: [{ $eq: ['$statut', 'present'] }, 1, 0]
            }
          },
          absents: {
            $sum: {
              $cond: [{ $eq: ['$statut', 'absent'] }, 1, 0]
            }
          },
          retards: {
            $sum: {
              $cond: [{ $eq: ['$statut', 'retard'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const siteIds = perSiteAgg
      .map((r) => r._id)
      .filter((id) => !!id);

    const sites = await Site.find({ _id: { $in: siteIds } }).select(
      'nom code'
    );
    const siteMap = new Map(
      sites.map((s) => [s._id.toString(), { nom: s.nom, code: s.code }])
    );

    const par_site = perSiteAgg.map((row) => {
      const s = siteMap.get(row._id.toString());
      const totalSite = row.presents + row.absents + row.retards;
      const tauxSite =
        totalSite > 0 ? Math.round((row.presents / totalSite) * 100) : 0;
      return {
        site: s ? s.nom : 'Site inconnu',
        code: s ? s.code : '',
        presents: row.presents,
        absents: row.absents,
        retards: row.retards,
        taux: tauxSite
      };
    });

    return res.json({
      kpis: {
        presents,
        absents,
        retards,
        taux
      },
      par_site
    });
  } catch (err) {
    console.error(
      'Erreur lors du calcul des statistiques dashboard du jour:',
      err
    );
    return res.status(500).json({
      message:
        'Erreur lors du calcul des statistiques de prÃ©sence pour le dashboard.'
    });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { date_debut, date_fin, site_code, format = 'excel' } = req.query;

    if (!date_debut || !date_fin) {
      return res.status(400).json({
        message: 'Les paramÃ¨tres date_debut et date_fin sont obligatoires.'
      });
    }

    const filter = {
      date: { $gte: date_debut, $lte: date_fin }
    };

    if (site_code) {
      const site = await Site.findOne({ code: site_code });
      if (!site) {
        return res
          .status(404)
          .json({ message: 'Site non trouvÃ© pour ce code.' });
      }
      filter.site_id = site._id;
    }

    const pointages = await Pointage.find(filter)
      .populate('agent_id', 'nom prenom matricule type_contrat')
      .populate('site_id', 'nom code');

    if (!pointages.length) {
      return res
        .status(404)
        .json({ message: 'Aucun pointage trouvÃ© pour cette pÃ©riode.' });
    }

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Pointages');

      worksheet.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Site', key: 'site', width: 24 },
        { header: 'Code site', key: 'site_code', width: 14 },
        { header: 'Matricule', key: 'matricule', width: 14 },
        { header: 'Nom', key: 'nom', width: 18 },
        { header: 'PrÃ©nom', key: 'prenom', width: 18 },
        { header: 'Type contrat', key: 'type_contrat', width: 14 },
        { header: 'Statut', key: 'statut', width: 12 },
        { header: 'Heure arrivÃ©e', key: 'heure_arrivee', width: 12 },
        { header: 'Heure dÃ©part', key: 'heure_depart', width: 12 },
        { header: 'MÃ©thode', key: 'methode', width: 12 },
        { header: 'Note', key: 'note', width: 30 }
      ];

      pointages.forEach((p) => {
        worksheet.addRow({
          date: p.date,
          site: p.site_id ? p.site_id.nom : '',
          site_code: p.site_id ? p.site_id.code : '',
          matricule: p.agent_id ? p.agent_id.matricule : '',
          nom: p.agent_id ? p.agent_id.nom : '',
          prenom: p.agent_id ? p.agent_id.prenom : '',
          type_contrat: p.agent_id ? p.agent_id.type_contrat : '',
          statut: p.statut,
          heure_arrivee: p.heure_arrivee || '',
          heure_depart: p.heure_depart || '',
          methode: p.methode,
          note: p.note || ''
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `rapport-pointages-${date_debut}-${date_fin}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.send(buffer);
    }

    if (format === 'pdf') {
      return res.status(400).json({
        message:
          'Le format PDF nâ€™est pas encore supportÃ©. Utilisez le format Excel.'
      });
    }

    return res.status(400).json({
      message: "Format de rapport non supportÃ©. Utilisez 'excel'."
    });
  } catch (err) {
    console.error('Erreur lors de la gÃ©nÃ©ration du rapport:', err);
    return res.status(500).json({
      message: 'Erreur lors de la gÃ©nÃ©ration du rapport.'
    });
  }
});
  
router.get('/test-email', authorizeRoles('superadmin'), async (req, res) => {
  const { envoyerRapportMensuel } = require('../services/emailReports');
  const mois = parseInt(req.query.mois) || new Date().getMonth() + 1;
  const annee = parseInt(req.query.annee) || new Date().getFullYear();
  await envoyerRapportMensuel(annee, mois);
  res.json({ message: `Rapport ${mois}/${annee} envoye` });
});


module.exports = router;





