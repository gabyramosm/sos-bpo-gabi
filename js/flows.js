/* ============================================================
   flows.js — Definición de todos los flujos de conversación
   Cada nodo representa un turno de Gabi.

   Principios Gabi:
   - Diagnóstico antes de resolver.
   - Una pregunta por vez.
   - Confirmar cada avance.
   - No asumir conocimientos técnicos.
   - Acompañar hasta la resolución confirmada.

   Estructura de un nodo:
   {
     id:       string    — identificador único del nodo
     message:  string    — texto que Gabi dice
     options:  Array<{ label: string, nextId: string, isAction?: boolean }>
               — chips clicables que aparecen bajo el mensaje
     keywords: string[]  — palabras clave para enrutar desde texto libre (solo en nodos raíz)
     end:      'resolved' | 'escalated' | undefined
   }
   ============================================================ */

var FLOWS = (function () {

  /* ── Utilidad: nodo de escalamiento genérico ──────────────── */
  function escalateNode(id, topic) {
    return {
      id: id,
      message:
        '{{name}}, llegamos hasta donde puedo acompañarte de forma directa.\n\n' +
        'No te preocupes — esto no significa que no tenga solución. ' +
        'Solo que el paso que sigue necesita la intervención del equipo de soporte.\n\n' +
        'Para que puedan ayudarte rápido, completá el formulario. Ya tengo registrado el contexto de lo que pasó:\n\n' +
        '👉 <a href="https://forms.monday.com/forms/310b7149fb2650a990102fbd1416bebd?r=use1" target="_blank" rel="noopener">Abrir formulario de soporte</a>\n\n' +
        'Alguien del equipo te va a contactar a la brevedad.',
      options: [{ label: '🔄 Iniciar nueva consulta', nextId: 'root', isReset: true }],
      end: 'escalated',
      topic: topic
    };
  }

  /* ── Nodo de resolución exitosa genérico ─────────────────── */
  function resolvedNode(id, topic) {
    return {
      id: id,
      message:
        '¡Perfecto, {{name}}! Me alegra que hayamos podido resolverlo juntos. 🎉\n\n' +
        '¿Hay algo más en lo que pueda ayudarte?',
      options: [
        { label: '✅ Sí, tengo otra consulta', nextId: 'root', isReset: true },
        { label: '👋 No, muchas gracias',       nextId: 'goodbye' }
      ],
      end: 'resolved',
      topic: topic
    };
  }

  /* ================================================================
     NODO RAÍZ (fallback — normalmente no se llega acá tras onboarding)
     ================================================================ */
  var root = {
    id: 'root',
    message:
      '¿Con qué más te puedo ayudar, {{name}}?',
    options: [
      { label: '🔐 Problemas con MFA / IBM Verify',   nextId: 'mfa_start' },
      { label: '🔑 Password W3 / Acceso a W3',        nextId: 'w3_start' },
      { label: '🆕 Soy usuario nuevo',                nextId: 'new_user_start' },
      { label: '💻 Reemplazo de notebook',             nextId: 'notebook_start' },
      { label: '🔒 BitLocker / Cifrado de disco',      nextId: 'bitlocker_start' }
    ],
    keywords: []
  };

  /* ================================================================
     FLUJO: DESPEDIDA
     ================================================================ */
  var goodbye = {
    id: 'goodbye',
    message:
      '¡Hasta pronto, {{name}}! 👋 Cuando necesites soporte, estaré acá.\n\n' +
      '_SOS BPO · Soporte IT LATAM_',
    options: [{ label: '🔄 Iniciar nueva consulta', nextId: 'root', isReset: true }]
  };

  /* ================================================================
     FLUJO: MFA / IBM VERIFY
     ================================================================ */
  var mfa = [
    {
      id: 'mfa_start',
      message:
        'No te preocupes, {{name}}, te acompaño paso a paso. 🔐\n\n' +
        '¿Qué estaba pasando exactamente? ¿Qué aplicación o sistema intentabas usar cuando apareció el problema?',
      keywords: ['mfa', 'ibm verify', 'doble factor', 'código', 'no puedo ingresar',
                 'no puedo entrar', 'verificación', 'autenticación', 'cambié de celular',
                 'perdí el celular', 'qr no funciona'],
      options: [
        { label: '📱 Cambié o perdí el celular',        nextId: 'mfa_diag_device' },
        { label: '🔢 El código no me funciona',          nextId: 'mfa_diag_code' },
        { label: '➕ Quiero agregar más métodos',        nextId: 'mfa_diag_add' },
        { label: '🔒 No puedo ingresar a ningún lado',   nextId: 'mfa_diag_blocked' }
      ]
    },

    /* ── Diagnóstico: cambio o pérdida de celular ──────────── */
    {
      id: 'mfa_diag_device',
      message:
        'Entendido. ¿Todavía tenés el celular anterior o lo perdiste completamente?',
      options: [
        { label: '📱 Lo tengo pero es un celular nuevo',  nextId: 'mfa_lost_device' },
        { label: '❌ Lo perdí o no tengo acceso',          nextId: 'mfa_lost_device' }
      ]
    },

    /* ── Diagnóstico: código no funciona ───────────────────── */
    {
      id: 'mfa_diag_code',
      message:
        'Para entender mejor el problema, necesito hacerte una pregunta.\n\n' +
        '¿Qué método estás usando para obtener el código? ¿La app **IBM Verify**, un **SMS**, un **correo**, o algo más?',
      options: [
        { label: '📱 La app IBM Verify',       nextId: 'mfa_code_verify_app' },
        { label: '📧 Por correo electrónico',   nextId: 'mfa_check_outlook' },
        { label: '💬 Por SMS',                  nextId: 'mfa_check_outlook' },
        { label: '❓ No sé cuál uso',           nextId: 'mfa_explain_methods' }
      ]
    },

    /* ── Diagnóstico: quiere agregar métodos ───────────────── */
    {
      id: 'mfa_diag_add',
      message:
        'Perfecto, agregar métodos es muy importante — evita quedarte bloqueado en el futuro.\n\n' +
        '¿Podés acceder ahora a tu **correo corporativo Outlook**?',
      options: [
        { label: '✅ Sí, puedo abrir Outlook',   nextId: 'mfa_check_methods' },
        { label: '❌ No tengo acceso al correo',  nextId: 'mfa_no_email' }
      ]
    },

    /* ── Diagnóstico: bloqueado sin acceso a nada ──────────── */
    {
      id: 'mfa_diag_blocked',
      message:
        'Contame exactamente dónde queda trabado.\n\n' +
        '¿En qué punto falla? ¿Qué mensaje te aparece en pantalla?',
      options: [
        { label: '🔒 Me pide un código y no tengo ninguno',  nextId: 'mfa_diag_no_methods' },
        { label: '❌ Me dice contraseña incorrecta',          nextId: 'w3_pwd_forgot' },
        { label: '⏳ La pantalla carga pero no pasa nada',    nextId: 'mfa_check_outlook' },
        { label: '📵 Perdí el celular y no tengo la app',     nextId: 'mfa_lost_device' }
      ]
    },
    {
      id: 'mfa_diag_no_methods',
      message:
        'Para saber cómo ayudarte, necesito confirmar una cosa.\n\n' +
        '¿Tenés acceso a tu **correo corporativo** (Outlook) desde algún dispositivo, aunque sea desde la web?',
      options: [
        { label: '✅ Sí, puedo abrir Outlook',   nextId: 'mfa_check_methods' },
        { label: '❌ No tengo acceso al correo',  nextId: 'mfa_no_email' }
      ]
    },

    /* ── Explicar métodos a usuario confundido ─────────────── */
    {
      id: 'mfa_explain_methods',
      message:
        'No te preocupes, te explico.\n\n' +
        'Cuando iniciás sesión en IBM, el sistema te pide confirmar que sos vos con un segundo paso. ' +
        'Ese segundo paso puede ser:\n\n' +
        '· **IBM Verify** — una app en el celular que genera un código de 6 dígitos\n' +
        '· **Passkey / Biometría** — confirmación biométrica (huella, cara) o PIN en la computadora\n' +
        '· **Correo electrónico IBM** — te llega un código al mail corporativo\n' +
        '· **SMS** — te llega un código al celular\n' +
        '· **Llamada telefónica** — IBM te llama y confirmás con una tecla\n\n' +
        '¿Recordás cuál usabas antes de que dejara de funcionar?',
      options: [
        { label: '📱 Creo que era una app en el celular',   nextId: 'mfa_code_verify_app' },
        { label: '📧 Creo que era por correo o SMS',        nextId: 'mfa_check_outlook' },
        { label: '📞 Creo que era por llamada',             nextId: 'mfa_check_outlook' },
        { label: '❓ No recuerdo, nunca lo configuré',       nextId: 'mfa_check_methods' }
      ]
    },

    /* ── Código no funciona en IBM Verify ──────────────────── */
    {
      id: 'mfa_code_verify_app',
      message:
        'Cuando el código de IBM Verify no es aceptado, lo más frecuente es que ' +
        'la hora del celular no esté sincronizada con la red.\n\n' +
        'Primero probemos esto. ¿Podés revisar que en tu celular la hora sea **automática**?\n\n' +
        '· Android: _Ajustes → Sistema → Fecha y hora → Usar hora de la red_\n' +
        '· iOS: _Configuración → General → Fecha y hora → Automática_\n\n' +
        'Avisame cuando lo revisés.',
      options: [
        { label: '✅ Ya está en automático, sigo con el mismo problema', nextId: 'mfa_code_still_fails' },
        { label: '✅ Lo activé y ahora funciona',                         nextId: 'mfa_test_code' },
        { label: '❌ No puedo revisar esa configuración',                  nextId: 'mfa_escalate' }
      ]
    },
    {
      id: 'mfa_code_still_fails',
      message:
        'Entendido. Probemos otra cosa.\n\n' +
        '¿La cuenta que aparece dentro de IBM Verify es la correcta? ' +
        '¿Tiene tu dirección de correo IBM (@ibm.com)?',
      options: [
        { label: '✅ Sí, es mi cuenta IBM',             nextId: 'mfa_escalate' },
        { label: '❌ Veo una cuenta diferente o vacía',  nextId: 'mfa_enroll_guide' }
      ]
    },

    /* ── Acceso a Outlook ──────────────────────────────────── */
    {
      id: 'mfa_lost_device',
      message:
        'Entendido. Vamos a resolver esto.\n\n' +
        'Lo primero que necesito saber: ¿tenés acceso a tu **correo corporativo Outlook** ' +
        'en algún dispositivo, aunque sea desde la web?',
      options: [
        { label: '✅ Sí, puedo abrir Outlook',   nextId: 'mfa_check_methods' },
        { label: '❌ No tengo acceso al correo',  nextId: 'mfa_no_email' }
      ]
    },
    {
      id: 'mfa_check_outlook',
      message:
        'Antes de avanzar, necesito confirmar una cosa.\n\n' +
        '¿Tenés acceso a tu **correo corporativo Outlook** ahora mismo?',
      options: [
        { label: '✅ Sí, tengo acceso al correo',   nextId: 'mfa_check_methods' },
        { label: '❌ No, no tengo acceso al correo', nextId: 'mfa_no_email' }
      ]
    },

    /* ── Sin acceso a ningún método → Reset MFA ───────────── */
    {
      id: 'mfa_no_email',
      message:
        'Sin acceso al correo ni a ningún método MFA, el paso que sigue es un **Reset MFA**.\n\n' +
        '⚠️ **Importante:** Esto NO es un reset de contraseña. Son procesos distintos.\n\n' +
        'El **Reset MFA** elimina todos los métodos de autenticación registrados para que el usuario pueda configurarlos de cero.\n\n' +
        '**¿Quién lo hace?** Tu **Manager directo**, desde Slack.\n\n' +
        '**¿Cómo?** El Manager debe ingresar al canal correspondiente de Slack y ejecutar:\n\n' +
        '· <code>/reset</code>\n' +
        '· o <code>/reset correo_ibm@ibm.com</code>\n\n' +
        'IBM resetea los métodos MFA y el usuario puede volver a configurarlos.\n\n' +
        '¿Podés contactar a tu Manager para que realice el Reset MFA?',
      options: [
        { label: '✅ Sí, voy a contactarlo',           nextId: 'mfa_after_reset' },
        { label: '❓ Mi Manager no sabe cómo hacerlo',  nextId: 'mfa_reset_manager_guide' },
        { label: '❌ No tengo Manager disponible',      nextId: 'mfa_no_manager' }
      ]
    },
    {
      id: 'mfa_reset_manager_guide',
      message:
        'Indicale a tu Manager estos pasos exactos:\n\n' +
        '1. Abrir **Slack** e ingresar al canal correspondiente de soporte IT.\n\n' +
        '2. Ejecutar el comando:\n\n' +
        '   · <code>/reset</code> (si el canal ya está asociado al usuario)\n' +
        '   · o <code>/reset correo_ibm@ibm.com</code> (reemplazando con el correo real)\n\n' +
        '3. IBM confirma el reset de los métodos MFA.\n\n' +
        '4. El usuario recibe la notificación y puede configurar sus métodos desde cero.\n\n' +
        '⚠️ **Recordá:** El Reset MFA no resuelve problemas de contraseña vencida. Si la contraseña también está vencida, ese es un proceso separado (Reset Password W3).\n\n' +
        '¿El Manager pudo ejecutar el comando?',
      options: [
        { label: '✅ Sí, ejecutó el reset MFA',       nextId: 'mfa_after_reset' },
        { label: '❌ No pudo o no tiene acceso',        nextId: 'mfa_no_manager' }
      ]
    },
    {
      id: 'mfa_no_manager',
      message:
        'Si tu Manager no está disponible, el **Gerente o responsable de área** también puede ejecutar el comando en Slack:\n\n' +
        '· <code>/reset</code>\n' +
        '· o <code>/reset correo_ibm@ibm.com</code>\n\n' +
        'Cualquier responsable autorizado en el canal de Slack puede hacerlo.\n\n' +
        'Si no hay ningún responsable disponible, el equipo de soporte IBM puede asistir:\n\n' +
        '👉 <a href="https://w3.ibm.com/#/askibm/chat" target="_blank" rel="noopener">Soporte IBM — Ask IBM</a>\n\n' +
        '¿Pudiste contactar a alguien con acceso?',
      options: [
        { label: '✅ Sí, alguien va a hacer el Reset MFA', nextId: 'mfa_after_reset' },
        { label: '❌ No hay nadie con acceso disponible',   nextId: 'mfa_escalate' }
      ]
    },
    {
      id: 'mfa_after_reset',
      message:
        'Perfecto. Una vez que el Manager ejecute el comando <code>/reset</code> en Slack, IBM elimina los métodos MFA registrados.\n\n' +
        'Después del **Reset MFA** vas a tener que configurar todos los métodos de autenticación de cero — yo te guío en ese proceso.\n\n' +
        '⚠️ Si además tu contraseña W3 está vencida, eso requiere un proceso separado (Reset Password W3).\n\n' +
        '¿El Manager ya ejecutó el Reset MFA y estás listo/a para continuar?',
      options: [
        { label: '✅ Sí, ya hicieron el Reset MFA',   nextId: 'mfa_enroll_guide' },
        { label: '⏳ Todavía estoy esperando',          nextId: 'mfa_waiting' }
      ]
    },
    {
      id: 'mfa_waiting',
      message:
        'Sin problema. Cuando el Manager lo haga, volvé acá y continuamos.\n\n' +
        '¿Pudiste avanzar?',
      options: [
        { label: '✅ Ya hicieron el reset, quiero continuar', nextId: 'mfa_enroll_guide' },
        { label: '❌ Sigo esperando',                          nextId: 'mfa_escalate' }
      ]
    },

    /* ── Verificar métodos configurados ────────────────────── */
    {
      id: 'mfa_check_methods',
      message:
        'Bien. ¿Cuántos métodos de verificación tenés configurados actualmente?\n\n' +
        'Podés verlo acá:\n' +
        '👉 <a href="https://login.w3.ibm.com/usc/settings/security" target="_blank" rel="noopener">Portal de seguridad IBM</a>\n\n' +
        'Una vez adentro, buscá **"Manage your verification methods"**.',
      options: [
        { label: '0 — No tengo ninguno',           nextId: 'mfa_enroll_guide' },
        { label: '1 — Solo tengo uno',              nextId: 'mfa_one_method' },
        { label: '2 o 3 — Tengo algunos',           nextId: 'mfa_recommend_more' },
        { label: '4 o más — Tengo varios',          nextId: 'mfa_test_code' }
      ]
    },
    {
      id: 'mfa_recommend_more',
      message:
        'Bien, pero con menos de 4 métodos corrés el riesgo de quedarte bloqueado si algo falla. ⚠️\n\n' +
        'Todo usuario IBM debería tener **al menos 4 métodos** configurados. Así, si perdés el celular ' +
        'o vence la contraseña, siempre tenés otra forma de entrar.\n\n' +
        'Lo ideal es tener:\n' +
        '· **IBM Verify** (app del celular)\n' +
        '· **Passkey / Biometría** (huella, cara o PIN del equipo)\n' +
        '· **Correo electrónico IBM** (código al mail corporativo)\n' +
        '· **SMS** (código al celular) o **Llamada telefónica**\n\n' +
        '¿Querés agregar más métodos ahora o primero resolver el acceso?',
      options: [
        { label: '➕ Quiero agregar más métodos primero',    nextId: 'mfa_enroll_guide' },
        { label: '🔑 Primero necesito resolver el acceso',   nextId: 'mfa_test_code' }
      ]
    },

    /* ── Guía de enrolamiento ──────────────────────────────── */
    {
      id: 'mfa_enroll_guide',
      message:
        'Vamos a agregar métodos nuevos. Te guío paso a paso. 📱\n\n' +
        '**Paso 1:** Ingresá al portal de seguridad IBM:\n' +
        '👉 <a href="https://login.w3.ibm.com/usc/settings/security" target="_blank" rel="noopener">Portal de seguridad IBM</a>\n\n' +
        'Avisame cuando llegués a este punto.',
      options: [
        { label: '✅ Estoy dentro del portal',   nextId: 'mfa_enroll_select_method' },
        { label: '❌ No puedo acceder',           nextId: 'mfa_portal_blocked' }
      ]
    },
    {
      id: 'mfa_portal_blocked',
      message:
        'Si no podés acceder al portal, puede ser una de estas dos cosas:\n\n' +
        '· La contraseña W3 puede estar vencida\n' +
        '· No tenés ningún método MFA activo para ingresar\n\n' +
        '¿Cuál de estas situaciones se parece más a la tuya?',
      options: [
        { label: '🔑 Creo que la contraseña W3 está vencida', nextId: 'w3_pwd_forgot' },
        { label: '🚫 No tengo ningún método para ingresar',    nextId: 'mfa_no_email' }
      ]
    },
    {
      id: 'mfa_enroll_select_method',
      message:
        '**Paso 2:** Dentro del portal, buscá el botón **"Add New Method"** o **"Manage your verification methods"**.\n\n' +
        'Avisame cuando lo encuentres.',
      options: [
        { label: '✅ Veo las opciones',        nextId: 'mfa_enroll_ibm_verify' },
        { label: '❌ No encuentro esa opción',  nextId: 'mfa_escalate' }
      ]
    },
    {
      id: 'mfa_enroll_ibm_verify',
      message:
        'Primero vamos a agregar **IBM Verify**, que es la app en el celular.\n\n' +
        '· **iPhone**: App Store → buscar "IBM Verify"\n' +
        '· **Android**: Google Play → buscar "IBM Verify"\n\n' +
        '¿Ya tenés la app instalada en el celular?',
      options: [
        { label: '✅ Sí, ya la tengo instalada',  nextId: 'mfa_enroll_step3' },
        { label: '❌ No puedo instalarla ahora',   nextId: 'mfa_enroll_other_method' }
      ]
    },
    {
      id: 'mfa_enroll_other_method',
      message:
        'No hay problema. Podés agregar primero otro método disponible en el portal:\n\n' +
        '· **Passkey / Biometría** — huella, reconocimiento facial o PIN del equipo\n' +
        '· **Correo electrónico IBM** — código al mail corporativo\n' +
        '· **SMS** — código al número de celular\n' +
        '· **Llamada telefónica** — IBM te llama para confirmar\n\n' +
        'En el portal, elegí uno de esos métodos y seguí los pasos en pantalla.\n\n' +
        '¿Pudiste agregar algún método?',
      options: [
        { label: '✅ Sí, agregué un método',     nextId: 'mfa_test_code' },
        { label: '❌ No pude agregar ninguno',    nextId: 'mfa_escalate' }
      ]
    },
    {
      id: 'mfa_enroll_step3',
      message:
        'Perfecto. Ahora en el portal seleccioná **"IBM Verify"** como método nuevo. ' +
        'Vas a ver un **código QR** en pantalla.\n\n' +
        'Abrí la app IBM Verify en el celular, tocá el **+** para agregar una cuenta y escaneá ese QR.\n\n' +
        'Avisame cuando llegués a este punto.',
      options: [
        { label: '✅ Escaneé el QR correctamente',  nextId: 'mfa_verify_4_methods' },
        { label: '❌ No me aparece el QR',            nextId: 'mfa_escalate' },
        { label: '❌ No puedo escanearlo',             nextId: 'mfa_escalate' }
      ]
    },
    {
      id: 'mfa_verify_4_methods',
      message:
        'IBM Verify configurado. ✅\n\n' +
        'Ahora te recomiendo agregar **al menos 3 métodos más** para que nunca quedes bloqueado.\n\n' +
        'En el portal podés agregar:\n' +
        '· **Passkey / Biometría** — muy recomendado, usa huella o cara del equipo\n' +
        '· **Correo electrónico IBM** — te llega un código al mail corporativo\n' +
        '· **SMS** — código al celular\n' +
        '· **Llamada telefónica** — IBM te llama para confirmar\n\n' +
        '¿Cuántos métodos ves configurados ahora en total?',
      options: [
        { label: '✅ Tengo 4 o más métodos',     nextId: 'mfa_test_code' },
        { label: '⚠️ Tengo menos de 4 métodos', nextId: 'mfa_add_more_methods' }
      ]
    },
    {
      id: 'mfa_add_more_methods',
      message:
        'Volvé al portal y seleccioná **"Add New Method"** para agregar otro.\n\n' +
        '· **Passkey / Biometría** — no depende del celular, usa huella o cara\n' +
        '· **Correo electrónico IBM** — fácil de configurar\n' +
        '· **SMS** — código al celular\n' +
        '· **Llamada telefónica** — IBM te llama para confirmar\n\n' +
        'Avisame cuando tengas al menos 4 métodos en total.',
      options: [
        { label: '✅ Ya tengo 4 o más métodos',  nextId: 'mfa_test_code' },
        { label: '❌ No puedo agregar más',       nextId: 'mfa_test_code' }
      ]
    },

    /* ── Un solo método ────────────────────────────────────── */
    {
      id: 'mfa_one_method',
      message:
        'Con un solo método, si algo falla no vas a poder entrar. Es importante agregar más, pero primero ' +
        'confirmemos que el que tenés funcione.\n\n' +
        '¿Cuál es ese método? ¿La app **IBM Verify** en el celular?',
      options: [
        { label: '✅ Sí, IBM Verify en el celular',  nextId: 'mfa_test_code' },
        { label: '❌ No, es otro método',              nextId: 'mfa_check_outlook' }
      ]
    },

    /* ── Probar acceso ─────────────────────────────────────── */
    {
      id: 'mfa_test_code',
      message:
        'Probemos que todo funciona.\n\n' +
        'Intentá ingresar al sistema y cuando te pida verificación, usá el método que tenés configurado.\n\n' +
        '¿Qué resultado te mostró?',
      options: [
        { label: '✅ Ingresé correctamente',       nextId: 'mfa_resolved' },
        { label: '❌ El código no es aceptado',     nextId: 'mfa_code_verify_app' },
        { label: '❌ Sigue sin dejarme entrar',     nextId: 'mfa_escalate' }
      ]
    },

    resolvedNode('mfa_resolved', 'mfa'),
    escalateNode('mfa_escalate', 'mfa')
  ];

  /* ================================================================
     FLUJO: USUARIO NUEVO
     ================================================================ */
  var newUser = [
    {
      id: 'new_user_start',
      message:
        '¡Bienvenido/a, {{name}}! Empezar en IBM puede ser un poco abrumador al principio, pero estoy acá para acompañarte. 🎉\n\n' +
        'Vamos a ir paso a paso. El orden correcto es:\n\n' +
        '1️⃣ Password W3\n' +
        '2️⃣ MFA (métodos de verificación)\n' +
        '3️⃣ Outlook (correo)\n' +
        '4️⃣ Slack\n' +
        '5️⃣ VPN\n' +
        '6️⃣ Aplicaciones IBM\n' +
        '7️⃣ Aplicaciones de {{client}}\n\n' +
        'Primero: ¿ya descargaste las aplicaciones IBM desde el portal de configuración?',
      keywords: ['ingresé hoy', 'soy nuevo', 'nueva', 'no tengo accesos', 'recibí una notebook',
                 'notebook nueva', 'me cambiaron', 'primer día', 'recién ingresé'],
      options: [
        { label: '✅ Sí, ya descargué las apps',  nextId: 'new_user_w3_password' },
        { label: '❌ No sé qué descargar',          nextId: 'new_user_download_apps' }
      ]
    },
    {
      id: 'new_user_download_apps',
      message:
        'Las apps IBM están en una carpeta compartida de OneDrive. Entrá directamente desde acá:\n\n' +
        '👉 **Carrefour:** <a href="https://ibm-my.sharepoint.com/:f:/p/gaby_r/IgDgBJabRd_nSYUau5bsdbdQAY8aU2UkgVmZ2R51dDShe2Y?e=sh4Yc2" target="_blank" rel="noopener">Abrir carpeta de instaladores</a>\n\n' +
        '⚠️ **Si el link da error "Something went wrong"** es porque todavía no iniciaste sesión IBM. En ese caso:\n\n' +
        '1. Abrí <a href="https://outlook.office.com" target="_blank" rel="noopener">outlook.office.com</a> con tu correo IBM\n' +
        '2. Buscá en tu bandeja un correo de **gaby.r@ibm.com** con el asunto **"IBM - Configuración Inicial Notebook"** — ese correo lo recibe todo usuario nuevo al ingresar a IBM\n' +
        '3. El correo tiene el link directo a la carpeta\n\n' +
        'Las apps esenciales a instalar son: **Box, OneDrive, Chrome, FortiClient VPN, Office, Slack** y el soporte del equipo (**Lenovo Vantage** o **Dell Support**).\n\n' +
        '¿Pudiste acceder a la carpeta o encontrar el correo?',
      options: [
        { label: '✅ Sí, encontré los instaladores',       nextId: 'new_user_w3_password' },
        { label: '❌ No encuentro el correo ni la carpeta', nextId: 'new_user_escalate' }
      ]
    },
    {
      id: 'new_user_w3_password',
      message:
        'Empecemos por lo más importante: la **contraseña W3**.\n\n' +
        '¿Recibiste tus credenciales IBM? (usuario y contraseña temporal)',
      options: [
        { label: '✅ Sí, tengo mis credenciales',   nextId: 'new_user_w3_access' },
        { label: '❌ No recibí ningún correo',       nextId: 'w3_pwd_manager_process' }
      ]
    },
    {
      id: 'new_user_w3_access',
      message:
        '¿Pudiste ingresar a **w3.ibm.com** con tus credenciales?\n\n' +
        'Si te pide cambiar la contraseña, hacelo ahora. Elegí una que sea fácil de recordar ' +
        'pero que cumpla los requisitos de seguridad.',
      options: [
        { label: '✅ Sí, accedí a W3',        nextId: 'new_user_mfa_setup' },
        { label: '❌ No puedo ingresar a W3',  nextId: 'w3_start' }
      ]
    },
    {
      id: 'new_user_mfa_setup',
      message:
        'W3 ✅\n\n' +
        'Ahora configuremos los **métodos de verificación** (MFA).\n\n' +
        'Esto es muy importante — si no configurás al menos 4 métodos y en el futuro ' +
        'perdés el celular o se te vence la contraseña, vas a necesitar que tu Manager te resetee el acceso.\n\n' +
        '¿Ya tenés métodos de verificación configurados?',
      options: [
        { label: '✅ Sí, ya los configuré',          nextId: 'new_user_outlook_check' },
        { label: '❌ No, necesito configurarlos',     nextId: 'mfa_enroll_guide' }
      ]
    },
    {
      id: 'new_user_outlook_check',
      message:
        'MFA ✅\n\n' +
        'Ahora verificamos **Outlook** (el correo corporativo).\n\n' +
        '¿Podés abrir Outlook y ver tus correos?',
      options: [
        { label: '✅ Sí, Outlook funciona',      nextId: 'new_user_slack' },
        { label: '❌ No puedo entrar a Outlook',  nextId: 'new_user_outlook_issue' }
      ]
    },
    {
      id: 'new_user_outlook_issue',
      message:
        'No te preocupes. En usuarios nuevos, a veces las credenciales tardan unos minutos en activarse.\n\n' +
        'Una cosa importante: **Outlook no necesita VPN** para funcionar — podés usarlo desde cualquier red.\n\n' +
        'Probá ingresar a **outlook.office.com** con tu usuario IBM desde el navegador. ¿Pudiste entrar?',
      options: [
        { label: '✅ Sí, ingresé correctamente',   nextId: 'new_user_slack' },
        { label: '❌ Sigue sin funcionar',           nextId: 'new_user_escalate' }
      ]
    },
    {
      id: 'new_user_slack',
      message:
        'Outlook ✅\n\n' +
        '¿Podés abrir **Slack** e ingresar con tu cuenta corporativa?\n\n' +
        'Al igual que Outlook, **Slack no necesita VPN** para funcionar.',
      options: [
        { label: '✅ Sí, Slack funciona',       nextId: 'new_user_vpn' },
        { label: '❌ No tengo acceso a Slack',   nextId: 'new_user_slack_issue' }
      ]
    },
    {
      id: 'new_user_slack_issue',
      message:
        'Para activar Slack deberías haber recibido un correo de invitación.\n\n' +
        '¿Podés buscar en Outlook un correo de **slack.com** con el asunto "You have been invited"?',
      options: [
        { label: '✅ Encontré el correo, lo voy a usar',       nextId: 'new_user_vpn' },
        { label: '❌ No encuentro ningún correo de Slack',     nextId: 'new_user_escalate' }
      ]
    },
    {
      id: 'new_user_vpn',
      message:
        'Slack ✅\n\n' +
        'Ahora la **VPN**. ¿Tenés el cliente de VPN instalado?\n\n' +
        'La VPN de IBM se usa solo para webs internas como **BluePages, MySA, Travel Expenses, W3, App Store IBM**, entre otras. No es necesaria para las aplicaciones del cliente.',
      options: [
        { label: '✅ Sí, tengo el cliente instalado',    nextId: 'new_user_vpn_connect' },
        { label: '❌ No tengo ningún cliente de VPN',    nextId: 'new_user_vpn_install' }
      ]
    },
    {
      id: 'new_user_vpn_install',
      message:
        'El instalador de VPN está en el mismo portal de configuración inicial:\n\n' +
        '👉 <a href="https://ibm-my.sharepoint.com/:f:/r/personal/gaby_r_ibm_com/Documents/Carrefour%20Instructivos/IBM%20-%20Configuracion%20Inicial%20Notebook?csf=1&web=1&e=BRXRw4" target="_blank" rel="noopener">Portal de Configuración Inicial IBM</a>\n\n' +
        '¿Pudiste encontrar el instalador de VPN?',
      options: [
        { label: '✅ Sí, lo encontré',           nextId: 'new_user_vpn_connect' },
        { label: '❌ No encuentro nada de VPN',   nextId: 'new_user_escalate' }
      ]
    },
    {
      id: 'new_user_vpn_connect',
      message:
        'Probá conectarte a la VPN con tus credenciales corporativas.\n\n' +
        '¿Pudiste conectarte?',
      options: [
        { label: '✅ Sí, VPN conectada',            nextId: 'new_user_compliance' },
        { label: '❌ No puedo conectarme a la VPN',  nextId: 'new_user_escalate' }
      ]
    },
    {
      id: 'new_user_compliance',
      message:
        'VPN ✅ Ya estamos cerca.\n\n' +
        '⚠️ **Paso obligatorio: actualizar Windows**\n\n' +
        'Antes de terminar, el equipo necesita estar actualizado para quedar en cumplimiento corporativo. ' +
        'Si no lo hacés, puede fallar la VPN, BitLocker o algunas aplicaciones.\n\n' +
        '1. Hacé clic en el botón **Inicio de Windows** (el ícono con cuatro cuadrados, abajo a la izquierda)\n' +
        '2. Escribí:\n\n' +
        '   **Windows Update**\n\n' +
        '3. Hacé clic en la opción que aparece\n' +
        '4. Hacé clic en **"Buscar actualizaciones"**\n' +
        '5. Instalá **todo** lo que aparezca\n' +
        '6. Reiniciá el equipo cuando te lo pida\n' +
        '7. Repetí hasta que no queden pendientes\n\n' +
        'Esto puede requerir varios reinicios. Avisame cuando lo completes.',
      options: [
        { label: '✅ Sí, Windows está actualizado',  nextId: 'new_user_resolved' },
        { label: '⏳ Lo estoy haciendo ahora',        nextId: 'new_user_resolved' },
        { label: '❌ No puedo actualizar Windows',    nextId: 'new_user_escalate' }
      ]
    },
    resolvedNode('new_user_resolved', 'usuario-nuevo'),
    escalateNode('new_user_escalate', 'usuario-nuevo')
  ];

  /* ================================================================
     FLUJO: REEMPLAZO DE NOTEBOOK
     ================================================================ */
  var notebook = [
    {
      id: 'notebook_start',
      message:
        'Entendido, {{name}}. Cuando recibís un equipo IBM nuevo hay un orden que seguir para que todo quede bien configurado desde el primer momento.\n\n' +
        'Te acompaño en cada paso. Primero: ¿ya descargaste las aplicaciones IBM desde el portal de configuración?',
      keywords: ['reemplazo', 'notebook nueva', 'me dieron una notebook', 'nueva computadora',
                 'nueva pc', 'cambio de notebook', 'cambié de notebook'],
      options: [
        { label: '✅ Sí, ya descargué las apps',  nextId: 'notebook_windows_update' },
        { label: '❌ No sé qué descargar',          nextId: 'notebook_download_apps' }
      ]
    },
    {
      id: 'notebook_download_apps',
      message:
        'Las apps IBM están en una carpeta compartida de OneDrive. Entrá directamente desde acá:\n\n' +
        '👉 **Carrefour:** <a href="https://ibm-my.sharepoint.com/:f:/p/gaby_r/IgDgBJabRd_nSYUau5bsdbdQAY8aU2UkgVmZ2R51dDShe2Y?e=sh4Yc2" target="_blank" rel="noopener">Abrir carpeta de instaladores</a>\n\n' +
        '⚠️ **Si el link da error "Something went wrong"** es porque todavía no iniciaste sesión IBM. En ese caso:\n\n' +
        '1. Abrí <a href="https://outlook.office.com" target="_blank" rel="noopener">outlook.office.com</a> con tu correo IBM\n' +
        '2. Buscá en tu bandeja un correo de **gaby.r@ibm.com** con el asunto **"IBM - Configuración Inicial Notebook"** — ese correo lo recibe todo usuario nuevo al ingresar a IBM\n' +
        '3. El correo tiene el link directo a la carpeta\n\n' +
        'Las apps esenciales: **Box, OneDrive, Chrome, FortiClient VPN, Office, Slack** y el soporte del equipo (**Lenovo Vantage** o **Dell Support**).\n\n' +
        '¿Pudiste acceder a la carpeta o encontrar el correo?',
      options: [
        { label: '✅ Sí, encontré los instaladores',       nextId: 'notebook_windows_update' },
        { label: '❌ No encuentro el correo ni la carpeta', nextId: 'notebook_escalate' }
      ]
    },
    {
      id: 'notebook_windows_update',
      message:
        '⚠️ **Paso obligatorio antes de continuar: actualizar Windows**\n\n' +
        'Si no hacés esto, la VPN y otras funciones pueden no funcionar correctamente.\n\n' +
        '1. Hacé clic en el botón **Inicio de Windows** (el ícono con cuatro cuadrados, abajo a la izquierda)\n' +
        '2. Escribí:\n\n' +
        '   **Windows Update**\n\n' +
        '3. Hacé clic en la opción que aparece\n' +
        '4. Hacé clic en **"Buscar actualizaciones"**\n' +
        '5. Instalá **todo** lo que aparezca\n' +
        '6. Reiniciá el equipo cuando te lo pida\n' +
        '7. Repetí hasta que no queden pendientes\n\n' +
        'Esto puede llevar varios reinicios. Avisame cuando lo completes.',
      options: [
        { label: '✅ Sí, Windows está actualizado',   nextId: 'notebook_mfa_check' },
        { label: '⏳ Estoy actualizando ahora',        nextId: 'notebook_mfa_check' },
        { label: '❌ No puedo actualizar',             nextId: 'notebook_escalate' }
      ]
    },
    {
      id: 'notebook_mfa_check',
      message:
        'Windows Update ✅\n\n' +
        'Una cosa importante: en una notebook nueva, hay que verificar que los **métodos de verificación (MFA)** ' +
        'sigan funcionando correctamente.\n\n' +
        '¿Podés abrir la app **IBM Verify** en el celular y ver que la cuenta IBM esté activa?',
      options: [
        { label: '✅ Sí, IBM Verify funciona',               nextId: 'notebook_outlook' },
        { label: '❌ IBM Verify no funciona o no tengo app',  nextId: 'mfa_start' }
      ]
    },
    {
      id: 'notebook_outlook',
      message:
        'MFA ✅\n\n' +
        '¿Podés abrir **Outlook** en la notebook nueva y ver tus correos?\n\n' +
        'Recordá que Outlook no necesita VPN para funcionar.',
      options: [
        { label: '✅ Sí, Outlook funciona',   nextId: 'notebook_vpn' },
        { label: '❌ Outlook no funciona',    nextId: 'notebook_outlook_issue' }
      ]
    },
    {
      id: 'notebook_outlook_issue',
      message:
        'En una notebook nueva, Outlook a veces necesita que vuelvas a configurar la cuenta.\n\n' +
        'Abrí Outlook, ingresá tu email corporativo y Windows debería detectarlo automáticamente.\n\n' +
        '¿Qué resultado te mostró?',
      options: [
        { label: '✅ Sí, ya funciona',        nextId: 'notebook_vpn' },
        { label: '❌ Sigue sin funcionar',    nextId: 'notebook_escalate' }
      ]
    },
    {
      id: 'notebook_vpn',
      message:
        'Outlook ✅\n\n' +
        '¿El cliente de **VPN** está instalado en la notebook nueva?\n\n' +
        'La VPN de IBM se usa solo para webs internas como **BluePages, MySA, Travel Expenses, W3, App Store IBM**, entre otras. No es necesaria para las aplicaciones del cliente.',
      options: [
        { label: '✅ Sí, VPN instalada y conectada',   nextId: 'notebook_bitlocker' },
        { label: '❌ No está instalada',                 nextId: 'new_user_vpn_install' }
      ]
    },
    {
      id: 'notebook_bitlocker',
      message:
        'VPN ✅\n\n' +
        'Por último, vamos a verificar el **cifrado de disco** (BitLocker). Es un requisito de seguridad corporativa.\n\n' +
        '¿Ves algún aviso o mensaje sobre cifrado en la pantalla ahora mismo?',
      options: [
        { label: '✅ Sí, me apareció un aviso sobre cifrado',  nextId: 'bitlocker_start' },
        { label: '❌ No veo ningún aviso',                      nextId: 'notebook_bitlocker_check' },
        { label: '❓ No sé cómo verificarlo',                   nextId: 'notebook_bitlocker_check' }
      ]
    },
    {
      id: 'notebook_bitlocker_check',
      message:
        'Perfecto. Vamos a verificarlo juntos para asegurarnos de que todo está en orden.\n\n' +
        '1. Hacé clic en el botón **Inicio de Windows** (el ícono con cuatro cuadrados, abajo a la izquierda)\n' +
        '2. Escribí:\n\n' +
        '   **Administrar BitLocker**\n\n' +
        '3. Hacé clic en la opción que aparece\n\n' +
        '¿Qué dice junto a la unidad **C:**?',
      options: [
        { label: '🔒 Dice que está activado',        nextId: 'notebook_resolved' },
        { label: '🔓 Dice que está desactivado',     nextId: 'bitlocker_brand' },
        { label: '❓ No encuentro esa opción',        nextId: 'bitlocker_escalate' }
      ]
    },
    resolvedNode('notebook_resolved', 'reemplazo-notebook'),
    escalateNode('notebook_escalate', 'reemplazo-notebook')
  ];

  /* ================================================================
     FLUJO: BITLOCKER
     ================================================================ */
  var bitlocker = [
    {
      id: 'bitlocker_start',
      message:
        'No te preocupes, {{name}}, lo resolvemos juntos.\n\n' +
        '¿Qué estaba pasando cuando apareció el problema con el cifrado?\n\n' +
        '¿Eso ocurrió al arrancar {{device}}, o mientras ya estabas trabajando?',
      keywords: ['bitlocker', 'cifrado', 'tpm', 'compliance', 'clave numérica',
                 'clave de recuperación', 'me pide una clave', 'recovery key'],
      options: [
        { label: '🔵 La notebook arranca con una pantalla azul que pide una clave', nextId: 'bitlocker_recovery_key' },
        { label: '⚠️ Me dice que el cifrado no está activo o falla',                nextId: 'bitlocker_brand' },
        { label: '🔒 Necesito activar el cifrado de disco',                          nextId: 'bitlocker_brand' }
      ]
    },

    /* ── Rama Recovery Key ────────────────────────────────────── */
    {
      id: 'bitlocker_recovery_key',
      message:
        'Entendido. La notebook te está pidiendo una **clave de recuperación** — son 48 números.\n\n' +
        'La buena noticia es que esa clave está guardada en tu cuenta Microsoft. ' +
        'Solo necesito que tengas acceso a otro dispositivo con internet.\n\n' +
        '¿Tenés acceso a otro dispositivo (celular, tablet u otra computadora) con internet?',
      options: [
        { label: '✅ Sí, tengo otro dispositivo',   nextId: 'bitlocker_recovery_portal' },
        { label: '❌ No tengo ningún otro dispositivo', nextId: 'bitlocker_escalate' }
      ]
    },
    {
      id: 'bitlocker_recovery_portal',
      message:
        'Perfecto. Desde ese otro dispositivo, ingresá a:\n\n' +
        '👉 <a href="https://myaccount.microsoft.com/device-list" target="_blank" rel="noopener">myaccount.microsoft.com/device-list</a>\n\n' +
        'Iniciá sesión con tu cuenta **IBM** (usuario@ibm.com).\n\n' +
        'Una vez adentro vas a ver tus dispositivos. Buscá el nombre de tu notebook y hacé clic en **"View BitLocker Keys"** — tal como muestra esta imagen:\n\n' +
        '<img src="assets/bitlocker-device-list.svg" alt="Pantalla Device List Microsoft con botón View BitLocker Keys" style="max-width:100%;border-radius:8px;margin:8px 0">\n\n' +
        'Avisame cuando llegués a ese punto.',
      options: [
        { label: '✅ Veo la Recovery Key',          nextId: 'bitlocker_recovery_enter' },
        { label: '❌ No aparece ninguna clave',      nextId: 'bitlocker_recovery_nomatch' },
        { label: '❌ No puedo acceder al portal',   nextId: 'bitlocker_escalate' }
      ]
    },
    {
      id: 'bitlocker_recovery_enter',
      message:
        'Muy bien. Antes de ingresarla, verificá que el **ID de la clave** que muestra el portal ' +
        'coincida con el ID que aparece en la pantalla azul de la notebook.\n\n' +
        '¿Coinciden los IDs?',
      options: [
        { label: '✅ Sí, coinciden — ingresé la clave',  nextId: 'bitlocker_resolved' },
        { label: '❌ No coinciden',                       nextId: 'bitlocker_recovery_nomatch' }
      ]
    },
    {
      id: 'bitlocker_recovery_nomatch',
      message:
        'Cuando el ID no coincide, puede ser que la clave esté guardada en una cuenta diferente, ' +
        'o que haya un cambio de hardware.\n\n' +
        '¿Tenés otra cuenta Microsoft además de la IBM con la que podrías intentar?',
      options: [
        { label: '✅ Sí, voy a intentar con otra cuenta',  nextId: 'bitlocker_recovery_portal' },
        { label: '❌ No, no tengo otra cuenta',              nextId: 'bitlocker_escalate' }
      ]
    },

    /* ── Diagnóstico marca ───────────────────────────────────── */
    {
      id: 'bitlocker_brand',
      message:
        'Para guiarte bien, necesito saber la marca de {{device}}.\n\n' +
        '¿Es **Lenovo** o **Dell**?\n\n' +
        'Podés verlo en la etiqueta en la parte de abajo.',
      options: [
        { label: '💻 Lenovo', nextId: 'bitlocker_lenovo_tpm' },
        { label: '💻 Dell',   nextId: 'bitlocker_dell_tpm' },
        { label: '❓ No sé',  nextId: 'bitlocker_check_model' }
      ]
    },
    {
      id: 'bitlocker_check_model',
      message:
        'Podés verlo de dos formas:\n\n' +
        '· En la **etiqueta de la parte inferior** de la notebook\n' +
        '· O desde Windows: hacé clic en el botón **Inicio de Windows**, escribí **"Este equipo"**, hacé clic derecho sobre el resultado y elegí **"Propiedades"**\n\n' +
        '¿Pudiste identificarlo?',
      options: [
        { label: '💻 Es Lenovo',       nextId: 'bitlocker_lenovo_tpm' },
        { label: '💻 Es Dell',         nextId: 'bitlocker_dell_tpm' },
        { label: '❓ Otro fabricante', nextId: 'bitlocker_escalate' }
      ]
    },

    /* ── Rama Lenovo ─────────────────────────────────────────── */
    {
      id: 'bitlocker_lenovo_tpm',
      message:
        'Ok, **Lenovo**. Vamos a revisar si la notebook tiene activado el chip de seguridad que necesita BitLocker.\n\n' +
        'Seguí estos pasos:\n\n' +
        '1. Hacé clic en el botón **Inicio de Windows** (el ícono con cuatro cuadrados, abajo a la izquierda)\n' +
        '2. Escribí:\n\n' +
        '   **TPM**\n\n' +
        '3. Hacé clic en la opción que te aparezca (algo como _"Administrar el Módulo de plataforma segura"_)\n\n' +
        '¿Qué dice la pantalla que se abre?',
      options: [
        { label: '✅ Dice que está listo para usarse',           nextId: 'bitlocker_lenovo_check_status' },
        { label: '⚠️ Dice que no puede encontrar esa función',   nextId: 'bitlocker_lenovo_bios' },
        { label: '❓ Aparece algo diferente o da error',          nextId: 'bitlocker_escalate' }
      ]
    },
    {
      id: 'bitlocker_lenovo_bios',
      message:
        'Esa configuración de seguridad puede estar desactivada. Hay que activarla desde la configuración inicial de la notebook (BIOS).\n\n' +
        'Vamos paso a paso:\n\n' +
        '1. Apagá la notebook completamente\n' +
        '2. Quitá cualquier USB conectado\n' +
        '3. Encendela\n' +
        '4. Cuando aparezca el logo de Lenovo, presioná **F2** varias veces seguidas\n\n' +
        '¿Pudiste entrar a la pantalla de configuración?',
      options: [
        { label: '✅ Sí, entré a la configuración',             nextId: 'bitlocker_lenovo_bios_tpm' },
        { label: '❌ No me abre ninguna pantalla de opciones',  nextId: 'bitlocker_lenovo_bios_retry' }
      ]
    },
    {
      id: 'bitlocker_lenovo_bios_retry',
      message:
        'Probemos de nuevo. A veces hay que ser más rápido con la tecla.\n\n' +
        '1. Apagá completamente la notebook\n' +
        '2. Encendela\n' +
        '3. Esta vez probá con la tecla **F1** (algunos modelos Lenovo usan F1 en lugar de F2)\n\n' +
        '¿Qué resultado te mostró?',
      options: [
        { label: '✅ Entré con F1',                      nextId: 'bitlocker_lenovo_bios_tpm' },
        { label: '❌ Tampoco funciona con ninguna tecla', nextId: 'bitlocker_escalate' }
      ]
    },
    {
      id: 'bitlocker_lenovo_bios_tpm',
      message:
        'Perfecto. Dentro de la configuración, buscá la sección **Security**.\n\n' +
        'Ahí deberías ver una opción llamada **Security Chip** o **TPM 2.0 Security**. ' +
        'Asegurate de que el toggle esté en **ON** o **Active/Enabled**.\n\n' +
        'Guardá los cambios con **F10** y reiniciá la notebook.\n\n' +
        '¿Pudiste activarlo?',
      options: [
        { label: '✅ Sí, lo activé y reinicié',       nextId: 'bitlocker_lenovo_check_status' },
        { label: '❌ No encuentro esa sección',         nextId: 'bitlocker_escalate' }
      ]
    },
    {
      id: 'bitlocker_lenovo_check_status',
      message:
        'Configuración de seguridad ✅\n\n' +
        'Ahora vamos a comprobar si el cifrado de disco quedó activado.\n\n' +
        '1. Hacé clic en el botón **Inicio de Windows** (el ícono con cuatro cuadrados, abajo a la izquierda)\n' +
        '2. Escribí:\n\n' +
        '   **Administrar BitLocker**\n\n' +
        '3. Hacé clic en la opción que aparece\n\n' +
        '¿Qué dice junto a la unidad **C:**?',
      options: [
        { label: '🔒 Dice que está activado',        nextId: 'bitlocker_already_active' },
        { label: '🔓 Dice que está desactivado',     nextId: 'bitlocker_lenovo_activate' },
        { label: '❓ No encuentro esa opción',        nextId: 'bitlocker_escalate' }
      ]
    },
    {
      id: 'bitlocker_lenovo_activate',
      message:
        'Vamos a activarlo:\n\n' +
        '1. **Inicio de Windows** → escribí **Administrar BitLocker** → abrilo\n' +
        '2. Hacé clic en **"Activar BitLocker"** junto a la unidad **C:**\n' +
        '3. Seguí el asistente hasta la pantalla de guardar la clave\n' +
        '4. Elegí **"Hacer una copia de seguridad de la clave"** → **"Imprimir la clave de recuperación"** o **"Guardar en cuenta Microsoft"**\n\n' +
        '<img src="assets/bitlocker-backup-key.svg" alt="Pantalla BitLocker backup recovery key con opciones de guardado" style="max-width:100%;border-radius:8px;margin:8px 0">\n\n' +
        '¿Pudiste activarlo y guardar la clave?',
      options: [
        { label: '✅ Sí, quedó activado y guardé la clave', nextId: 'bitlocker_resolved' },
        { label: '✅ Activé pero no pude guardar la clave',  nextId: 'bitlocker_save_key' },
        { label: '❌ No me deja activarlo',                  nextId: 'bitlocker_escalate' }
      ]
    },

    /* ── Rama Dell ───────────────────────────────────────────── */
    {
      id: 'bitlocker_dell_tpm',
      message:
        'Ok, **Dell**. Vamos a revisar si la notebook tiene activado el chip de seguridad que necesita BitLocker.\n\n' +
        'Seguí estos pasos:\n\n' +
        '1. Hacé clic en el botón **Inicio de Windows** (el ícono con cuatro cuadrados, abajo a la izquierda)\n' +
        '2. Escribí:\n\n' +
        '   **TPM**\n\n' +
        '3. Hacé clic en la opción que te aparezca (algo como _"Administrar el Módulo de plataforma segura"_)\n\n' +
        '¿Qué dice la pantalla que se abre?',
      options: [
        { label: '✅ Dice que está listo para usarse',           nextId: 'bitlocker_dell_check_status' },
        { label: '⚠️ Dice que no puede encontrar esa función',   nextId: 'bitlocker_dell_bios' },
        { label: '❓ Aparece algo diferente o da error',          nextId: 'bitlocker_escalate' }
      ]
    },
    {
      id: 'bitlocker_dell_bios',
      message:
        'Esa configuración de seguridad puede estar desactivada. Vamos a activarla.\n\n' +
        '1. Apagá la notebook completamente\n' +
        '2. Quitá cualquier USB conectado\n' +
        '3. Encendela\n' +
        '4. Cuando aparezca el logo de Dell, presioná **F2** varias veces seguidas\n\n' +
        '¿Pudiste entrar a la pantalla de configuración?',
      options: [
        { label: '✅ Sí, entré a la configuración',            nextId: 'bitlocker_dell_bios_tpm' },
        { label: '❌ No me abre ninguna pantalla de opciones', nextId: 'bitlocker_dell_bios_retry' }
      ]
    },
    {
      id: 'bitlocker_dell_bios_retry',
      message:
        'Probemos de nuevo. En algunos modelos Dell también funciona **F8**.\n\n' +
        '1. Apagá completamente la notebook\n' +
        '2. Encendela\n' +
        '3. Esta vez probá con **F8** en cuanto aparezca el logo\n\n' +
        '¿Qué resultado te mostró?',
      options: [
        { label: '✅ Entré con F8',                      nextId: 'bitlocker_dell_bios_tpm' },
        { label: '❌ Tampoco funciona con ninguna tecla', nextId: 'bitlocker_escalate' }
      ]
    },
    {
      id: 'bitlocker_dell_bios_tpm',
      message:
        'Perfecto. Dentro del BIOS, buscá en el menú izquierdo la sección **Security**.\n\n' +
        'Ahí vas a ver **"TPM 2.0 Security"** con un toggle. Activá el toggle a **ON**.\n\n' +
        '<img src="assets/bitlocker-dell-tpm-bios.svg" alt="BIOS Dell con TPM 2.0 Security OFF — hay que activarlo a ON" style="max-width:100%;border-radius:8px;margin:8px 0">\n\n' +
        'Hacé clic en **"Apply Changes"** y reiniciá la notebook.\n\n' +
        '¿Pudiste activarlo?',
      options: [
        { label: '✅ Sí, lo activé y reinicié',     nextId: 'bitlocker_dell_check_status' },
        { label: '❌ No encuentro esa sección',       nextId: 'bitlocker_escalate' }
      ]
    },
    {
      id: 'bitlocker_dell_check_status',
      message:
        'Configuración de seguridad ✅\n\n' +
        'Ahora vamos a comprobar si el cifrado de disco quedó activado.\n\n' +
        '1. Hacé clic en el botón **Inicio de Windows** (el ícono con cuatro cuadrados, abajo a la izquierda)\n' +
        '2. Escribí:\n\n' +
        '   **Administrar BitLocker**\n\n' +
        '3. Hacé clic en la opción que aparece\n\n' +
        '¿Qué dice junto a la unidad **C:**?',
      options: [
        { label: '🔒 Dice que está activado',    nextId: 'bitlocker_already_active' },
        { label: '🔓 Dice que está desactivado', nextId: 'bitlocker_dell_activate' },
        { label: '❓ No encuentro esa opción',    nextId: 'bitlocker_escalate' }
      ]
    },
    {
      id: 'bitlocker_dell_activate',
      message:
        'Vamos a activarlo:\n\n' +
        '1. **Inicio de Windows** → escribí **Administrar BitLocker** → abrilo\n' +
        '2. Hacé clic en **"Activar BitLocker"** junto a la unidad **C:**\n' +
        '3. Seguí el asistente hasta la pantalla de guardar la clave\n' +
        '4. Elegí **"Hacer una copia de seguridad de la clave"** → **"Imprimir la clave de recuperación"** o **"Guardar en cuenta Microsoft"**\n\n' +
        '<img src="assets/bitlocker-backup-key.svg" alt="Pantalla BitLocker backup recovery key" style="max-width:100%;border-radius:8px;margin:8px 0">\n\n' +
        '¿Pudiste activarlo y guardar la clave?',
      options: [
        { label: '✅ Sí, quedó activado y guardé la clave', nextId: 'bitlocker_resolved' },
        { label: '✅ Activé pero no pude guardar la clave',  nextId: 'bitlocker_save_key' },
        { label: '❌ No me deja activarlo',                  nextId: 'bitlocker_escalate' }
      ]
    },

    /* ── Nodos comunes post-activación ───────────────────────── */
    {
      id: 'bitlocker_already_active',
      message:
        'El cifrado de disco **ya está activo** en tu equipo. ✅ No necesitás hacer nada más.\n\n' +
        '¿Querés verificar que tenés la clave de recuperación guardada, por las dudas?',
      options: [
        { label: '✅ Sí, quiero verificarla',          nextId: 'bitlocker_save_key' },
        { label: '👍 No, ya la tengo guardada',        nextId: 'bitlocker_resolved' }
      ]
    },
    {
      id: 'bitlocker_save_key',
      message:
        'La **clave de recuperación** son 48 números — la necesitás si el equipo queda bloqueado.\n\n' +
        'Hay dos formas de guardarla. Opción A — desde Windows:\n\n' +
        '**Inicio → Administrar BitLocker → "Hacer una copia de seguridad de la clave de recuperación"**\n\n' +
        '<img src="assets/bitlocker-backup-key.svg" alt="BitLocker Drive Encryption — opciones para hacer backup de la recovery key" style="max-width:100%;border-radius:8px;margin:8px 0">\n\n' +
        'Opción B — desde otro dispositivo:\n' +
        '👉 <a href="https://myaccount.microsoft.com/device-list" target="_blank" rel="noopener">myaccount.microsoft.com/device-list</a> → tu notebook → **"View BitLocker Keys"**\n\n' +
        '¿Pudiste guardar o ver la clave?',
      options: [
        { label: '✅ Sí, la guardé',                      nextId: 'bitlocker_resolved' },
        { label: '❌ No puedo acceder a ninguna opción',   nextId: 'bitlocker_escalate' }
      ]
    },
    resolvedNode('bitlocker_resolved', 'bitlocker'),
    escalateNode('bitlocker_escalate', 'bitlocker')
  ];

  /* ================================================================
     FLUJO: ACCESO A W3 / PASSWORD W3
     ================================================================ */
  var w3 = [
    {
      id: 'w3_start',
      message:
        'Entendido, {{name}}. 🔑 Vamos a resolverlo.\n\n' +
        '¿Qué estaba intentando hacer cuando apareció el problema? ¿Entrabas a W3 para acceder a una herramienta de IBM o del cliente {{client}}?',
      keywords: ['w3', 'intranet', 'w3.ibm.com', 'no puedo entrar a w3',
                 'sitio interno', 'password w3', 'contraseña w3', 'cambiar contraseña'],
      options: [
        { label: '🔑 Necesito cambiar la contraseña W3',   nextId: 'w3_pwd_change' },
        { label: '🔒 Olvidé la contraseña W3',              nextId: 'w3_pwd_forgot' },
        { label: '🌐 No puedo acceder al portal W3',        nextId: 'w3_access_check' },
        { label: '⏰ Mi contraseña W3 está vencida',         nextId: 'w3_pwd_forgot' }
      ]
    },

    /* ── Cambio de contraseña ──────────────────────────────── */
    {
      id: 'w3_pwd_change',
      message:
        'Para cambiar la contraseña W3, primero necesito verificar que podés confirmar tu identidad.\n\n' +
        '¿Tenés acceso a algún método de verificación? (la app IBM Verify, correo, o algún otro)',
      options: [
        { label: '✅ Sí, tengo acceso a un método',  nextId: 'w3_pwd_do_change' },
        { label: '❌ No tengo acceso a ninguno',     nextId: 'w3_pwd_no_mfa' }
      ]
    },
    {
      id: 'w3_pwd_do_change',
      message:
        'Perfecto. Ingresá a este enlace para cambiar la contraseña:\n\n' +
        '👉 <a href="https://w3idprofile.sso.ibm.com/password/changepwd.wss" target="_blank" rel="noopener">Cambiar contraseña W3</a>\n\n' +
        'Seguí los pasos y verificá con tu método.\n\n' +
        '¿Pudiste cambiarla?',
      options: [
        { label: '✅ Sí, cambié la contraseña',   nextId: 'w3_try_access' },
        { label: '❌ No me deja cambiarla',         nextId: 'w3_escalate' }
      ]
    },

    /* ── Olvidó / Vencida ──────────────────────────────────── */
    {
      id: 'w3_pwd_forgot',
      message:
        'Vamos a recuperarla. Intentá con la opción de recuperación de contraseña:\n\n' +
        '👉 <a href="https://w3idprofile.sso.ibm.com/password/changepwd.wss" target="_blank" rel="noopener">Recuperar contraseña W3</a>\n\n' +
        '¿Pudiste recuperarla?',
      options: [
        { label: '✅ Sí, ya recuperé el acceso',      nextId: 'w3_try_access' },
        { label: '❌ No funciona (no tengo MFA válido)', nextId: 'w3_pwd_manager_process' }
      ]
    },
    {
      id: 'w3_pwd_no_mfa',
      message:
        'Sin acceso a ningún método de verificación, el cambio de contraseña no se puede hacer por tu cuenta.\n\n' +
        'Seguí el proceso IBM estándar con tu Manager. ↓',
      options: [
        { label: '📋 Ver proceso con el Manager',  nextId: 'w3_pwd_manager_process' }
      ]
    },
    {
      id: 'w3_pwd_manager_process',
      message:
        'Este caso corresponde al **Reset Password W3** — proceso IBM estándar para contraseñas vencidas, olvidadas o inexistentes. ✅\n\n' +
        '⚠️ **Importante:** Este proceso resuelve problemas de contraseña, NO de MFA. Si el problema es que no tenés métodos MFA, el proceso es diferente (Reset MFA vía Slack).\n\n' +
        '**¿Qué hace el Manager o Gerente directo?**\n\n' +
        '1. El Manager ingresa a:\n' +
        '   👉 <a href="https://w3.ibm.com/#/w3-it-support" target="_blank" rel="noopener">w3.ibm.com/#/w3-it-support</a>\n\n' +
        '2. Solicita una **contraseña temporal** para el usuario.\n\n' +
        '3. IBM genera automáticamente la contraseña.\n\n' +
        '4. La contraseña llega **únicamente al Manager o Gerente autorizado**.\n\n' +
        '5. El Manager le entrega la contraseña al usuario.\n\n' +
        '**¿Qué hace el usuario cuando la recibe?**\n\n' +
        '1. Ingresa con la contraseña temporal.\n' +
        '2. Cambia la contraseña inmediatamente.\n' +
        '3. Configura los métodos de MFA.\n\n' +
        '¿Tu Manager ya realizó la solicitud?',
      options: [
        { label: '✅ Sí, el Manager la pidió — esperando contraseña', nextId: 'w3_pwd_manager_waiting' },
        { label: '✅ Ya recibí la contraseña temporal',               nextId: 'w3_pwd_manager_received' },
        { label: '❓ Mi Manager no sabe cómo hacerlo',                nextId: 'w3_pwd_manager_guide' }
      ]
    },
    {
      id: 'w3_pwd_manager_guide',
      message:
        'Indicale a tu Manager estos pasos exactos:\n\n' +
        '1. Abrir el navegador e ingresar a:\n' +
        '   👉 <a href="https://w3.ibm.com/#/w3-it-support" target="_blank" rel="noopener">w3.ibm.com/#/w3-it-support</a>\n\n' +
        '2. Iniciar sesión con sus propias credenciales IBM.\n\n' +
        '3. Buscar la opción **"Password reset"** o **"Temporary password"** para un colaborador.\n\n' +
        '4. Ingresar el correo corporativo IBM del usuario.\n\n' +
        '5. Confirmar la solicitud.\n\n' +
        'IBM enviará la contraseña temporal directamente al Manager.\n\n' +
        '¿El Manager pudo ingresar al portal?',
      options: [
        { label: '✅ Sí, entró y solicitó la contraseña', nextId: 'w3_pwd_manager_waiting' },
        { label: '❌ El Manager tampoco puede acceder',    nextId: 'w3_escalate' }
      ]
    },
    {
      id: 'w3_pwd_manager_waiting',
      message:
        'Perfecto. IBM genera la contraseña en minutos y la envía al Manager.\n\n' +
        'Cuando el Manager te la entregue, volvé acá y continuamos con el cambio de contraseña y la configuración de MFA.\n\n' +
        '¿Ya recibiste la contraseña temporal de tu Manager?',
      options: [
        { label: '✅ Sí, ya la tengo',      nextId: 'w3_pwd_manager_received' },
        { label: '⏳ Todavía estoy esperando', nextId: 'w3_pwd_manager_waiting_more' }
      ]
    },
    {
      id: 'w3_pwd_manager_waiting_more',
      message:
        'Sin problema. Cuando la recibas, volvé acá para continuar.\n\n' +
        'Recordá que la contraseña temporal tiene vigencia limitada — una vez que la tengas, usala lo antes posible.\n\n' +
        '¿Pudiste avanzar?',
      options: [
        { label: '✅ Ya recibí la contraseña, quiero continuar', nextId: 'w3_pwd_manager_received' },
        { label: '❌ Sigo esperando — necesito más ayuda',        nextId: 'w3_escalate' }
      ]
    },
    {
      id: 'w3_pwd_manager_received',
      message:
        'Perfecto. Ahora seguí estos pasos:\n\n' +
        '1️⃣ **Ingresá** a <a href="https://w3.ibm.com" target="_blank" rel="noopener">w3.ibm.com</a> con la contraseña temporal.\n\n' +
        '2️⃣ El sistema te va a pedir que **cambies la contraseña** — hacelo inmediatamente.\n\n' +
        '3️⃣ Una vez dentro, ingresá al portal de seguridad para **configurar o recuperar el MFA**:\n' +
        '   👉 <a href="https://login.w3.ibm.com/usc/settings/security" target="_blank" rel="noopener">Portal de seguridad IBM</a>\n\n' +
        '4️⃣ Configurá al menos 4 métodos de verificación.\n\n' +
        '¿Pudiste ingresar y cambiar la contraseña?',
      options: [
        { label: '✅ Sí, ingresé y cambié la contraseña',    nextId: 'mfa_enroll_guide' },
        { label: '❌ La contraseña temporal no funciona',     nextId: 'w3_escalate' }
      ]
    },
    /* ── Acceso al portal ──────────────────────────────────── */
    {
      id: 'w3_access_check',
      message:
        'Para poder acceder a W3, generalmente se necesita tener la **VPN de IBM conectada**.\n\n' +
        '¿Tenés la VPN activa en este momento?',
      options: [
        { label: '✅ Sí, VPN conectada',       nextId: 'w3_try_access' },
        { label: '❌ No tengo VPN conectada',   nextId: 'w3_vpn_needed' }
      ]
    },
    {
      id: 'w3_vpn_needed',
      message:
        'Sin VPN no es posible acceder a W3. Primero conectate a la VPN corporativa.\n\n' +
        '¿Tenés el cliente de VPN instalado?',
      options: [
        { label: '✅ Sí, voy a conectarme',      nextId: 'w3_try_access' },
        { label: '❌ No tengo VPN instalada',    nextId: 'new_user_vpn_install' }
      ]
    },
    {
      id: 'w3_try_access',
      message:
        'Con la VPN activa, intentá acceder a **w3.ibm.com** desde el navegador.\n\n' +
        '¿Qué resultado te mostró?',
      options: [
        { label: '✅ Entré correctamente',             nextId: 'w3_resolved' },
        { label: '❌ Me pide un código de verificación', nextId: 'mfa_start' },
        { label: '❌ Me pide la contraseña W3',         nextId: 'w3_pwd_forgot' },
        { label: '❌ La página no carga o da error',    nextId: 'w3_error' }
      ]
    },
    {
      id: 'w3_error',
      message:
        'Ese tipo de error puede tener varias causas. Necesito preguntarte algo.\n\n' +
        '¿Hace cuánto tiempo tenés la cuenta IBM?',
      options: [
        { label: '📅 Menos de 48 horas (soy nuevo/a)',  nextId: 'w3_new_user_delay' },
        { label: '📅 Más de 48 horas',                   nextId: 'w3_escalate' }
      ]
    },
    {
      id: 'w3_new_user_delay',
      message:
        'Para usuarios nuevos, el acceso a W3 puede tardar hasta **48 horas hábiles** en activarse automáticamente. ' +
        'Es algo que pasa siempre al inicio.\n\n' +
        '¿Necesitás acceso urgente o podés esperar?',
      options: [
        { label: '⏳ Puedo esperar 48 horas',            nextId: 'w3_resolved' },
        { label: '🚨 Necesito acceso urgente',            nextId: 'w3_escalate' }
      ]
    },
    resolvedNode('w3_resolved', 'w3'),
    escalateNode('w3_escalate', 'w3')
  ];

  /* ================================================================
     EXPORTAR: mapa de todos los nodos indexados por ID
     ================================================================ */
  var allNodes = [root, goodbye]
    .concat(mfa)
    .concat(newUser)
    .concat(notebook)
    .concat(bitlocker)
    .concat(w3);

  var nodeMap = {};
  allNodes.forEach(function (node) {
    nodeMap[node.id] = node;
  });

  return {
    nodeMap: nodeMap,
    rootId: 'root'
  };

})();
