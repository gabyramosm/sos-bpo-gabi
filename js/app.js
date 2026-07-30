/* ============================================================
   app.js — Bootstrap y conexión de todos los módulos
   Maneja DOM + respuestas síncronas (onboarding) y async (IA)
   ============================================================ */

(function () {

  /* ── Referencias al DOM ──────────────────────────────────── */
  var chatMessages     = document.getElementById('chatMessages');
  var chatInput        = document.getElementById('chatInput');
  var btnSend          = document.getElementById('btnSend');
  var btnOpenMetrics   = document.getElementById('btnOpenMetrics');
  var btnCloseMetrics  = document.getElementById('btnCloseMetrics');
  var btnCloseMetrics2 = document.getElementById('btnCloseMetrics2');
  var btnResetMetrics  = document.getElementById('btnResetMetrics');
  var metricsModal     = document.getElementById('metricsModal');
  var metricsBody      = document.getElementById('metricsBody');

  /* ── Estado de la UI ─────────────────────────────────────── */
  var isWaiting          = false;
  var currentFlowTracked = null;
  var errorCount         = 0;   // contador de errores consecutivos de conexión

  /* ============================================================
     UTILIDADES DE RENDERIZADO
     ============================================================ */

  /* ── Ruta base del proyecto (funciona en file:// y http://) ── */
  var BASE_PATH = (function () {
    // Obtener la carpeta donde está index.html
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf('app.js') !== -1) {
        // .../sos-bpo-gabi/js/app.js → .../sos-bpo-gabi/
        return scripts[i].src.replace(/js\/app\.js.*$/, '');
      }
    }
    // Fallback: usar la URL de la página actual
    return window.location.href.replace(/[^/]*$/, '');
  })();

  /* Mapa de caracteres HTML peligrosos (solo texto plano, no HTML de confianza) */
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Formatea texto de los flujos (origen interno confiable).
   * No se usa para entradas del usuario — éstas se insertan con textContent.
   */
  function formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
      // Resolver rutas relativas de imágenes assets/ con la ruta base correcta
      .replace(/src="assets\//g, 'src="' + BASE_PATH + 'assets/');
  }

  function getTime() {
    return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /* ============================================================
     RENDERIZADO DE MENSAJES
     ============================================================ */

  function appendMessage(text, sender) {
    var row = document.createElement('div');
    row.className = 'message-row message-row--' + sender;

    if (sender === 'gabi') {
      var avatarImg = document.createElement('img');
      avatarImg.src = BASE_PATH + 'assets/gabi-avatar.svg';
      avatarImg.alt = 'Gabi';
      avatarImg.className = 'message-row__avatar';
      row.appendChild(avatarImg);
    }

    var bubble = document.createElement('div');
    bubble.className = 'bubble bubble--' + sender;
    // Mensajes de Gabi (flujos internos): usar innerHTML para permitir HTML seguro (links, código, imágenes)
    // Mensajes del usuario: escapar para prevenir XSS
    if (sender === 'gabi') {
      bubble.innerHTML = formatText(text) +
        '<span class="bubble__time">' + getTime() + '</span>';
    } else {
      bubble.innerHTML = escapeHtml(text) +
        '<span class="bubble__time">' + getTime() + '</span>';
    }

    row.appendChild(bubble);
    chatMessages.appendChild(row);
    scrollToBottom();
    return row;
  }

  function appendDivider(label) {
    var div = document.createElement('div');
    div.className = 'system-divider';
    div.textContent = label;
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function appendOptions(options) {
    if (!options || options.length === 0) return;
    var row = document.createElement('div');
    row.className = 'options-row';
    row.id = 'currentOptions';

    options.forEach(function (opt) {
      var chip = document.createElement('button');
      chip.className = 'option-chip' + (opt.isAction ? ' option-chip--action' : '');
      chip.textContent = opt.label;
      chip.addEventListener('click', function () { handleOptionClick(opt); });
      row.appendChild(chip);
    });

    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function clearOptions() {
    var existing = document.getElementById('currentOptions');
    if (existing) existing.remove();
  }

  /* ============================================================
     ANIMACIÓN DE ESCRITURA
     ============================================================ */

  /** Typing indicator para respuestas síncronas (onboarding) */
  function typeAndShow(text, options, delay) {
    delay = delay || 600;
    return new Promise(function (resolve) {
      var row = document.createElement('div');
      row.className = 'message-row message-row--gabi';
      var avatarImg = document.createElement('img');
      avatarImg.src = BASE_PATH + 'assets/gabi-avatar.svg';
      avatarImg.alt = 'Gabi';
      avatarImg.className = 'message-row__avatar';
      row.appendChild(avatarImg);
      var indicator = document.createElement('div');
      indicator.className = 'typing-indicator';
      indicator.innerHTML = '<span></span><span></span><span></span>';
      row.appendChild(indicator);
      chatMessages.appendChild(row);
      scrollToBottom();
      setTimeout(function () {
        row.remove();
        appendMessage(text, 'gabi');
        appendOptions(options);
        resolve();
      }, delay);
    });
  }

  /** Typing indicator para respuestas async (IA) — devuelve la fila para removerla */
  function showTyping() {
    return new Promise(function (resolve) {
      var row = document.createElement('div');
      row.className = 'message-row message-row--gabi';
      var avatarImg = document.createElement('img');
      avatarImg.src = BASE_PATH + 'assets/gabi-avatar.svg';
      avatarImg.alt = 'Gabi';
      avatarImg.className = 'message-row__avatar';
      row.appendChild(avatarImg);
      var indicator = document.createElement('div');
      indicator.className = 'typing-indicator';
      indicator.innerHTML = '<span></span><span></span><span></span>';
      row.appendChild(indicator);
      chatMessages.appendChild(row);
      scrollToBottom();
      setTimeout(function () { resolve(row); }, 300);
    });
  }

  /* ============================================================
     MANEJO DE ERRORES DE CONEXIÓN
     ============================================================ */

  /**
   * Cuando Gabi no puede conectar con el servidor, muestra un mensaje
   * amigable y ofrece reiniciar. Si falla 2 veces seguidas, reinicia solo.
   */
  function handleConnectionError() {
    errorCount++;

    if (errorCount >= 2) {
      // Reinicio automático suave tras 2 errores consecutivos
      errorCount = 0;
      appendMessage(
        'Parece que perdí la conexión. 😔 Vamos a empezar de nuevo para que pueda ayudarte bien.',
        'gabi'
      );
      setTimeout(function () {
        startNewSession();
      }, 2500);
    } else {
      // Primer error: ofrecer reintentar o reiniciar
      appendMessage(
        'Tuve un problema de conexión ahora. 🙏 Podés intentar de nuevo o iniciar una consulta nueva.',
        'gabi'
      );
      var retryOptions = [
        { label: '🔄 Intentar de nuevo',    nextId: null, _retry: true },
        { label: '🆕 Iniciar nueva consulta', nextId: null, isReset: true }
      ];
      appendOptions(retryOptions);
    }

    setInputEnabled(true);
    chatInput.focus();
  }

  /* ============================================================
     LÓGICA DE INTERACCIÓN
     ============================================================ */

  function presentNode(node, userLabel) {
    if (!node) return;
    clearOptions();
    if (userLabel) appendMessage(userLabel, 'user');

    var flow = Engine.getCurrentFlow();
    if (flow && flow !== currentFlowTracked) {
      currentFlowTracked = flow;
      Metrics.trackCaseStarted(flow);
      appendDivider(labelForFlow(flow));
    }

    if (node.end === 'resolved') {
      Metrics.trackCaseResolved(node.topic || currentFlowTracked);
    } else if (node.end === 'escalated') {
      Metrics.trackCaseEscalated(node.topic || currentFlowTracked, Engine.getStepSummary());
    }

    var delay = Math.min(300 + node.message.length * 1.5, 1200);
    typeAndShow(node.message, node.options, delay).then(function () {
      if (node.end) appendNewSessionButton();
      updateHeaderProfile();
      // Mostrar banner de casos demo cuando llega el nodo de bienvenida IA
      if (node.id === '__ai_ready__') {
        var banner = document.getElementById('demoBanner');
        if (banner) banner.style.display = 'block';
      }
      setInputEnabled(!node.end);
    });
  }

  function handleAIResponse(result, userLabel) {
    setInputEnabled(false);
    if (userLabel) appendMessage(userLabel, 'user');
    showTyping().then(function (typingRow) {
      result._aiPromise.then(function (node) {
        typingRow.remove();

        if (!node || !node.message) {
          handleConnectionError();
          return;
        }

        var isConnectionError = node.message.indexOf('error de conexión') !== -1 ||
                                node.message.indexOf('problema con mi conexión') !== -1;
        if (isConnectionError) {
          handleConnectionError();
          return;
        }

        errorCount = 0;

        var flow = Engine.getCurrentFlow();
        if (flow && flow !== currentFlowTracked) {
          currentFlowTracked = flow;
          Metrics.trackCaseStarted(flow);
          appendDivider(labelForFlow(flow));
        }

        if (node.end === 'resolved')  Metrics.trackCaseResolved(Engine.getCurrentFlow());
        if (node.end === 'escalated') Metrics.trackCaseEscalated(Engine.getCurrentFlow(), '');

        // Local: usa typeAndShow con chips del árbol. IA: appendMessage directo.
        var delay = Math.min(300 + node.message.length * 1.5, 900);
        typeAndShow(node.message, node.options || [], delay).then(function () {
          if (node.end) appendNewSessionButton();
          updateHeaderProfile();
          setInputEnabled(!node.end);
          if (!node.end) chatInput.focus();
        });

      }).catch(function () {
        typingRow.remove();
        handleConnectionError();
      });
    });
  }

  function updateHeaderProfile() {
    var profile = Engine.getProfile();
    if (!profile || !profile.name) return;
    var nameEl = document.getElementById('headerUserName');
    if (nameEl) {
      nameEl.textContent = profile.name;
    } else {
      var info = document.querySelector('.chat-header__info');
      if (info) {
        var span = document.createElement('div');
        span.id = 'headerUserName';
        span.className = 'chat-header__user';
        span.textContent = profile.name;
        info.appendChild(span);
      }
    }
    if (profile.client) {
      var statusEl = document.querySelector('.chat-header__status');
      if (statusEl) statusEl.textContent = '● En línea · ' + profile.client;
    }
  }

  function labelForFlow(flow) {
    var labels = {
      'mfa':                'MFA / IBM Verify',
      'usuario-nuevo':      'Usuario nuevo',
      'reemplazo-notebook': 'Reemplazo de notebook',
      'bitlocker':          'BitLocker',
      'w3':                 'Acceso a W3'
    };
    return labels[flow] || flow;
  }

  function setInputEnabled(enabled) {
    chatInput.disabled = !enabled;
    btnSend.disabled   = !enabled;
    isWaiting          = !enabled;
  }

  function appendNewSessionButton() {
    var row = document.createElement('div');
    row.className = 'new-session-row';
    var btn = document.createElement('button');
    btn.className   = 'btn-new-session';
    btn.textContent = '🔄 Nueva consulta';
    btn.addEventListener('click', startNewSession);
    row.appendChild(btn);
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  /* ============================================================
     MANEJO DE EVENTOS DE USUARIO
     ============================================================ */

  function handleOptionClick(opt) {
    if (isWaiting) return;

    // Reinicio: "✅ Sí, tengo otra consulta" o cualquier chip isReset
    if (opt.isReset) {
      startNewSession();
      return;
    }

    // Reintento tras error de conexión
    if (opt._retry) {
      clearOptions();
      handleTextInput();
      return;
    }

    // Navegación directa a nodo local (ej. goodbye) sin pasar por el engine
    // Esto evita que el nodo aterrice en el bloque __ai_mode__ del engine
    if (opt.nextId && FLOWS.nodeMap[opt.nextId]) {
      clearOptions();
      appendMessage(opt.label, 'user');
      showTyping().then(function (typingRow) {
        Engine.localNodeReply(opt.nextId).then(function (node) {
          typingRow.remove();
          appendMessage(node.message, 'gabi');
          appendOptions(node.options || []);
          if (node.end) appendNewSessionButton();
          scrollToBottom();
        });
      });
      return;
    }

    var extraMeta = {};
    if (opt._clientValue !== undefined) extraMeta._clientValue = opt._clientValue;
    if (opt._deviceValue !== undefined) extraMeta._deviceValue = opt._deviceValue;
    if (opt._aiSeed      !== undefined) extraMeta._aiSeed      = opt._aiSeed;

    var result = Engine.handleInput(opt.label, opt.nextId, opt.isReset, extraMeta);

    if (result && result._aiPromise) {
      handleAIResponse(result, opt.label);
    } else {
      presentNode(result.node, opt.label);
    }
  }

  function handleTextInput() {
    var text = chatInput.value.trim();
    if (!text || isWaiting) return;
    chatInput.value = '';

    var result = Engine.handleInput(text, null, false, {});

    if (result && result._aiPromise) {
      handleAIResponse(result, text);
    } else {
      presentNode(result.node, text);
    }
  }

  function startNewSession() {
    errorCount         = 0;
    currentFlowTracked = null;
    chatMessages.innerHTML = '';
    var rootNode = Engine.reset();
    setInputEnabled(true);
    chatInput.value = '';
    chatInput.focus();
    presentNode(rootNode, null);
  }

  /* ============================================================
     MODAL DE MÉTRICAS
     ============================================================ */

  function openMetricsModal()  { metricsBody.innerHTML = Metrics.renderModal(); metricsModal.classList.add('is-open'); }
  function closeMetricsModal() { metricsModal.classList.remove('is-open'); }

  btnOpenMetrics.addEventListener('click',   openMetricsModal);
  btnCloseMetrics.addEventListener('click',  closeMetricsModal);
  btnCloseMetrics2.addEventListener('click', closeMetricsModal);
  btnResetMetrics.addEventListener('click', function () {
    if (confirm('¿Seguro que querés resetear todas las métricas? Esta acción no se puede deshacer.')) {
      Metrics.resetMetrics();
      metricsBody.innerHTML = Metrics.renderModal();
    }
  });
  metricsModal.addEventListener('click', function (e) { if (e.target === metricsModal) closeMetricsModal(); });
  document.addEventListener('keydown',   function (e) { if (e.key === 'Escape') closeMetricsModal(); });

  /* ============================================================
     EVENTOS DE ENTRADA
     ============================================================ */

  btnSend.addEventListener('click', handleTextInput);
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextInput(); }
  });

  /* ============================================================
     INICIO DE LA APLICACIÓN
     ============================================================ */

  var initialNode = Engine.init();
  setInputEnabled(true);
  presentNode(initialNode, null);
  chatInput.focus();

})();
