/* ============================================================
   metrics.js — Registro y persistencia de métricas en localStorage

   API pública:
     Metrics.trackCaseStarted(topic)
     Metrics.trackCaseResolved(topic)
     Metrics.trackCaseEscalated(topic, reason)
     Metrics.getMetrics()
     Metrics.resetMetrics()
     Metrics.renderModal()           → genera el HTML del modal de métricas
   ============================================================ */

var Metrics = (function () {

  var STORAGE_KEY = 'gabi_metrics';

  var TOPIC_LABELS = {
    'mfa':                'MFA / IBM Verify',
    'usuario-nuevo':      'Usuario nuevo',
    'reemplazo-notebook': 'Reemplazo de notebook',
    'bitlocker':          'BitLocker',
    'w3':                 'Acceso a W3'
  };

  /* ── Estructura inicial de métricas ─────────────────────── */
  function emptyMetrics() {
    return {
      totalStarted:   0,
      totalResolved:  0,
      totalEscalated: 0,
      byTopic: {
        'mfa':                { started: 0, resolved: 0, escalated: 0 },
        'usuario-nuevo':      { started: 0, resolved: 0, escalated: 0 },
        'reemplazo-notebook': { started: 0, resolved: 0, escalated: 0 },
        'bitlocker':          { started: 0, resolved: 0, escalated: 0 },
        'w3':                 { started: 0, resolved: 0, escalated: 0 }
      },
      escalationReasons: [],    // Array de { topic, reason, timestamp }
      newPatterns: [],           // Para patrones detectados manualmente en el futuro
      lastUpdated: null
    };
  }

  /* ── Leer desde localStorage ─────────────────────────────── */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyMetrics();
      var parsed = JSON.parse(raw);
      // Asegurar que tiene la estructura completa (compatibilidad futura)
      var empty = emptyMetrics();
      return Object.assign(empty, parsed);
    } catch (e) {
      return emptyMetrics();
    }
  }

  /* ── Guardar en localStorage ─────────────────────────────── */
  function save(data) {
    data.lastUpdated = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[Metrics] No se pudo guardar en localStorage:', e);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     API PÚBLICA
     ───────────────────────────────────────────────────────────── */

  /**
   * Registrar inicio de un caso.
   * @param {string} topic - identificador del flujo (mfa, bitlocker, etc.)
   */
  function trackCaseStarted(topic) {
    if (!topic) return;
    var data = load();
    data.totalStarted++;
    if (data.byTopic[topic]) {
      data.byTopic[topic].started++;
    }
    save(data);
  }

  /**
   * Registrar resolución exitosa sin soporte humano.
   * @param {string} topic
   */
  function trackCaseResolved(topic) {
    if (!topic) return;
    var data = load();
    data.totalResolved++;
    if (data.byTopic[topic]) {
      data.byTopic[topic].resolved++;
    }
    save(data);
  }

  /**
   * Registrar escalamiento a soporte humano.
   * @param {string} topic
   * @param {string} reason - descripción del motivo (opcional)
   */
  function trackCaseEscalated(topic, reason) {
    if (!topic) return;
    var data = load();
    data.totalEscalated++;
    if (data.byTopic[topic]) {
      data.byTopic[topic].escalated++;
    }
    data.escalationReasons.push({
      topic: topic,
      reason: reason || 'Sin especificar',
      timestamp: new Date().toLocaleString('es-AR')
    });
    save(data);
  }

  /**
   * Obtener las métricas actuales.
   * @returns {Object}
   */
  function getMetrics() {
    return load();
  }

  /**
   * Resetear todas las métricas.
   */
  function resetMetrics() {
    save(emptyMetrics());
  }

  /**
   * Genera el HTML del contenido del modal de métricas.
   * @returns {string} HTML
   */
  function renderModal() {
    var data = load();
    var resolutionRate = data.totalStarted > 0
      ? Math.round((data.totalResolved / data.totalStarted) * 100)
      : 0;

    var lastUpdated = data.lastUpdated
      ? new Date(data.lastUpdated).toLocaleString('es-AR')
      : 'Sin datos aún';

    // Tarjetas principales
    var cardsHtml =
      '<div class="metric-card">' +
        '<span class="metric-card__label">Casos iniciados</span>' +
        '<span class="metric-card__value">' + data.totalStarted + '</span>' +
      '</div>' +
      '<div class="metric-card metric-card--resolved">' +
        '<span class="metric-card__label">Resueltos sin soporte humano</span>' +
        '<span class="metric-card__value">' + data.totalResolved + '</span>' +
      '</div>' +
      '<div class="metric-card metric-card--escalated">' +
        '<span class="metric-card__label">Escalados a soporte</span>' +
        '<span class="metric-card__value">' + data.totalEscalated + '</span>' +
      '</div>' +
      '<div class="metric-card">' +
        '<span class="metric-card__label">Tasa de resolución autónoma</span>' +
        '<span class="metric-card__value" style="color: ' + (resolutionRate >= 70 ? 'var(--ibm-green-50)' : 'var(--ibm-yellow-20)') + '">' + resolutionRate + '%</span>' +
      '</div>';

    // Tabla por temas
    var topicsRows = Object.keys(data.byTopic).map(function (topic) {
      var t = data.byTopic[topic];
      var label = TOPIC_LABELS[topic] || topic;
      return '<tr>' +
        '<td>' + label + '</td>' +
        '<td style="text-align:center">' + t.started + '</td>' +
        '<td style="text-align:center;color:var(--ibm-green-50)">' + t.resolved + '</td>' +
        '<td style="text-align:center;color:var(--ibm-red-60)">' + t.escalated + '</td>' +
      '</tr>';
    }).join('');

    var topicsHtml =
      '<table class="topics-table">' +
        '<thead><tr>' +
          '<th>Tema</th>' +
          '<th style="text-align:center">Iniciados</th>' +
          '<th style="text-align:center">Resueltos</th>' +
          '<th style="text-align:center">Escalados</th>' +
        '</tr></thead>' +
        '<tbody>' + topicsRows + '</tbody>' +
      '</table>';

    var footerHtml =
      '<p style="font-size:11px;color:var(--text-muted);margin-top:4px">Última actualización: ' + lastUpdated + '</p>';

    return cardsHtml + topicsHtml + footerHtml;
  }

  return {
    trackCaseStarted:   trackCaseStarted,
    trackCaseResolved:  trackCaseResolved,
    trackCaseEscalated: trackCaseEscalated,
    getMetrics:         getMetrics,
    resetMetrics:       resetMetrics,
    renderModal:        renderModal
  };

})();
