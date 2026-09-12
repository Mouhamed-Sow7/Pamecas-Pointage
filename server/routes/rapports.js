const express = require('express');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { authenticate, authorizeRoles, tenantFilter, tenantScope } = require('../middleware/auth');
const Pointage = require('../models/Pointage');
const Site = require('../models/Site');
const Agent = require('../models/Agent');
const Tenant = require('../models/Tenant');

// ─── Identité visuelle des rapports ────────────────────────────────
// Volontairement UNIFORME pour tous les tenants (pas la couleur de
// thème choisie par chaque instance) : un rapport doit rester lisible,
// imprimable et reconnaissable comme "SmartPointage" quel que soit le
// client qui l'exporte. Seul le nom du tenant change, dans l'en-tête.
const REPORT_BRAND_COLOR = '1E3A5F'; // même bleu marine en Excel et en PDF
const REPORT_BRAND_COLOR_HEX = `#${REPORT_BRAND_COLOR}`;

async function getTenantDisplayName(req) {
  const slug = req.user.instance_slug;
  if (slug === null) return 'Toutes instances';
  if (!slug || slug === 'pamecas') return 'PAMECAS';
  const tenant = await Tenant.findOne({ slug }).select('nom configuration.instance_name');
  return tenant?.configuration?.instance_name || tenant?.nom || slug.toUpperCase();
}

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

function genererRapportPdf(res, { pointages, date_debut, date_fin, site_code, tenantName }) {
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

  // --- Bandeau de marque (uniforme, identique pour tous les tenants) ---
  const bandHeight = 40;
  doc.rect(doc.page.margins.left, doc.page.margins.top, pageWidth, bandHeight).fill(REPORT_BRAND_COLOR_HEX);
  doc
    .fontSize(15)
    .fillColor('#ffffff')
    .text('SmartPointage — Rapport de pointages', doc.page.margins.left + 14, doc.page.margins.top + 12, {
      width: pageWidth - 28
    });
  doc.y = doc.page.margins.top + bandHeight + 10;
  doc.x = doc.page.margins.left;

  // --- En-tête : ce qui distingue chaque tenant (nom, période...) ---
  doc
    .fontSize(11)
    .fillColor('#1a1a1a')
    .text(tenantName || 'SmartPointage', { align: 'left', continued: false });
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
    doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill(REPORT_BRAND_COLOR_HEX);
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

    const tenantName = await getTenantDisplayName(req);

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'SmartPointage';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet('Pointages');

      const columns = [
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
      const colCount = columns.length;
      const colLetter = worksheet.getColumn(colCount).letter;

      // On définit juste les clés/largeurs (pas le "header" auto d'ExcelJS,
      // on écrit nous-mêmes les 3 lignes d'en-tête pour contrôler le style)
      worksheet.columns = columns.map(({ header, ...rest }) => rest);

      // Ligne 1 — bandeau titre, marque SmartPointage (uniforme tous tenants)
      worksheet.mergeCells(`A1:${colLetter}1`);
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'SmartPointage — Rapport de pointages';
      titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${REPORT_BRAND_COLOR}` } };
      worksheet.getRow(1).height = 26;

      // Ligne 2 — identification tenant + période (ce qui varie par instance)
      worksheet.mergeCells(`A2:${colLetter}2`);
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value =
        `${tenantName}  •  Période : ${date_debut} au ${date_fin}` +
        (site_code ? `  •  Site : ${site_code}` : '  •  Tous sites') +
        `  •  Généré le ${new Date().toLocaleString('fr-FR')}`;
      subtitleCell.font = { italic: true, size: 10, color: { argb: 'FF444444' } };
      subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      worksheet.getRow(2).height = 20;

      // Ligne 3 — en-têtes de colonnes (même couleur de marque, texte blanc)
      const headerRow = worksheet.getRow(3);
      headerRow.values = columns.map((c) => c.header);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${REPORT_BRAND_COLOR}` } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      headerRow.height = 20;
      worksheet.autoFilter = { from: 'A3', to: `${colLetter}3` };
      worksheet.views = [{ state: 'frozen', ySplit: 3 }];

      pointages.forEach((p, idx) => {
        const row = worksheet.addRow({
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
        if (idx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6F8' } };
          });
        }
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
        site_code,
        tenantName
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






