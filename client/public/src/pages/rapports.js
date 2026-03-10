import { showToast } from '../components/toast.js';

// ─── Mini Calendar ──────────────────────────────────────────────
function createCalendar(inputEl) {
  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const DAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

  let current = new Date();
  let selectedDate = null;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;display:none;
    background:rgba(0,0,0,0.35);align-items:center;justify-content:center;
  `;

  const cal = document.createElement('div');
  cal.style.cssText = `
    background:#fff;border-radius:16px;padding:20px;width:300px;
    box-shadow:0 20px 60px rgba(0,0,0,0.25);font-family:inherit;
    animation:calIn 0.18s ease;
  `;

  if (!document.getElementById('cal-style')) {
    const st = document.createElement('style');
    st.id = 'cal-style';
    st.textContent = `
      @keyframes calIn { from{transform:scale(0.92);opacity:0} to{transform:scale(1);opacity:1} }
      .cal-day { width:36px;height:36px;border-radius:50%;border:none;background:none;
        cursor:pointer;font-size:0.85rem;color:#333;transition:all 0.15s; }
      .cal-day:hover { background:#e8f5e9;color:#2e7d32; }
      .cal-day.selected { background:#2e7d32;color:white;font-weight:600; }
      .cal-day.today { border:2px solid #4CAF50; }
      .cal-day.other-month { color:#bbb; }
      .cal-day:disabled { opacity:0.3;cursor:not-allowed; }
    `;
    document.head.appendChild(st);
  }

  function formatDisplay(d) {
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  function formatValue(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function render() {
    const y = current.getFullYear();
    const m = current.getMonth();
    const today = new Date();
    today.setHours(0,0,0,0);

    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m+1, 0);
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = startDow === 0 ? 6 : startDow - 1; // Mon=0

    cal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <button id="cal-prev" style="border:none;background:#f5f5f5;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:1rem;">‹</button>
        <span style="font-weight:600;font-size:0.95rem;color:#1a1a2e;">${MONTHS_FR[m]} ${y}</span>
        <button id="cal-next" style="border:none;background:#f5f5f5;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:1rem;">›</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:8px;">
        ${DAYS_FR.map(d=>`<div style="text-align:center;font-size:0.72rem;font-weight:600;color:#999;padding:4px 0;">${d}</div>`).join('')}
      </div>
      <div id="cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;"></div>
      <div style="display:flex;justify-content:space-between;margin-top:16px;gap:8px;">
        <button id="cal-cancel" style="flex:1;padding:8px;border:1.5px solid #ddd;border-radius:8px;background:white;cursor:pointer;font-size:0.85rem;">Annuler</button>
        <button id="cal-confirm" style="flex:1;padding:8px;background:#2e7d32;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:500;">Confirmer</button>
      </div>
    `;

    const grid = cal.querySelector('#cal-grid');

    // Padding début
    for (let i = 0; i < startDow; i++) {
      const prev = new Date(y, m, -startDow + i + 1);
      const btn = document.createElement('button');
      btn.className = 'cal-day other-month';
      btn.textContent = prev.getDate();
      btn.disabled = true;
      grid.appendChild(btn);
    }

    // Jours du mois
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(y, m, d);
      const btn = document.createElement('button');
      btn.className = 'cal-day';
      btn.textContent = d;
      if (date.getTime() === today.getTime()) btn.classList.add('today');
      if (selectedDate && date.toDateString() === selectedDate.toDateString()) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        selectedDate = date;
        render();
      });
      grid.appendChild(btn);
    }

    cal.querySelector('#cal-prev').addEventListener('click', () => {
      current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      render();
    });
    cal.querySelector('#cal-next').addEventListener('click', () => {
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      render();
    });
    cal.querySelector('#cal-cancel').addEventListener('click', () => close());
    cal.querySelector('#cal-confirm').addEventListener('click', () => {
      if (selectedDate) {
        inputEl.value = formatValue(selectedDate);
        inputEl.dataset.display = formatDisplay(selectedDate);
        updateTrigger();
      }
      close();
    });
  }

  function updateTrigger() {
    const trigger = inputEl.previousElementSibling?.querySelector('.cal-trigger-text')
      || document.querySelector(`[data-for="${inputEl.id}"] .cal-trigger-text`);
    if (trigger) trigger.textContent = inputEl.dataset.display || 'Choisir une date';
  }

  function open(date) {
    if (date) { current = new Date(date); selectedDate = new Date(date); }
    else current = new Date();
    render();
    overlay.style.display = 'flex';
  }

  function close() { overlay.style.display = 'none'; }

  overlay.appendChild(cal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);

  return { open, close };
}

// ─── Page Rapports ───────────────────────────────────────────────
export function renderRapports(root) {
  root.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">

      <!-- Header card -->
      <div class="card">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
          <div style="width:40px;height:40px;background:linear-gradient(135deg,#2e7d32,#66bb6a);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;"><i class="fa-solid fa-chart-line"></i></div>
          <div>
            <h2 style="font-size:1rem;font-weight:700;margin:0;">Rapports de présence</h2>
            <p style="font-size:0.78rem;color:#888;margin:2px 0 0;">Exportez les données de pointage par période</p>
          </div>
        </div>
      </div>

      <!-- Formulaire export -->
      <div class="card">
        <h3 style="font-size:0.85rem;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:16px;">Période & Filtres</h3>

        <!-- Dates -->
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;">

          <!-- Date début -->
          <div>
            <label style="font-size:0.82rem;font-weight:500;color:#444;display:block;margin-bottom:6px;"><i class="fa-solid fa-calendar"></i> Date début</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <div id="trigger-debut" style="flex:1;display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;cursor:pointer;background:#fafafa;transition:border 0.2s;">
                <span class="cal-trigger-text" style="font-size:0.88rem;color:#666;">Choisir une date</span>
                <span style="color:#2e7d32;font-size:0.8rem;">▼</span>
              </div>
              <input id="date-debut" type="hidden" />
            </div>
          </div>

          <!-- Date fin -->
          <div>
            <label style="font-size:0.82rem;font-weight:500;color:#444;display:block;margin-bottom:6px;"><i class="fa-solid fa-calendar"></i> Date fin</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <div id="trigger-fin" style="flex:1;display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;cursor:pointer;background:#fafafa;transition:border 0.2s;">
                <span class="cal-trigger-text" style="font-size:0.88rem;color:#666;">Choisir une date</span>
                <span style="color:#2e7d32;font-size:0.8rem;">▼</span>
              </div>
              <input id="date-fin" type="hidden" />
            </div>
          </div>

          <!-- Site optionnel -->
          <div>
            <label style="font-size:0.82rem;font-weight:500;color:#444;display:block;margin-bottom:6px;"><i class="fa-solid fa-building"></i> Agence (optionnel)</label>
            <select id="site-code" style="width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;background:#fafafa;font-size:0.88rem;color:#444;appearance:none;cursor:pointer;">
              <option value="">Toutes les agences</option>
              <option value="PAM-DG">Direction Générale</option>
              <option value="PAM-BENE">Béne Tally</option>
              <option value="PAM-BOURG">Bourguiba</option>
              <option value="PAM-CAST">Castors</option>
              <option value="PAM-AVION">Cité Avion</option>
              <option value="PAM-GYOFF">Grand Yoff</option>
              <option value="PAM-HLM">HLM</option>
              <option value="PAM-OUAK">Ouakam</option>
              <option value="PAM-VDN">VDN</option>
              <option value="PAM-YOFF">Yoff</option>
            </select>
          </div>
        </div>

        <!-- Période sélectionnée résumé -->
        <div id="periode-resume" style="display:none;background:#e8f5e9;border:1px solid #c8e6c9;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:0.82rem;color:#2e7d32;"></div>

        <!-- Boutons export -->
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button id="btn-export-excel" style="width:100%;padding:13px;background:linear-gradient(135deg,#2e7d32,#43a047);color:white;border:none;border-radius:10px;font-size:0.9rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity 0.2s;">
            <i class="fa-solid fa-file-excel"></i> Exporter en Excel
          </button>
          <button id="btn-export-pdf" style="width:100%;padding:13px;background:white;color:#c62828;border:2px solid #ef9a9a;border-radius:10px;font-size:0.9rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s;" disabled title="Bientôt disponible">
            <i class="fa-solid fa-file-pdf"></i> Exporter en PDF <span style="font-size:0.72rem;background:#ef9a9a;color:white;padding:2px 6px;border-radius:4px;margin-left:4px;">Bientôt</span>
          </button>
        </div>

        <!-- Guide utilisation -->
        <div style="margin-top:16px;padding:12px;background:#f5f5f5;border-radius:8px;font-size:0.78rem;color:#666;line-height:1.6;">
          <div style="font-weight:600;color:#444;margin-bottom:4px;"><i class="fa-solid fa-question-circle"></i> Comment utiliser</div>
          1. Choisissez une date de début et une date de fin<br>
          2. Sélectionnez une agence ou laissez vide pour tout exporter<br>
          3. Cliquez "Exporter Excel" — le fichier se télécharge automatiquement
        </div>
      </div>

    </div>
  `;

  // Initialiser les calendriers
  const inputDebut = root.querySelector('#date-debut');
  const inputFin = root.querySelector('#date-fin');
  const triggerDebut = root.querySelector('#trigger-debut');
  const triggerFin = root.querySelector('#trigger-fin');
  const periodeResume = root.querySelector('#periode-resume');

  const calDebut = createCalendar(inputDebut);
  const calFin = createCalendar(inputFin);

  // Lier triggers aux calendriers
  triggerDebut.addEventListener('click', () => {
    triggerDebut.style.borderColor = '#2e7d32';
    calDebut.open(inputDebut.value || null);
  });
  triggerFin.addEventListener('click', () => {
    triggerFin.style.borderColor = '#2e7d32';
    calFin.open(inputFin.value || null);
  });

  // Mettre à jour le texte des triggers après sélection
  function updateTriggerText(input, trigger) {
    const observer = new MutationObserver(() => {});
    // Poll simple pour détecter changement de value
    const orig = input.value;
    const check = setInterval(() => {
      if (input.value !== orig) {
        clearInterval(check);
        if (input.value) {
          const [y,m,d] = input.value.split('-');
          trigger.querySelector('.cal-trigger-text').textContent = `${d}/${m}/${y}`;
          trigger.style.borderColor = '#2e7d32';
          trigger.style.background = '#f1f8f1';
        }
        updateResume();
      }
    }, 100);
  }

  // Observer les changements de valeur
  triggerDebut.addEventListener('click', () => {
    const prev = inputDebut.value;
    const iv = setInterval(() => {
      if (inputDebut.value !== prev) {
        clearInterval(iv);
        const [y,m,d] = inputDebut.value.split('-');
        triggerDebut.querySelector('.cal-trigger-text').textContent = `${d}/${m}/${y}`;
        triggerDebut.style.borderColor = '#2e7d32';
        triggerDebut.style.background = '#f1f8f1';
        updateResume();
      }
    }, 100);
  });

  triggerFin.addEventListener('click', () => {
    const prev = inputFin.value;
    const iv = setInterval(() => {
      if (inputFin.value !== prev) {
        clearInterval(iv);
        const [y,m,d] = inputFin.value.split('-');
        triggerFin.querySelector('.cal-trigger-text').textContent = `${d}/${m}/${y}`;
        triggerFin.style.borderColor = '#2e7d32';
        triggerFin.style.background = '#f1f8f1';
        updateResume();
      }
    }, 100);
  });

  function updateResume() {
    if (inputDebut.value && inputFin.value) {
      const [yd,md,dd] = inputDebut.value.split('-');
      const [yf,mf,df] = inputFin.value.split('-');
      const site = root.querySelector('#site-code').value;
      const siteLabel = site ? root.querySelector(`#site-code option[value="${site}"]`)?.textContent : 'Toutes les agences';
      periodeResume.style.display = 'block';
      periodeResume.innerHTML = `<i class="fa-solid fa-check-circle"></i> Du <strong>${dd}/${md}/${yd}</strong> au <strong>${df}/${mf}/${yf}</strong> — ${siteLabel}`;
    }
  }

  root.querySelector('#site-code').addEventListener('change', updateResume);

  // Export Excel — téléchargement direct
  root.querySelector('#btn-export-excel').addEventListener('click', async () => {
    const debut = inputDebut.value;
    const fin = inputFin.value;
    if (!debut || !fin) {
      showToast('Veuillez choisir une date début et une date fin.', 'warning');
      return;
    }
    if (debut > fin) {
      showToast('La date début doit être avant la date fin.', 'warning');
      return;
    }

    const btn = root.querySelector('#btn-export-excel');
    btn.textContent = 'Génération en cours...';
    btn.disabled = true;

    try {
      const token = localStorage.getItem('gds_token');
      const site = root.querySelector('#site-code').value;
      const params = new URLSearchParams({ date_debut: debut, date_fin: fin, format: 'excel' });
      if (site) params.append('site_code', site);

      // ✅ Téléchargement direct via fetch + blob
      const res = await fetch(`/api/rapports/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erreur serveur');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-pamecas-${debut}-${fin}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✅ Rapport Excel téléchargé !', 'success');
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      btn.innerHTML = '<span><i class="fa-solid fa-file-excel"></i></span> Exporter en Excel';
      btn.disabled = false;
    }
  });
}