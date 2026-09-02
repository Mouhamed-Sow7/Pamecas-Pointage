export function showModal({ title, content, onConfirm, onCancel, onReady, confirmText = 'Confirmer', cancelText = 'Annuler' }) {
  let overlay = document.getElementById('gds-modal-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'gds-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.5);display:flex;align-items:center;justify-content:center;z-index:40;padding:16px;';
  document.body.appendChild(overlay);

  const box = document.createElement('div');
  box.className = 'card';
  box.style.cssText = 'max-width:480px;width:100%;max-height:90vh;overflow-y:auto;';

  const titleEl = document.createElement('h2');
  titleEl.style.cssText = 'margin-bottom:12px;font-size:18px;';
  titleEl.textContent = title;

  const bodyEl = document.createElement('div');
  bodyEl.style.cssText = 'margin-bottom:16px;';
  if (typeof content === 'string') {
    bodyEl.innerHTML = content;
  } else if (content instanceof Node) {
    bodyEl.appendChild(content);
  }

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';

  const btnCancel = document.createElement('button');
  btnCancel.id = 'gds-modal-cancel';
  btnCancel.className = 'btn-danger';
  btnCancel.type = 'button';
  btnCancel.textContent = cancelText;

  footer.appendChild(btnCancel);

  if (confirmText) {
    const btnConfirm = document.createElement('button');
    btnConfirm.id = 'gds-modal-confirm';
    btnConfirm.className = 'btn-primary';
    btnConfirm.type = 'button';
    btnConfirm.textContent = confirmText;
    btnConfirm.addEventListener('click', () => { if (onConfirm) onConfirm(close); });
    footer.appendChild(btnConfirm);
  }

  box.appendChild(titleEl);
  box.appendChild(bodyEl);
  box.appendChild(footer);
  overlay.appendChild(box);

  function close() {
    if (overlay && overlay.parentNode) overlay.remove();
  }

  btnCancel.addEventListener('click', () => { if (onCancel) onCancel(); close(); });

  // Fermer en cliquant sur l'overlay
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { if (onCancel) onCancel(); close(); } });

  // onReady : passe close() au parent (utile pour les modals avec boutons internes)
  if (onReady) onReady(close);
}