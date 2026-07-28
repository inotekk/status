// Worker de la page de statut VIGIAO (status.vigiao.fr). Deux rôles :
// 1. `scheduled` : donner un top départ régulier à la sonde Upptime
//    « Uptime CI » (repo inotekk/status) via l'API GitHub, car les crons
//    GitHub Actions dérivent fortement aux heures de charge. La mesure
//    elle-même s'exécute sur les serveurs GitHub, indépendamment de
//    l'infrastructure Inotekk : si nos services tombent, la sonde tourne.
// 2. `fetch` : recevoir du workflow « Alerte SMS incident » (même repo)
//    les ouvertures/fermetures d'incident et envoyer un SMS via Brevo.
//    La clé Brevo et le numéro destinataire restent en secrets Cloudflare :
//    le repo GitHub, public, ne détient qu'un jeton d'appel opaque.
//
// Secrets requis (wrangler secret put ...) :
// - GITHUB_TOKEN   : PAT fine-grained limité au repo inotekk/status,
//                    permission « Actions : Read and write ».
// - SMS_HOOK_TOKEN : jeton d'appel partagé avec le workflow GitHub.
// - BREVO_API_KEY  : clé API Brevo (SMS transactionnels).
// - ALERTE_SMS_TO  : numéro destinataire, format international sans « + »
//                    (ex. 33612345678).

// Compare le jeton reçu au jeton attendu en temps constant, pour ne pas
// offrir d'oracle de préfixe via le temps de réponse.
const jetonValide = (recu, attendu) => {
  const enc = new TextEncoder();
  const a = enc.encode(recu);
  const b = enc.encode(attendu);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
};

// Extrait le nom du service depuis un titre d'issue Upptime d'indisponibilité,
// que le titre soit encore en anglais (« 🛑 X is down ») ou déjà francisé
// (« 🛑 X indisponible ») — la francisation tourne en parallèle du workflow
// SMS. Renvoie null pour tout autre titre : performances dégradées (⚠️),
// maintenances planifiées, issues manuelles.
const serviceIndisponible = (titre) => {
  const m = titre.match(/^🛑 (.*?)(?: is down| indisponible)$/u);
  return m ? m[1] : null;
};

export default {
  // Handler du cron Cloudflare (toutes les 5 minutes, cf. wrangler.toml) :
  // déclenche le workflow_dispatch de uptime.yml sur la branche master.
  async scheduled(_event, env, _ctx) {
    const res = await fetch(
      "https://api.github.com/repos/inotekk/status/actions/workflows/uptime.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "vigiao-status-cron",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "master" }),
      },
    );
    // L'API répond 204 en cas de succès ; toute autre réponse doit faire
    // échouer l'invocation pour rester visible dans les métriques du Worker.
    if (!res.ok) {
      throw new Error(
        `Échec du déclenchement GitHub : ${res.status} ${await res.text()}`,
      );
    }
  },

  // Handler HTTP : reçoit {action, title, url} du workflow GitHub et envoie
  // le SMS de panne (issue ouverte) ou de rétablissement (issue fermée) via
  // Brevo. Ne journalise ni ne renvoie jamais le numéro destinataire.
  async fetch(request, env) {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const jeton = (request.headers.get("Authorization") || "").replace(
      /^Bearer /,
      "",
    );
    if (!env.SMS_HOOK_TOKEN || !jetonValide(jeton, env.SMS_HOOK_TOKEN)) {
      return new Response(null, { status: 401 });
    }

    let evenement;
    try {
      evenement = await request.json();
    } catch {
      return new Response("JSON invalide", { status: 400 });
    }
    const service = serviceIndisponible(String(evenement.title || ""));
    if (!service || !["opened", "closed"].includes(evenement.action)) {
      return Response.json({ envoye: false, motif: "hors périmètre SMS" });
    }

    // Texte sans emoji pour rester en encodage GSM-7 (160 caractères par
    // SMS) : un seul caractère hors GSM-7 basculerait tout le message en
    // UCS-2 (70 caractères). Les accents français usuels (é, è, à) passent.
    const texte =
      evenement.action === "opened"
        ? `VIGIAO : ${service} INDISPONIBLE. Détail : ${evenement.url}`
        : `VIGIAO : ${service} est de nouveau en ligne.`;

    const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: "VIGIAO",
        recipient: env.ALERTE_SMS_TO,
        content: texte,
        type: "transactional",
        tag: "status-vigiao",
      }),
    });
    if (!res.ok) {
      // Propage l'échec au workflow (qui échouera → e-mail GitHub « run
      // failed ») sans rejouer le corps de la réponse Brevo : celui-ci peut
      // contenir le numéro destinataire, et les logs Actions sont publics.
      let brevoCode = "";
      try {
        brevoCode = (await res.json()).code || "";
      } catch {
        // Corps non JSON : on ne garde que le statut HTTP.
      }
      return Response.json(
        { envoye: false, brevoStatus: res.status, brevoCode },
        { status: 502 },
      );
    }
    return Response.json({ envoye: true });
  },
};
