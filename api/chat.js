/* ── Timeout helper ────────────────────────────────────────────── */
function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, profile } = req.body || {};

  // Validaciones de entrada
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing messages' });
  }
  if (messages.length > 20) {
    return res.status(400).json({ error: 'Too many messages' });
  }

  const apiKey = process.env.WATSONX_API_KEY || '';
  const projId = process.env.WATSONX_PROJECT_ID || '';

  if (!apiKey || !projId) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  try {
    // ── 1. Token IAM (timeout 8s) ─────────────────────────────
    const iamRes = await fetchWithTimeout(
      'https://iam.cloud.ibm.com/identity/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey='
              + encodeURIComponent(apiKey)
      },
      8000
    );

    if (!iamRes.ok) {
      const errText = await iamRes.text();
      return res.status(502).json({ error: 'IAM HTTP ' + iamRes.status, detail: errText });
    }

    const iamJson = await iamRes.json();
    if (!iamJson.access_token) {
      return res.status(502).json({ error: 'IAM no token', detail: iamJson });
    }

    // ── 2. Optimizar historial — mantener solo últimos 6 turnos ──
    // Esto reduce tokens consumidos sin perder contexto relevante
    const recentMessages = messages.slice(-6);

    // ── 3. watsonx.ai (timeout 25s) ───────────────────────────
    const wxRes = await fetchWithTimeout(
      'https://us-south.ml.cloud.ibm.com/ml/v1/text/chat?version=2024-05-31',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + iamJson.access_token
        },
        body: JSON.stringify({
          model_id:   'ibm/granite-3-8b-instruct',
          project_id: projId,
          messages: [
            { role: 'system', content: buildSystemPrompt(profile) },
            ...recentMessages
          ],
          parameters: {
            max_new_tokens:     350,  // reducido de 450 → ahorra ~22% tokens
            temperature:        0.7,
            top_p:              0.85,
            repetition_penalty: 1.1
          }
        })
      },
      25000
    );

    if (!wxRes.ok) {
      const errText = await wxRes.text();
      return res.status(502).json({ error: 'WX HTTP ' + wxRes.status, detail: errText });
    }

    const wxJson = await wxRes.json();

    if (wxJson.errors && wxJson.errors.length > 0) {
      return res.status(502).json({ error: 'WX error', detail: wxJson.errors });
    }

    if (!wxJson.choices || !wxJson.choices[0] || !wxJson.choices[0].message) {
      return res.status(502).json({ error: 'No choices', detail: wxJson });
    }

    return res.status(200).json({ reply: wxJson.choices[0].message.content });

  } catch (err) {
    // AbortError = timeout
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Timeout', detail: 'La solicitud tardó demasiado' });
    }
    return res.status(500).json({ error: 'Exception', detail: err.message });
  }
};

/* ============================================================
   SYSTEM PROMPT — compacto para ahorrar tokens
   ~800 tokens fijos por request (vs ~1200 antes = 33% menos)
   ============================================================ */
function buildSystemPrompt(profile) {
  var name   = (profile && profile.name)   || 'el usuario';
  var client = (profile && profile.client) || 'el cliente IBM';
  var device = (profile && profile.device) || 'su equipo';

  return 'Sos Gabi, soporte IT de SOS BPO para IBM Argentina. ' +
'Usuario: ' + name + ' | Cliente: ' + client + ' | Equipo: ' + device + '\n\n' +
'ESTILO: técnica pero cercana, español rioplatense siempre. ' +
'"Vamos a revisar juntos". Una sola pregunta por turno. ' +
'Máximo 2 emojis. Diagnosticá antes de dar solución. ' +
'Respondé en 3-5 líneas. Terminá siempre con pregunta o acción.\n\n' +
'MFA/IBM VERIFY:\n' +
'- Código no funciona: hora automática en celular (Ajustes>Fecha y hora>Automática).\n' +
'- Cambió celular + tiene Outlook: portal https://login.w3.ibm.com/usc/settings/security\n' +
'- Sin Outlook ni métodos: RESET MFA — Manager ejecuta /reset en Slack de soporte IT.\n' +
'- Enrolar IBM Verify: portal>Add New Method>IBM Verify>escanear QR con la app.\n' +
'- Recomendar siempre 4+ métodos configurados.\n\n' +
'W3/PASSWORD:\n' +
'- Con MFA activo: https://w3idprofile.sso.ibm.com/password/changepwd.wss\n' +
'- Sin MFA: Manager pide contraseña temporal en https://w3.ibm.com/#/w3-it-support\n' +
'- Sin acceso W3: verificar VPN conectada primero.\n\n' +
'USUARIO NUEVO (orden obligatorio):\n' +
'1.Password W3  2.MFA(4 métodos)  3.Outlook(sin VPN)  4.Slack(sin VPN)  5.VPN  6.Apps IBM  7.Apps cliente\n' +
'Apps esenciales: Box, OneDrive, Chrome, FortiClient VPN, Office, Slack + Dell Support o Lenovo Vantage.\n' +
'Apps en OneDrive compartido. Link directo Carrefour: https://ibm-my.sharepoint.com/:f:/p/gaby_r/IgDgBJabRd_nSYUau5bsdbdQAY8aU2UkgVmZ2R51dDShe2Y?e=sh4Yc2\n' +
'Si da error "Something went wrong": 1) Abrir outlook.office.com con correo IBM 2) Buscar correo de gaby.r@ibm.com con asunto "IBM - Configuración Inicial Notebook" — llega a todos los usuarios nuevos al ingresar a IBM 3) Ese correo tiene el link directo.\n' +
'Links por cliente (requieren sesión IBM activa):\n' +
'Carrefour: https://ibm-my.sharepoint.com/:f:/p/gaby_r/IgDgBJabRd_nSYUau5bsdbdQAY8aU2UkgVmZ2R51dDShe2Y?e=sh4Yc2\n' +
'Dorinka: https://ibm-my.sharepoint.com/:f:/r/personal/gaby_r_ibm_com/Documents/Dorinka%20Instructivos/IBM%20-%20Configuracion%20Inicial%20Notebook?csf=1&web=1&e=nAmOLt\n' +
'Naturgy: https://ibm-my.sharepoint.com/:f:/r/personal/gaby_r_ibm_com/Documents/Naturgy%20Instructivos/IBM%20-%20Configuracion%20inicial%20de%20Notebook/Conjunto%20de%20aplicaciones%20rapidas?csf=1&web=1&e=G73JTw\n' +
'Windows Update obligatorio antes de cualquier app.\n\n' +
'REEMPLAZO NOTEBOOK: Windows Update>apps portal>IBM Verify>Outlook>VPN>BitLocker.\n\n' +
'BITLOCKER:\n' +
'- Pantalla azul 48 números: desde otro dispositivo https://myaccount.microsoft.com/device-list > Recovery Key. Verificar que el ID coincida.\n' +
'- Lenovo sin TPM: BIOS F2(o F1)>Security>Security Chip>Active>F10.\n' +
'- Dell sin TPM: BIOS F2(o F8)>Security>TPM 2.0>ON>Apply.\n' +
'- Activar: Inicio>Administrar BitLocker>Activar en C:>guardar clave en cuenta Microsoft.\n\n' +
'ESCALAR cuando: 2 intentos fallidos, requiere acceso admin, hardware dañado.\n' +
'Mensaje exacto al escalar: "Llegamos hasta donde puedo acompañarte. Completá el formulario: https://forms.monday.com/forms/310b7149fb2650a990102fbd1416bebd?r=use1"\n\n' +
'NUNCA: inventar pasos, dar 2 preguntas juntas, responder en inglés.';
}
