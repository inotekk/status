// Worker planificateur de la page de statut VIGIAO (status.vigiao.fr).
// Rôle : donner un top départ régulier à la sonde Upptime « Uptime CI »
// (repo inotekk/status) via l'API GitHub, car les crons GitHub Actions
// dérivent fortement aux heures de charge. La mesure elle-même continue
// de s'exécuter sur les serveurs GitHub, indépendamment de l'infrastructure
// Inotekk : si nos services tombent, la sonde tourne toujours.
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
};
