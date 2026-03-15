// Ajouter dans server/routes/agents.js

// ─── POST /otp/send — Envoyer OTP SMS ───────────────────────────
router.post('/otp/send', async (req, res) => {
  try {
    const { matricule } = req.body;
    if (!matricule) return res.status(400).json({ message: 'Matricule obligatoire.' });

    const agent = await Agent.findOne({ matricule: matricule.toUpperCase(), statut: 'actif' });
    if (!agent) return res.status(404).json({ message: 'Agent introuvable.' });
    if (!agent.telephone) return res.status(400).json({ message: 'Aucun telephone enregistre pour cet agent.' });

    const code = agent.genererOTP();
    await agent.save();

    // TODO: brancher Twilio ou Orange SMS ici
    // Pour l'instant on log le code (demo)
    console.log(`OTP pour ${matricule}: ${code}`);

    // Masquer le telephone : 77 XXX XX XX -> 77 XXX ** **
    const tel = agent.telephone;
    const telMasque = tel.length > 4 ? tel.slice(0, -4) + '** **' : '** ** ** **';

    return res.json({
      message: 'Code envoye par SMS.',
      telephone_masque: telMasque
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur envoi OTP.' });
  }
});

// ─── POST /otp/verify — Verifier OTP et pointer ─────────────────
router.post('/otp/verify', async (req, res) => {
  try {
    const { matricule, code, site_id } = req.body;
    if (!matricule || !code || !site_id) {
      return res.status(400).json({ message: 'Matricule, code et site_id obligatoires.' });
    }

    const agent = await Agent.findOne({ matricule: matricule.toUpperCase(), statut: 'actif' });
    if (!agent) return res.status(404).json({ message: 'Agent introuvable.' });

    if (!agent.verifierOTP(code)) {
      return res.status(400).json({ message: 'Code incorrect ou expire.' });
    }

    await agent.invaliderOTP();

    // Determiner arrivee ou depart
    const dateStr = new Date().toISOString().split('T')[0];
    const heure = new Date().toTimeString().slice(0, 5);

    let pointage = await Pointage.findOne({ agent_id: agent._id, site_id, date: dateStr });
    let type = 'arrivee';

    if (!pointage) {
      pointage = new Pointage({
        agent_id: agent._id,
        site_id,
        date: dateStr,
        heure_arrivee: heure,
        statut: 'present',
        methode: 'manuel',
        sync_status: 'synced',
        synced_at: new Date()
      });
    } else {
      if (pointage.heure_depart) {
        return res.status(400).json({ message: 'Depart deja enregistre aujourd\'hui.' });
      }
      type = 'depart';
      pointage.heure_depart = heure;
      if (pointage.heure_arrivee) {
        const [h1, m1] = pointage.heure_arrivee.split(':').map(Number);
        const [h2, m2] = heure.split(':').map(Number);
        pointage.duree_minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
      }
      pointage.sync_status = 'synced';
    }

    await pointage.save();

    return res.json({
      message: 'Pointage enregistre.',
      type,
      agent: {
        _id: agent._id,
        nom: agent.nom,
        prenom: agent.prenom,
        matricule: agent.matricule
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur verification OTP.' });
  }
});
