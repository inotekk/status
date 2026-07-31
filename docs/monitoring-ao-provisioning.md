# Surveillance du provisionnement des accès AO

## Objectif

La sonde `Provisionnement des accès clients` complète la disponibilité HTTP de
l'Espace client. Elle détecte le cas où l'interface reste accessible alors
qu'une synchronisation de droits Veille/Réponse ne peut plus aboutir.

Upptime interroge toutes les cinq minutes :

`GET https://espace.vigiao.fr/api/health/ao-provisioning`

Le endpoint Scribe expose uniquement un état et des compteurs agrégés :

- `200` avec `status: "ok"` lorsque aucune révision n'est bloquée ;
- `503` avec `status: "degraded"` lorsqu'au moins une révision est bloquée ;
- `pending` et `blocked` sont des nombres globaux, sans société, utilisateur,
  adresse e-mail, plan ou message d'erreur.

La sonde n'envoie ni secret, ni paramètre, ni corps de requête. Upptime conserve
le code HTTP et le temps de réponse, pas le corps JSON. Une réponse `503` ouvre
donc un incident propre au service `Provisionnement des accès clients`. Elle ne
fait pas passer artificiellement l'ensemble de l'Espace client pour
indisponible, tout en rendant l'anomalie visible sur `status.vigiao.fr` et dans
les notifications GitHub.

Les simples révisions `pending` ne dégradent pas la sonde : elles font partie du
fonctionnement normal de la file durable. Seul l'état terminal `blocked`, après
épuisement des reprises prévues par Scribe, provoque le `503`.

## Ordre de mise en service

Le endpoint n'existe qu'avec la version Scribe qui introduit la file bornée et
sa route de santé. Pour éviter un faux incident `404`, respecter cet ordre :

1. déployer Scribe en production et vérifier que le endpoint répond `200` ;
2. publier ensuite la configuration de ce dépôt sur `master` ;
3. déclencher `Uptime CI` et vérifier l'apparition de la nouvelle ligne sur la
   page de statut ;
4. vérifier que l'issue et la ligne d'historique sont créées sous le slug
   `provisionnement-acces-clients`.

Au 1er août 2026, avant la promotion du lot Scribe concerné, l'URL de production
répond encore `404`. La configuration peut être préparée et testée, mais ne doit
pas être publiée avant l'étape 1.

## Validation locale

```sh
npm test
```

Le test garantit l'URL, le slug, le seul code sain (`200`), l'absence de
paramètres/identifiants et le seuil de réponse dégradée. Le contrat HTTP détaillé
est couvert dans `ao-intel-scribe/backend/tests/test_health_ao_provisioning.py`.
