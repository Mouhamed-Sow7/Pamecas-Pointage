const express = require('express');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { authenticate, authorizeRoles, tenantFilter, tenantScope } = require('../middleware/auth');
const Pointage = require('../models/Pointage');
const Site = require('../models/Site');
const Agent = require('../models/Agent');

const router = express.Router();

router.use(authenticate);
router.use(tenantFilter);
router.use(tenantScope);

function todayString() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

router.get('/dashboard-today', async (req, res) => {
  try {
    const { site_id } = req.query;
    const dateStr = todayString();

    const match = { ...req.siteFilter, ...req.instanceFilter, date: dateStr };

    // Filtre site spécifique si fourni — vérifier que c'est dans le périmètre
    if (site_id && mongoose.Types.ObjectId.isValid(site_id)) {
      if (req.user.role === 'superadmin') {
        match.site_id = new mongoose.Types.ObjectId(site_id);
      } else if (req.siteFilter.site_id) {
        // Pour admin/pointeur : vérifier cohérence
        if (req.siteFilter.site_id.toString() !== site_id) {
          return res.status(403).json({ message: 'Accès refusé à ce site.' });
        }
      }
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
        'Erreur lors du calcul des statistiques de présence pour le dashboard.'
    });
  }
});

const STATUT_LABELS = {
  present: 'Présent',
  absent: 'Absent',
  retard: 'Retard'
};

function genererRapportPdf(res, { pointages, date_debut, date_fin, site_code }) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 36,
    bufferPages: true
  });
  doc.pipe(res);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = [
    { key: 'date', label: 'Date', width: 65 },
    { key: 'site', label: 'Site', width: 130 },
    { key: 'matricule', label: 'Matricule', width: 75 },
    { key: 'agent', label: 'Agent', width: 150 },
    { key: 'statut', label: 'Statut', width: 65 },
    { key: 'heure_arrivee', label: 'Arrivée', width: 60 },
    { key: 'heure_depart', label: 'Départ', width: 60 },
    { key: 'methode', label: 'Méthode', width: 60 },
    { key: 'note', label: 'Note', width: pageWidth - (65 + 130 + 75 + 150 + 65 + 60 + 60 + 60) }
  ];

  // --- En-tête du rapport ---
  doc
    .fontSize(16)
    .fillColor('#1a1a1a')
    .text('SmartPointage — Rapport de pointages', { align: 'left' });
  doc
    .fontSize(10)
    .fillColor('#555')
    .text(
      `Période : ${date_debut} au ${date_fin}` +
        (site_code ? `  •  Site : ${site_code}` : '  •  Tous sites'),
      { align: 'left' }
    );
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, { align: 'left' });
  doc.moveDown(0.5);

  // --- Résumé des statuts ---
  const counts = { present: 0, absent: 0, retard: 0 };
  pointages.forEach((p) => {
    if (counts[p.statut] !== undefined) counts[p.statut] += 1;
  });
  const total = pointages.length;
  const taux = total > 0 ? Math.round((counts.present / total) * 100) : 0;

  doc
    .fontSize(10)
    .fillColor('#1a1a1a')
    .text(
      `Total : ${total}   |   Présents : ${counts.present}   |   Retards : ${counts.retard}   |   Absents : ${counts.absent}   |   Taux de présence : ${taux}%`,
      { align: 'left' }
    );
  doc.moveDown(0.75);

  const tableTop0 = doc.y;
  const rowHeight = 18;

  function drawTableHeader(y) {
    let x = doc.page.margins.left;
    doc.fontSize(9).fillColor('#ffffff');
    doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill('#1e3a5f');
    doc.fillColor('#ffffff');
    columns.forEach((col) => {
      doc.text(col.label, x + 4, y + 5, { width: col.width - 8, ellipsis: true });
      x += col.width;
    });
    return y + rowHeight;
  }

  let y = drawTableHeader(tableTop0);

  pointages.forEach((p, idx) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = drawTableHeader(doc.page.margins.top);
    }

    if (idx % 2 === 0) {
      doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill('#f4f6f8');
    }

    const agentNom = p.agent_id ? `${p.agent_id.nom} ${p.agent_id.prenom}` : '';
    const row = {
      date: p.date || '',
      site: p.site_id ? p.site_id.nom : '',
      matricule: p.agent_id ? p.agent_id.matricule : '',
      agent: agentNom,
      statut: STATUT_LABELS[p.statut] || p.statut,
      heure_arrivee: p.heure_arrivee || '-',
      heure_depart: p.heure_depart || '-',
      methode: p.methode || '',
      note: p.note || ''
    };

    let x = doc.page.margins.left;
    doc.fontSize(8.5).fillColor('#222222');
    columns.forEach((col) => {
      doc.text(String(row[col.key] || ''), x + 4, y + 5, {
        width: col.width - 8,
        ellipsis: true
      });
      x += col.width;
    });

    y += rowHeight;
  });

  // --- Numérotation des pages ---
  // On désactive temporairement la marge basse : sinon pdfkit détecte un
  // dépassement de page au moment d'écrire tout près du bord et insère
  // silencieusement des pages supplémentaires au lieu d'écrire sur place.
  const pageRange = doc.bufferedPageRange();
  const pageCount = pageRange.count;
  const savedBottomMargin = doc.page.margins.bottom;
  for (let i = 0; i < pageCount; i += 1) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc
      .fontSize(8)
      .fillColor('#888888')
      .text(`Page ${i + 1} / ${pageCount}`, doc.page.margins.left, doc.page.height - 24, {
        width: pageWidth,
        align: 'right'
      });
    doc.page.margins.bottom = savedBottomMargin;
  }

  doc.end();
}

router.get('/export', async (req, res) => {
  try {
    const { date_debut, date_fin, site_code, format = 'excel' } = req.query;

    if (!date_debut || !date_fin) {
      return res.status(400).json({
        message: 'Les paramètres date_debut et date_fin sont obligatoires.'
      });
    }

    const filter = {
      ...req.siteFilter,
      ...req.instanceFilter,
      date: { $gte: date_debut, $lte: date_fin }
    };

    if (site_code) {
      const site = await Site.findOne({ code: site_code });
      if (!site) {
        return res
          .status(404)
          .json({ message: 'Site non trouvé pour ce code.' });
      }
      filter.site_id = site._id;
    }

    const pointages = await Pointage.find(filter)
      .populate('agent_id', 'nom prenom matricule type_contrat')
      .populate('site_id', 'nom code');

    if (!pointages.length) {
      return res
        .status(404)
        .json({ message: 'Aucun pointage trouvé pour cette période.' });
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
        { header: 'Prénom', key: 'prenom', width: 18 },
        { header: 'Type contrat', key: 'type_contrat', width: 14 },
        { header: 'Statut', key: 'statut', width: 12 },
        { header: 'Heure arrivée', key: 'heure_arrivee', width: 12 },
        { header: 'Heure départ', key: 'heure_depart', width: 12 },
        { header: 'Méthode', key: 'methode', width: 12 },
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
      const fileName = `rapport-pointages-${date_debut}-${date_fin}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return genererRapportPdf(res, {
        pointages,
        date_debut,
        date_fin,
        site_code
      });
    }

    return res.status(400).json({
      message: "Format de rapport non supporté. Utilisez 'excel' ou 'pdf'."
    });
  } catch (err) {
    console.error('Erreur lors de la génération du rapport:', err);
    return res.status(500).json({
      message: 'Erreur lors de la génération du rapport.'
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






