/* ============================================================
   engine.js — Motor híbrido: onboarding estático + IA watsonx
   ============================================================ */

var Engine = (function () {

  var state = {
    currentNodeId:  '__onboarding_name__',
    currentFlow:    null,
    stepsHistory:   [],
    sessionStarted: false,
    profile: { name: null, email: null, client: null, device: null, apps: null }
  };

  var conversationHistory = [];

  /* ── Detectar si el input parece un nombre latinoamericano ── */
  function isLikelyName(text) {
    if (!text || text.trim().length === 0) return false;
    var t = text.trim();
    if (t.split(/\s+/).length > 3) return false;
    if (/[0-9@#$%&*()=+\[\]{};:,.<>?!¿¡/\\]/.test(t)) return false;
    var noNames = [
      'hola','buenos','buenas','dias','tardes','noches','gracias','ok','si','no',
      'ayuda','ayudame','problema','tengo','quiero','necesito','puedo',
      'mfa','vpn','outlook','slack','notebook','bitlocker','wifi','error',
      'computadora','celular','equipo','sistema','acceso','contrasena','password'
    ];
    var lower = t.toLowerCase();
    if (noNames.indexOf(lower) !== -1) return false;
    var latinNames = [
      'gabriela','gabi','gabriella','valeria','valentina','camila','sofia','lucia',
      'martina','victoria','florencia','agustina','carolina','paula','andrea','natalia',
      'daniela','alejandra','paola','monica','claudia','patricia','beatriz','rosa',
      'maria','ana','laura','julia','elena','isabel','fernanda','antonella','milagros',
      'rocio','celeste','brenda','vanesa','melina','silvina','noelia','romina','micaela',
      'soledad','lorena','mariana','veronica','sabrina','karina','graciela','magdalena',
      'constanza','pilar','renata','emilia','catalina','bianca','lourdes','candela',
      'azul','abril','ayelen','giselle','tamara','stefania','xiomara',
      'juan','jose','carlos','luis','miguel','jorge','pedro','pablo','diego','sergio',
      'alejandro','fernando','gabriel','martin','rodrigo','gustavo','andres','sebastian',
      'nicolas','mateo','santiago','federico','facundo','ignacio','maximiliano','maximo',
      'hernan','horacio','oscar','alberto','roberto','mario','daniel','marcelo','walter',
      'lucas','ezequiel','alan','brian','kevin','ivan','cristian','franco','leandro',
      'nahuel','tobias','joaquin','lautaro','thiago','tomas','agustin','emiliano',
      'gonzalo','ramiro','lisandro','claudio','ariel','javier','raul','hugo','antonio',
      'manuel','david','rafael','cesar','hector','ruben','gerardo','ernesto','gaston',
      'esteban','mariano','damian','german','fabian','nelson','axel','miriam','yasmin',
      'yolanda','esther','estefania','vanessa','melissa','jessica','luz','jesus','angel'
    ];
    var words = lower.split(/\s+/);
    var matchCount = 0;
    for (var i = 0; i < words.length; i++) {
      var word = words[i]
        .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i')
        .replace(/ó/g,'o').replace(/ú/g,'u').replace(/ü/g,'u');
      if (latinNames.indexOf(word) !== -1) matchCount++;
    }
    if (matchCount > 0) return true;
    if (words.length <= 2 && /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s]+$/.test(t)) return true;
    return false;
  }

  /* ── Nodos de onboarding ─────────────────────────────────── */
  function onboardingNameNode() {
    return {
      id: '__onboarding_name__',
      message:
        '¡Hola! Soy **Gabi**, tu compañera de soporte IT de SOS BPO. 👋\n\n' +
        'Antes de arrancar, ¿cómo te llamás?',
      options: [],
      _isProfileQuestion: 'name'
    };
  }

  function onboardingClientNode(unknownInput) {
    var name     = state.profile.name || '';
    var greeting = name
      ? '¡Hola, **' + name + '**! Genial conocerte. 😊\n\n'
      : (unknownInput
          ? 'Mmm, no estoy segura si eso es un nombre. 😅 No hay problema — podés decirme cómo te llamás o pasamos directo.\n\n'
          : '¡Hola! 😊\n\n');
    return {
      id: '__onboarding_client__',
      message: greeting + '¿Para qué cliente trabajás dentro de IBM?',
      options: [
        { label: 'Carrefour', nextId: '__onboarding_device__', _clientValue: 'Carrefour' },
        { label: 'Dorinka',   nextId: '__onboarding_device__', _clientValue: 'Dorinka'   },
        { label: 'Naturgy',   nextId: '__onboarding_device__', _clientValue: 'Naturgy'   },
        { label: 'LATAM',     nextId: '__onboarding_device__', _clientValue: 'LATAM'     },
        { label: 'Otro',      nextId: '__onboarding_device__', _clientValue: 'Otro'      }
      ],
      _isProfileQuestion: 'client'
    };
  }

  function onboardingDeviceNode() {
    var client = state.profile.client || 'el cliente';
    var name   = state.profile.name   || '';
    return {
      id: '__onboarding_device__',
      message:
        (name ? 'Perfecto, **' + name + '**.\n\n' : 'Perfecto.\n\n') +
        '¿Qué equipo usás para trabajar con **' + client + '**?',
      options: [
        { label: '💻 Lenovo', nextId: '__ai_ready__', _deviceValue: 'Lenovo' },
        { label: '💻 Dell',   nextId: '__ai_ready__', _deviceValue: 'Dell'   },
        { label: '❓ No sé',  nextId: '__ai_ready__', _deviceValue: null     }
      ],
      _isProfileQuestion: 'device'
    };
  }

  function aiWelcomeNode() {
    var name = state.profile.name || '';
    return {
      id: '__ai_ready__',
      message:
        (name ? 'Gracias, **' + name + '**. ' : '') +
        'Estoy lista para ayudarte. 🤝\n\n' +
        '¿Qué estabas intentando hacer cuando apareció el problema?\n\n' +
        'Contame con tus palabras o elegí una opción:',
      options: [
        { label: '🔐 Problema con MFA / IBM Verify',                   nextId: null, _aiSeed: 'Tengo un problema con el MFA o IBM Verify' },
        { label: '🔑 No puedo acceder a W3 o se venció mi contraseña', nextId: null, _aiSeed: 'No puedo acceder a W3 o tengo la contraseña vencida' },
        { label: '🆕 Es mi primer día y no tengo los accesos',          nextId: null, _aiSeed: 'Soy usuario nuevo, es mi primer día y no tengo los accesos configurados' },
        { label: '💻 Me dieron una notebook nueva',                     nextId: null, _aiSeed: 'Me dieron una notebook nueva y necesito configurarla' },
        { label: '🔒 Me apareció una pantalla de BitLocker',            nextId: null, _aiSeed: 'Me apareció una pantalla de cifrado BitLocker al arrancar la notebook' }
      ],
      _isIssueSelector: true
    };
  }

  /* ── Inicializar ─────────────────────────────────────────── */
  function init() {
    state.currentNodeId  = '__onboarding_name__';
    state.currentFlow    = null;
    state.stepsHistory   = [];
    state.sessionStarted = true;
    state.profile        = { name: null, email: null, client: null, device: null, apps: null };
    conversationHistory  = [];
    return onboardingNameNode();
  }

  /* ── Detectar si estamos en localhost ───────────────────── */
  var IS_LOCAL = (function () {
    return true;
     })();

  /* ── Opciones del selector (reutilizado en varios lugares) ── */
  var FLOW_OPTIONS = [
    { label: '🔐 Problema con MFA / IBM Verify',                   nextId: 'mfa_start' },
    { label: '🔑 No puedo acceder a W3 o se venció mi contraseña', nextId: 'w3_start' },
    { label: '🆕 Es mi primer día y no tengo los accesos',          nextId: 'new_user_start' },
    { label: '💻 Me dieron una notebook nueva',                     nextId: 'notebook_start' },
    { label: '🔒 Me apareció una pantalla de BitLocker',            nextId: 'bitlocker_start' }
  ];

  /* ── Clasificador determinístico por palabras clave ─────── */
  function classifyText(text) {
    var t = text.toLowerCase()
      .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i')
      .replace(/ó/g,'o').replace(/ú/g,'u').replace(/ü/g,'u');

    var keywords = {
      mfa: [
        'mfa','ibm verify','autenticacion','doble factor','multifactor',
        'codigo','sms','celular','passkey','biometria','huella','token',
        'no llega el codigo','no me llega el codigo','cambié de celular',
        'cambie de celular','perdi el celular','perdí el celular',
        'codigo no funciona','qr no funciona','segundo factor'
      ],
      bitlocker: [
        'bitlocker','recovery key','clave de recuperacion','48 numeros',
        'tpm','pantalla azul','cifrado','notebook bloqueada','disco cifrado',
        'pantalla de cifrado','me pide una clave de 48','clave numerica'
      ],
      w3: [
        'password','contrasena','contraseña vencida','w3id','acceso w3',
        'credenciales ibm','cambio de contrasena','w3 no me deja entrar',
        'vencio la contrasena','olvide la contrasena','reset password',
        'no puedo entrar a w3','intranet','ibm w3'
      ]
    };

    function hits(domain) {
      var kws = keywords[domain];
      for (var i = 0; i < kws.length; i++) {
        if (t.indexOf(kws[i]) !== -1) return true;
      }
      return false;
    }

    // BitLocker tiene prioridad sobre los demás (evita ambigüedades con "clave")
    if (hits('bitlocker')) return { domain: 'bitlocker', nodeId: 'bitlocker_start' };
    if (hits('mfa'))       return { domain: 'mfa',       nodeId: 'mfa_start'       };
    if (hits('w3'))        return { domain: 'w3',        nodeId: 'w3_start'        };
    return null;
  }

  /* Mensaje introductorio natural al clasificar */
  var CLASSIFY_INTROS = {
    mfa:       'Entendí — parece que el problema es con el **MFA o IBM Verify**. 🔐\nDejame ayudarte a resolverlo.',
    bitlocker: 'Entendí — parece que te apareció una pantalla de **BitLocker**. 🔒\nNo te preocupes, lo resolvemos juntos.',
    w3:        'Entendí — parece que el problema es con tu **contraseña o el acceso a W3**. 🔑\nTe guío paso a paso.'
  };

  /* ── Modo local: clasificar + derivar o mostrar selector ─── */
  function localFlowReply(userMessage) {
    var name       = state.profile.name || '';
    var classified = classifyText(userMessage);

    if (classified) {
      // Clasificación clara: mensaje natural + saltar directo al primer nodo del flujo
      var intro = (name ? name + ', ' : '') + CLASSIFY_INTROS[classified.domain];
      return localNodeReply(classified.nodeId).then(function (nodeReply) {
        // Prepend the classification intro to the node message
        nodeReply.message = intro + '\n\n' + nodeReply.message;
        return nodeReply;
      });
    }

    // Sin clasificación clara: mostrar selector de opciones
    return Promise.resolve({
      message:
        (name ? name + ', e' : 'E') + 'ntendí que tenés un problema. ' +
        'Para ayudarte mejor, ¿cuál de estas opciones describe lo que te está pasando?',
      options: FLOW_OPTIONS,
      _aiMode: false
    });
  }

  /* ── Modo local: navegar el árbol con chips ──────────────── */
  function localNodeReply(nodeId) {
    var node = FLOWS.nodeMap[nodeId];
    if (!node) return Promise.resolve({ message: 'No encontré ese paso. Empecemos de nuevo.', options: [], _aiMode: false });

    var msg = node.message
      .replace(/\{\{name\}\}/g,   state.profile.name   || 'vos')
      .replace(/\{\{client\}\}/g, state.profile.client || 'el cliente')
      .replace(/\{\{device\}\}/g, state.profile.device || 'tu equipo');

    state.currentNodeId = node.id;
    if (node.id.indexOf('mfa') === 0)        state.currentFlow = 'mfa';
    else if (node.id.indexOf('w3') === 0)    state.currentFlow = 'w3';
    else if (node.id.indexOf('new_user') === 0) state.currentFlow = 'usuario-nuevo';
    else if (node.id.indexOf('notebook') === 0) state.currentFlow = 'reemplazo-notebook';
    else if (node.id.indexOf('bitlocker') === 0) state.currentFlow = 'bitlocker';

    return Promise.resolve({
      message: msg,
      options: node.options || [],
      end:     node.end,
      topic:   node.topic,
      _aiMode: false
    });
  }

  /* ── Modo producción: llamada a watsonx via Vercel ───────── */
  function fetchAIReply(userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });

    return fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversationHistory, profile: state.profile })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var reply = data.reply || null;
      if (!reply) return { message: null, options: [], _aiMode: true };
      conversationHistory.push({ role: 'assistant', content: reply });
      var isEscalated = reply.indexOf('forms.monday.com') !== -1;
      var isResolved  = reply.indexOf('resolv') !== -1 && reply.indexOf('?') === -1;
      return {
        message: reply,
        options: [],
        _aiMode: true,
        end: isEscalated ? 'escalated' : (isResolved ? 'resolved' : undefined)
      };
    })
    .catch(function () {
      return { message: null, options: [], _aiMode: true };
    });
  }

  /* ── Dispatcher: local vs producción ────────────────────── */
  function getAIReply(userMessage, seedNodeId) {
    if (IS_LOCAL) {
      if (seedNodeId) return localNodeReply(seedNodeId);
      return localFlowReply(userMessage);
    }
    return fetchAIReply(userMessage);
  }

  /* ── Procesar entrada ────────────────────────────────────── */
  function handleInput(input, nextId, isReset, extraMeta) {

    if (isReset) {
      conversationHistory = [];
      return { node: init(), isNewFlow: true };
    }

    // Nombre
    if (state.currentNodeId === '__onboarding_name__') {
      var raw        = (input || '').trim();
      var recognized = isLikelyName(raw);
      if (recognized) {
        // Capitalizar cada palabra del nombre (soporta nombres compuestos)
        state.profile.name = raw.replace(/\S+/g, function (w) {
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        });
      }
      state.currentNodeId = '__onboarding_client__';
      return { node: onboardingClientNode(recognized ? null : raw), isNewFlow: false };
    }

    // Cliente
    if (state.currentNodeId === '__onboarding_client__') {
      var clientVal = (extraMeta && extraMeta._clientValue) || input;
      if (clientVal && clientVal.trim().length > 0) {
        state.profile.client = clientVal.charAt(0).toUpperCase() + clientVal.slice(1);
      }
      state.currentNodeId = '__onboarding_device__';
      return { node: onboardingDeviceNode(), isNewFlow: false };
    }

    // Dispositivo
    if (state.currentNodeId === '__onboarding_device__') {
      var deviceVal = (extraMeta && extraMeta._deviceValue !== undefined)
        ? extraMeta._deviceValue : (input || null);
      if (deviceVal) state.profile.device = deviceVal;
      state.currentNodeId = '__ai_ready__';
      return { node: aiWelcomeNode(), isNewFlow: false };
    }

    // Todo lo demás: watsonx en producción, flows.js en local
    state.currentNodeId = '__ai_mode__';

    var userMessage = (extraMeta && extraMeta._aiSeed) ? extraMeta._aiSeed : input;

    // En local: mapear _aiSeed al nodeId correcto para navegar el árbol directamente
    var seedNodeId = nextId || null;
    if (IS_LOCAL && !seedNodeId && extraMeta && extraMeta._aiSeed) {
      var seed = extraMeta._aiSeed.toLowerCase();
      if (seed.indexOf('mfa') !== -1 || seed.indexOf('verify') !== -1)        seedNodeId = 'mfa_start';
      else if (seed.indexOf('w3') !== -1 || seed.indexOf('contraseña') !== -1) seedNodeId = 'w3_start';
      else if (seed.indexOf('primer d') !== -1 || seed.indexOf('soy usuario nuevo') !== -1) seedNodeId = 'new_user_start';
      else if (seed.indexOf('bitlocker') !== -1 || seed.indexOf('cifrado') !== -1) seedNodeId = 'bitlocker_start';
      else if (seed.indexOf('notebook nueva') !== -1 || seed.indexOf('me dieron') !== -1) seedNodeId = 'notebook_start';
    }

    if (!userMessage && !seedNodeId) return { node: null, isNewFlow: false };

    var flow = detectFlow(userMessage || '');
    if (flow && flow !== state.currentFlow) state.currentFlow = flow;

    return {
      node:       null,
      isNewFlow:  false,
      _userLabel: input,
      _aiPromise: getAIReply(userMessage || '', seedNodeId)
    };
  }

  /* ── Utilidades ──────────────────────────────────────────── */
  function detectFlow(text) {
    var t = text.toLowerCase()
      .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i')
      .replace(/ó/g,'o').replace(/ú/g,'u').replace(/ü/g,'u');
    // BitLocker se detecta antes que 'clave' para evitar falsos positivos
    if (t.indexOf('bitlocker') !== -1 || t.indexOf('cifrado') !== -1 ||
        t.indexOf('tpm') !== -1 || t.indexOf('pantalla azul') !== -1 ||
        t.indexOf('recovery key') !== -1) return 'bitlocker';
    if (t.indexOf('mfa') !== -1 || t.indexOf('verify') !== -1 ||
        t.indexOf('codigo') !== -1 || t.indexOf('autenticacion') !== -1 ||
        t.indexOf('doble factor') !== -1) return 'mfa';
    if (t.indexOf('w3') !== -1 || t.indexOf('contrasena') !== -1 ||
        t.indexOf('password') !== -1 || t.indexOf('intranet') !== -1) return 'w3';
    if (t.indexOf('primer dia') !== -1 || t.indexOf('soy nuevo') !== -1 ||
        t.indexOf('soy nueva') !== -1 || t.indexOf('ingrese hoy') !== -1 ||
        (t.indexOf('nuevo') !== -1 && t.indexOf('acceso') !== -1)) return 'usuario-nuevo';
    if (t.indexOf('notebook') !== -1 || t.indexOf('reemplazo') !== -1 ||
        t.indexOf('me dieron') !== -1 || t.indexOf('equipo nuevo') !== -1) return 'reemplazo-notebook';
    return null;
  }

  function getCurrentNode()  { return { id: state.currentNodeId, options: [] }; }
  function reset()           { return init(); }
  function getCurrentFlow()  { return state.currentFlow; }
  function getProfile()      { return state.profile; }
  function setProfileField(k, v) { if (state.profile.hasOwnProperty(k)) state.profile[k] = v; }
  function getStepSummary() {
    var p = state.profile, lines = [];
    if (p.name)   lines.push('Usuario: ' + p.name);
    if (p.client) lines.push('Cliente: ' + p.client);
    if (p.device) lines.push('Equipo: '  + p.device);
    return lines.join('\n') || 'Sin datos de perfil.';
  }

  return {
    init, handleInput, getCurrentNode, reset,
    getStepSummary, getCurrentFlow, getProfile, setProfileField,
    localNodeReply
  };

})();
