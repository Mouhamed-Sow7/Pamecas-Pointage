// server/services/emailReports.js
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');

const Pointage = require('../models/Pointage');
const Site = require('../models/Site');
const Agent = require('../models/Agent');
const User = require('../models/User');

// ─── Transporter Gmail SMTP ──────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',  // forcer host explicite au lieu de service:'gmail'
    port: 465,
    secure: true,
    family: 4,               // forcer IPv4
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
}

// ─── Générer Excel mensuel toutes agences ───────────────────────
async function genererExcelMensuel(annee, mois) {
  const dateDebut = `${annee}-${String(mois).padStart(2,'0')}-01`;
  const dateFin = new Date(annee, mois, 0).toISOString().slice(0,10); // dernier jour du mois

  const pointages = await Pointage.find({
    date: { $gte: dateDebut, $lte: dateFin }
  })
    .populate('agent_id', 'nom prenom matricule type_contrat')
    .populate('site_id', 'nom code')
    .sort({ site_id: 1, date: 1, 'agent_id.nom': 1 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartPointage';
  workbook.created = new Date();

  // ── Feuille 1 : Récap par agence ──
  const wsRecap = workbook.addWorksheet('Recap par agence');
  wsRecap.columns = [
    { header: 'Agence', key: 'agence', width: 24 },
    { header: 'Total pointages', key: 'total', width: 16 },
    { header: 'Presents', key: 'presents', width: 12 },
    { header: 'Absents', key: 'absents', width: 12 },
    { header: 'Retards', key: 'retards', width: 12 },
    { header: 'Taux presence', key: 'taux', width: 16 },
  ];

  // Style header
  wsRecap.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.alignment = { horizontal: 'center' };
  });

  // Grouper par agence
  const parAgence = {};
  pointages.forEach(p => {
    const key = p.site_id?._id?.toString() || 'inconnu';
    if (!parAgence[key]) parAgence[key] = { nom: p.site_id?.nom || 'Inconnu', presents: 0, absents: 0, retards: 0 };
    if (p.statut === 'present') parAgence[key].presents++;
    else if (p.statut === 'absent') parAgence[key].absents++;
    else if (p.statut === 'retard') parAgence[key].retards++;
  });

  Object.values(parAgence).forEach(ag => {
    const total = ag.presents + ag.absents + ag.retards;
    const taux = total > 0 ? Math.round((ag.presents / total) * 100) : 0;
    wsRecap.addRow({ agence: ag.nom, total, presents: ag.presents, absents: ag.absents, retards: ag.retards, taux: `${taux}%` });
  });

  // ── Feuille 2 : Détail tous pointages ──
  const wsDetail = workbook.addWorksheet('Detail pointages');
  wsDetail.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Agence', key: 'agence', width: 22 },
    { header: 'Matricule', key: 'matricule', width: 13 },
    { header: 'Nom', key: 'nom', width: 16 },
    { header: 'Prenom', key: 'prenom', width: 16 },
    { header: 'Contrat', key: 'contrat', width: 11 },
    { header: 'Statut', key: 'statut', width: 11 },
    { header: 'Arrivee', key: 'arrivee', width: 10 },
    { header: 'Depart', key: 'depart', width: 10 },
    { header: 'Duree', key: 'duree', width: 10 },
    { header: 'Methode', key: 'methode', width: 12 },
    { header: 'Note', key: 'note', width: 30 },
  ];

  wsDetail.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  });

  pointages.forEach(p => {
    let dureeStr = '';
    if (p.duree_minutes) {
      const h = Math.floor(p.duree_minutes / 60);
      const m = p.duree_minutes % 60;
      dureeStr = h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`;
    }
    const row = wsDetail.addRow({
      date: p.date,
      agence: p.site_id?.nom || '',
      matricule: p.agent_id?.matricule || '',
      nom: p.agent_id?.nom || '',
      prenom: p.agent_id?.prenom || '',
      contrat: p.agent_id?.type_contrat || '',
      statut: p.statut,
      arrivee: p.heure_arrivee || '',
      depart: p.heure_depart || '',
      duree: dureeStr,
      methode: p.methode,
      note: p.note || ''
    });

    // Colorer selon statut
    const statutCell = row.getCell('statut');
    if (p.statut === 'present') {
      statutCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
      statutCell.font = { color: { argb: 'FF2E7D32' }, bold: true };
    } else if (p.statut === 'absent') {
      statutCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
      statutCell.font = { color: { argb: 'FFC62828' }, bold: true };
    } else if (p.statut === 'retard') {
      statutCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
      statutCell.font = { color: { argb: 'FFE65100' }, bold: true };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, dateDebut, dateFin, stats: parAgence, totalPointages: pointages.length };
}

// ─── Template email HTML ─────────────────────────────────────────
function genererEmailHTML(annee, mois, stats, totalPointages, dateDebut, dateFin) {
  const nomMois = new Date(annee, mois - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  let totalPresents = 0, totalAbsents = 0, totalRetards = 0;
  Object.values(stats).forEach(s => {
    totalPresents += s.presents;
    totalAbsents += s.absents;
    totalRetards += s.retards;
  });
  const total = totalPresents + totalAbsents + totalRetards;
  const tauxGlobal = total > 0 ? Math.round((totalPresents / total) * 100) : 0;

  const lignesAgences = Object.values(stats).map(ag => {
    const t = ag.presents + ag.absents + ag.retards;
    const taux = t > 0 ? Math.round((ag.presents / t) * 100) : 0;
    const couleur = taux >= 80 ? '#2e7d32' : taux >= 60 ? '#e65100' : '#c62828';
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:500;">${ag.nom}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;color:#2e7d32;font-weight:600;">${ag.presents}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;color:#c62828;font-weight:600;">${ag.absents}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;color:#e65100;font-weight:600;">${ag.retards}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:700;color:${couleur};">${taux}%</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f4;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1b5e20,#2e7d32);padding:32px 32px 24px;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
        <div style="width:48px;height:48px;background:white;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#2e7d32;font-size:1rem;">SP</div>
        <div>
          <div style="color:white;font-size:1.2rem;font-weight:700;">SmartPointage</div>
          <div style="color:rgba(255,255,255,0.7);font-size:0.8rem;">Instance PAMECAS</div>
        </div>
      </div>
      <h1 style="color:white;margin:0;font-size:1.4rem;font-weight:700;">Rapport mensuel — ${nomMois}</h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:0.85rem;">Periode : ${dateDebut} au ${dateFin}</p>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid #eee;">
      <div style="padding:20px 16px;text-align:center;border-right:1px solid #eee;">
        <div style="font-size:0.72rem;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Total</div>
        <div style="font-size:1.8rem;font-weight:700;color:#1f2933;">${totalPointages}</div>
      </div>
      <div style="padding:20px 16px;text-align:center;border-right:1px solid #eee;">
        <div style="font-size:0.72rem;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Presents</div>
        <div style="font-size:1.8rem;font-weight:700;color:#2e7d32;">${totalPresents}</div>
      </div>
      <div style="padding:20px 16px;text-align:center;border-right:1px solid #eee;">
        <div style="font-size:0.72rem;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Absents</div>
        <div style="font-size:1.8rem;font-weight:700;color:#c62828;">${totalAbsents}</div>
      </div>
      <div style="padding:20px 16px;text-align:center;">
        <div style="font-size:0.72rem;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Taux</div>
        <div style="font-size:1.8rem;font-weight:700;color:#1565c0;">${tauxGlobal}%</div>
      </div>
    </div>

    <!-- Tableau agences -->
    <div style="padding:24px 32px;">
      <h2 style="font-size:1rem;font-weight:600;color:#1f2933;margin:0 0 16px;">Recap par agence</h2>
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
        <thead>
          <tr style="background:#f7faf7;">
            <th style="padding:10px 14px;text-align:left;color:#555;font-weight:600;border-bottom:2px solid #e8f5e9;">Agence</th>
            <th style="padding:10px 14px;text-align:center;color:#2e7d32;font-weight:600;border-bottom:2px solid #e8f5e9;">Presents</th>
            <th style="padding:10px 14px;text-align:center;color:#c62828;font-weight:600;border-bottom:2px solid #e8f5e9;">Absents</th>
            <th style="padding:10px 14px;text-align:center;color:#e65100;font-weight:600;border-bottom:2px solid #e8f5e9;">Retards</th>
            <th style="padding:10px 14px;text-align:center;color:#1565c0;font-weight:600;border-bottom:2px solid #e8f5e9;">Taux</th>
          </tr>
        </thead>
        <tbody>${lignesAgences}</tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f8f9f8;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:0.78rem;color:#aaa;">
        Ce rapport a ete genere automatiquement par SmartPointage.<br>
        Pour toute question, connectez-vous sur votre espace administrateur.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// ─── Envoyer le rapport mensuel ──────────────────────────────────
async function envoyerRapportMensuel(annee, mois) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !process.env.REPORT_EMAIL_TO) {
      console.log('Email non configure — rapport mensuel ignore (definir GMAIL_USER, GMAIL_APP_PASSWORD, REPORT_EMAIL_TO)');
      return;
    }

    console.log(`Envoi rapport mensuel ${mois}/${annee}...`);

    const { buffer, dateDebut, dateFin, stats, totalPointages } = await genererExcelMensuel(annee, mois);
    const html = genererEmailHTML(annee, mois, stats, totalPointages, dateDebut, dateFin);

    const nomMois = new Date(annee, mois - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const nomFichier = `rapport-smartpointage-${annee}-${String(mois).padStart(2,'0')}.xlsx`;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"SmartPointage" <${process.env.GMAIL_USER}>`,
      to: process.env.REPORT_EMAIL_TO,
      subject: `SmartPointage — Rapport mensuel ${nomMois} (PAMECAS)`,
      html,
      attachments: [{
        filename: nomFichier,
        content: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }]
    });

    console.log(`Rapport mensuel envoye a ${process.env.REPORT_EMAIL_TO}`);
  } catch (err) {
    console.error('Erreur envoi rapport mensuel:', err.message);
  }
}

// ─── Initialiser le cron ─────────────────────────────────────────
function initEmailCron() {
  // Le 1er de chaque mois a 07:00 heure locale
  // Envoie le rapport du mois precedent
  cron.schedule('0 7 1 * *', async () => {
    const now = new Date();
    const moisPrecedent = now.getMonth() === 0 ? 12 : now.getMonth();
    const anneePrecedente = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    await envoyerRapportMensuel(anneePrecedente, moisPrecedent);
  }, {
    timezone: 'Africa/Dakar'
  });

  console.log('Cron rapport mensuel initialise (1er de chaque mois a 07h00 Dakar)');
}

module.exports = { initEmailCron, envoyerRapportMensuel };