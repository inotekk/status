import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CONFIG_PATH = new URL("../.upptimerc.yml", import.meta.url);

// Lit uniquement la liste simple `sites` dont ce test vérifie le contrat.
// Le reste du YAML demeure sous la responsabilité d'Upptime.
const lireSites = (configuration) => {
  const lignes = configuration.split(/\r?\n/u);
  const debut = lignes.findIndex((ligne) => ligne === "sites:");
  assert.notEqual(debut, -1, "la section sites doit exister");

  const sites = [];
  let site = null;
  let cleListe = null;
  for (const ligne of lignes.slice(debut + 1)) {
    if (ligne && !ligne.startsWith(" ") && !ligne.startsWith("#")) break;
    const nom = ligne.match(/^  - name: (.+)$/u);
    if (nom) {
      site = { name: nom[1] };
      sites.push(site);
      cleListe = null;
      continue;
    }
    const propriete = ligne.match(/^    ([A-Za-z]+):(?: (.*))?$/u);
    if (site && propriete) {
      const [, cle, valeur = ""] = propriete;
      if (valeur) {
        site[cle] = valeur;
        cleListe = null;
      } else {
        site[cle] = [];
        cleListe = cle;
      }
      continue;
    }
    const valeurListe = ligne.match(/^      - (.+)$/u);
    if (site && cleListe && valeurListe) site[cleListe].push(valeurListe[1]);
  }
  return sites;
};

test("la santé du provisionnement AO est une sonde Upptime explicite", async () => {
  const configuration = await readFile(CONFIG_PATH, "utf8");
  const sites = lireSites(configuration);
  const sondes = sites.filter(
    ({ slug }) => slug === "provisionnement-acces-clients",
  );

  assert.equal(sondes.length, 1, "la sonde doit être déclarée exactement une fois");
  assert.deepEqual(sondes[0], {
    name: "Provisionnement des accès clients",
    url: "https://espace.vigiao.fr/api/health/ao-provisioning",
    slug: "provisionnement-acces-clients",
    expectedStatusCodes: ["200"],
    maxResponseTime: "5000",
  });
});

test("la sonde reste agrégée et ne transmet aucune donnée client", async () => {
  const configuration = await readFile(CONFIG_PATH, "utf8");
  const [sonde] = lireSites(configuration).filter(
    ({ slug }) => slug === "provisionnement-acces-clients",
  );
  const url = new URL(sonde.url);

  assert.equal(url.search, "", "aucun identifiant ne doit passer en query string");
  assert.equal(sonde.headers, undefined, "aucun secret ou identifiant ne doit être envoyé");
  assert.equal(sonde.body, undefined, "la sonde doit rester un GET sans corps");
  assert.deepEqual(
    sonde.expectedStatusCodes,
    ["200"],
    "le 503 agrégé doit ouvrir un incident Upptime",
  );
});
