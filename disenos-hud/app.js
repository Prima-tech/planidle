'use strict';
(() => {
  const designs = [
    { id: 'relic', number: 1, accent: '#d7b879' },
    { id: 'vanguard', number: 2, accent: '#d2d7ad' },
    { id: 'nexus', number: 3, accent: '#bdb4f1' },
    { id: 'saga', number: 4, accent: '#e6c57b' },
    { id: 'eclipse', number: 5, accent: '#e4a2a5' },
    { id: 'mist', number: 6, accent: '#9bd7c4' }
  ];
  const icons = {
    star: '<path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z"/>',
    expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
    chevron: '<path d="m7 9 5 5 5-5"/>',
    map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
    swords: '<path d="m4 3 5 2 9 12-2 2L5 8Zm11 13 5-4M3 21l5-5M20 3l-5 2-3 4m-3 5-3 3 2 2 3-3m-7-4 5 4m7 0 5 5"/>',
    mining: '<path d="m4 8 8-5 8 5-8 13Zm0 0h16M9 4 7 8l5 13 5-13-2-4M7 8h10"/>',
    wood: '<path d="M20 3C8 2 3 8 5 14s15 8 15-11ZM4 21 15 10M8 17v-5m0 5h5"/>',
    dominion: '<path d="M8 3h8v6a4 4 0 0 1-8 0Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v5m-4 3h8m-8 0 1-3h6l1 3"/>',
    shield: '<path d="m12 3 8 3v6c0 4-5 7-8 9-3-2-8-5-8-9V6Z"/><path d="m8 11 3 3 5-6"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10m3-8h-5a2 2 0 0 0 0 3h4a2 2 0 0 1 0 3H9"/>'
  };
  let language = 'es';
  let health = 76;
  let focusDesign = null;
  let animationTimeout;
  let favorites = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem('valhalla-hud-lab-favorites') || '[]');
    if (Array.isArray(saved)) favorites = new Set(saved.filter(id => designs.some(d => d.id === id)));
  } catch { /* The file preview also works with browser storage disabled. */ }
  const t = key => window.HUD_COPY[language][key] || key;
  const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
  const format = number => number.toLocaleString(language === 'es' ? 'es-ES' : 'en-US');
  const hpText = () => format(Math.round(2480 * health / 100));
  const activity = () => t(health === 0 ? 'defeated' : health < 25 ? 'critical' : 'combat');
  const gallery = document.getElementById('gallery');
  const dialog = document.getElementById('focus-dialog');

  function combatContent() {
    return `<div class="power-row"><div class="power-stat"><span class="stat-label">${t('power')}</span><strong>1.284</strong></div><span class="power-divider">${icon('shield')}</span><div class="power-stat"><span class="stat-label">${t('recommended')}</span><strong>960</strong></div></div>
      <div class="progress-pair"><div><div class="progress-caption"><span>${t('elite')}</span><b>26 / 40</b></div><div class="tiny-track"><span></span></div></div><div class="oblivion"><div class="progress-caption"><span>${t('oblivion')}</span><b>3 / 10</b></div><div class="tiny-track"><span></span></div></div></div>
      <div class="quick-stats"><span>${t('enemiesCount')} <b>8</b></span><span>${t('spawn')} <b>3 s</b></span></div>
      <div class="production"><span class="production-label">${t('afk')}</span><div class="production-values"><span>${icon('coin','coin-icon')}2.4k</span><span><span class="xp-tag">XP</span>8.6k</span></div></div>`;
  }

  function resourceContent(tab) {
    const mining = tab === 'mining';
    return `<div class="resource-heading"><img src="assets/${mining ? 'copper.png' : 'tree.png'}" alt=""><div><strong>${t(mining ? 'copper' : 'oak')}</strong><span class="stat-label">${t('zone')} · ${t(mining ? 'mining' : 'wood')}</span></div></div>
      <div class="resource-stats"><div class="resource-stat"><span>${t('efficiency')}</span><strong>${mining ? '150' : '125'}</strong></div><div class="resource-stat"><span>${t('nodes')}</span><strong>3</strong></div><div class="resource-stat"><span>${t('guaranteed')}</span><strong>×2</strong></div><div class="resource-stat"><span>${t('spawn')}</span><strong>30 s</strong></div></div>
      <div class="production" style="margin-top:15px"><span class="production-label">${t('yield')}</span><div class="production-values">${mining ? '240' : '360'} <span class="stat-label">/ h</span></div></div>`;
  }

  function masteryContent() {
    return `<div class="mastery-heading">${icon('dominion')}<div><strong>${t('mastery')}</strong><p>${t('masteryCopy')}</p></div></div>
      <div class="mastery-progress"><div class="progress-caption"><span>${t('kills')}</span><b>720 / 1.000</b></div><div class="tiny-track"><span></span></div></div>
      <div class="next-bonus"><span>${t('nextReward')}</span><strong>${t('bonus')}</strong></div>
      <div class="production" style="margin-top:16px"><span class="production-label">${t('dominion')}</span><div class="production-values">III <span class="stat-label">/ V</span></div></div>`;
  }

  function panelContent(tab) {
    return tab === 'enemies' ? combatContent() : tab === 'dominion' ? masteryContent() : resourceContent(tab);
  }

  function hudMarkup(design, expanded, instance) {
    const panelId = `panel-${design.id}-${instance}`;
    return `<div class="hud hud--${design.id}${expanded ? ' is-open' : ''}${health < 25 ? ' is-critical' : ''}${health === 0 ? ' is-dead' : ''}" data-design="${design.id}" data-tab="enemies">
      <div class="hud-head">
        <div class="activity-medallion" title="${t('xp')} 64%"><img class="activity-img" src="assets/sword.png" alt="${t('combat')}"><span class="level-badge"><small>${t('level')}</small>24</span></div>
        <div class="hud-main"><div class="identity"><strong class="hero-name">Seraphel</strong><span class="activity-status">${activity()}</span></div>
          <div class="vital-number"><span data-hp-number>${hpText()}</span><small>/ ${format(2480)}</small></div>
          <div class="meter meter--health" role="progressbar" aria-label="${t('hp')}" aria-valuemin="0" aria-valuemax="2480" aria-valuenow="${Math.round(2480 * health / 100)}"><span class="meter-fill"></span><span class="meter-name">${t('hp')}</span><span class="meter-value"><span data-hp-number>${hpText()}</span> / ${format(2480)}</span></div>
          <div class="meter meter--mana" role="progressbar" aria-label="${t('mp')}" aria-valuemin="0" aria-valuemax="640" aria-valuenow="397"><span class="meter-fill"></span><span class="meter-name">${t('mp')}</span><span class="meter-value">397 / 640</span></div>
          <div class="xp-line" role="progressbar" aria-label="${t('xp')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="64"><span></span></div>
        </div>
      </div>
      <button class="fold-handle" type="button" aria-expanded="${expanded}" aria-controls="${panelId}" aria-label="${t(expanded ? 'closeMap' : 'openMap')}"><span class="handle-location">${icon('map')}${t('map')}</span>${icon('chevron','chevron')}</button>
      <div class="map-panel" id="${panelId}" ${expanded ? '' : 'hidden'}>
        <div class="map-meta"><span>${t('zone')} · MIDGARD</span><span class="advantage">${icon('shield')}${t('safe')}</span></div>
        <div class="map-tabs" role="tablist" aria-label="${t('map')}">
          ${['enemies', 'mining', 'wood', 'dominion'].map((tab, index) => `<button class="map-tab" type="button" role="tab" id="${panelId}-tab-${tab}" data-tab="${tab}" aria-label="${t(tab)}" title="${t(tab)}" aria-selected="${index === 0}" aria-controls="${panelId}-content" tabindex="${index === 0 ? '0' : '-1'}">${icon(index === 0 ? 'swords' : tab)}<span>${t(tab)}</span></button>`).join('')}
        </div>
        <div class="panel-body" id="${panelId}-content" role="tabpanel" aria-labelledby="${panelId}-tab-enemies" tabindex="0">${combatContent()}</div>
      </div>
    </div>`;
  }

  function cardMarkup(design) {
    const favorite = favorites.has(design.id);
    return `<article class="design-card${favorite ? ' is-favorite' : ''}" id="${design.id}" style="--design-accent:${design.accent}" aria-labelledby="title-${design.id}">
      <div class="card-heading"><div class="card-title-row"><span class="design-number">0${design.number}</span><h2 id="title-${design.id}">${t(`design${design.number}`)}</h2><span class="design-tag">${t(`tag${design.number}`)}</span><button type="button" class="favorite" data-favorite="${design.id}" aria-label="${t(favorite ? 'unfavorite' : 'favorite')}" aria-pressed="${favorite}" title="${t(favorite ? 'unfavorite' : 'favorite')}">${icon('star')}</button></div><p class="card-description">${t(`desc${design.number}`)}</p></div>
      <div class="previews"><div class="preview preview--compact"><span class="state-label"><span class="state-line"></span><span data-state-label>${t('compact')}</span></span>${hudMarkup(design, false, 'compact')}<span class="sample-coordinate" aria-hidden="true">MIDGARD / 01</span></div>
      <div class="preview preview--expanded"><span class="state-label"><span class="state-line"></span><span data-state-label>${t('expanded')}</span></span>${hudMarkup(design, true, 'expanded')}<span class="sample-coordinate" aria-hidden="true">64 : 128</span></div></div>
      <div class="card-footer"><span class="card-note">${t(`note${design.number}`)}</span><button type="button" class="detail-button" data-focus="${design.id}">${icon('expand')}<span>${t('detail')}</span></button></div>
    </article>`;
  }

  function render() {
    document.documentElement.lang = language;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    const languageButton = document.getElementById('language');
    languageButton.textContent = language === 'es' ? 'EN' : 'ES';
    languageButton.setAttribute('aria-label', language === 'es' ? 'Switch to English' : 'Cambiar a español');
    gallery.innerHTML = designs.map(cardMarkup).join('');
    if (focusDesign) renderFocus(focusDesign);
    updateHealth(health);
  }

  function updateHealth(value, effect) {
    health = Math.min(100, Math.max(0, Number(value)));
    document.documentElement.style.setProperty('--hp', `${health}%`);
    document.getElementById('health').value = health;
    document.getElementById('health-output').textContent = `${health}%`;
    document.querySelectorAll('[data-hp-number]').forEach(el => { el.textContent = hpText(); });
    document.querySelectorAll('.hud').forEach(hud => {
      hud.classList.toggle('is-critical', health < 25);
      hud.classList.toggle('is-dead', health === 0);
      hud.querySelector('.meter--health').setAttribute('aria-valuenow', Math.round(2480 * health / 100));
      hud.querySelector('.activity-status').textContent = activity();
    });
    if (effect) {
      clearTimeout(animationTimeout);
      document.querySelectorAll('.hud').forEach(hud => hud.classList.remove('is-hit', 'is-healing'));
      void gallery.offsetWidth;
      document.querySelectorAll('.hud').forEach(hud => hud.classList.add(effect));
      animationTimeout = setTimeout(() => document.querySelectorAll('.hud').forEach(hud => hud.classList.remove('is-hit', 'is-healing')), 550);
    }
  }

  function togglePanel(button) {
    const hud = button.closest('.hud');
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', t(expanded ? 'closeMap' : 'openMap'));
    hud.classList.toggle('is-open', expanded);
    hud.querySelector('.map-panel').hidden = !expanded;
    const preview = hud.closest('.preview');
    if (preview) {
      preview.querySelector('[data-state-label]').textContent = t(expanded ? 'expanded' : 'compact');
      preview.classList.toggle('has-expanded-hud', expanded);
    }
  }

  function selectTab(button) {
    const hud = button.closest('.hud');
    hud.dataset.tab = button.dataset.tab;
    hud.querySelectorAll('.map-tab').forEach(tab => {
      const selected = tab === button;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    const body = hud.querySelector('.panel-body');
    body.innerHTML = panelContent(button.dataset.tab);
    body.setAttribute('aria-labelledby', button.id);
  }

  function renderFocus(design) {
    document.getElementById('focus-title').textContent = `0${design.number} / ${t(`design${design.number}`)}`;
    document.getElementById('focus-stage').innerHTML = hudMarkup(design, true, 'focus');
    updateHealth(health);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.classList.contains('fold-handle')) togglePanel(button);
    if (button.classList.contains('map-tab')) selectTab(button);
    if (button.dataset.favorite) {
      const id = button.dataset.favorite;
      favorites.has(id) ? favorites.delete(id) : favorites.add(id);
      const selected = favorites.has(id);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', t(selected ? 'unfavorite' : 'favorite'));
      button.title = t(selected ? 'unfavorite' : 'favorite');
      button.closest('.design-card').classList.toggle('is-favorite', selected);
      document.getElementById('announcement').textContent = t(selected ? 'favoriteSaved' : 'favoriteRemoved');
      try { localStorage.setItem('valhalla-hud-lab-favorites', JSON.stringify([...favorites])); } catch {}
    }
    if (button.dataset.focus) {
      focusDesign = designs.find(d => d.id === button.dataset.focus);
      renderFocus(focusDesign);
      dialog.showModal();
    }
  });
  document.addEventListener('keydown', event => {
    const button = event.target.closest('.map-tab');
    if (!button || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(button.parentElement.querySelectorAll('.map-tab'));
    let index = tabs.indexOf(button);
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = tabs.length - 1;
    else index = (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[index]);
    tabs[index].focus();
  });
  document.getElementById('health').addEventListener('input', event => updateHealth(event.target.value));
  document.getElementById('damage').addEventListener('click', () => updateHealth(health - 18, 'is-hit'));
  document.getElementById('heal').addEventListener('click', () => updateHealth(health + 25, 'is-healing'));
  document.getElementById('background').addEventListener('change', event => { document.body.dataset.background = event.target.value; });
  document.getElementById('reset').addEventListener('click', () => {
    health = 76;
    document.getElementById('background').value = 'forest';
    document.body.dataset.background = 'forest';
    render();
  });
  document.getElementById('language').addEventListener('click', () => { language = language === 'es' ? 'en' : 'es'; render(); });
  document.getElementById('close-focus').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => { focusDesign = null; document.getElementById('focus-stage').innerHTML = ''; });
  render();
})();
