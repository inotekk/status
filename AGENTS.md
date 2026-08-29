# Consignes du dépôt de statut

## Communication publique

- La page et les tickets de statut s'adressent aux utilisateurs finaux. Écrire en français simple, en une à trois phrases courtes, centrées sur l'impact, l'état actuel et, si elle est connue, l'heure de rétablissement.
- Ne jamais publier de détail d'exploitation : URL technique, code HTTP, temps de réponse brut, commit, dépôt, hôte, conteneur, commande, fournisseur, bucket, configuration ou trace interne.
- Les modèles automatiques d'incident et de résolution doivent respecter le même niveau de langage non technique.
- Écrire les corps de tickets et commentaires depuis un fichier avec de vrais retours à la ligne. Ne jamais publier les séquences littérales `\\n`.

## Maintenances et disponibilité

- Placer les métadonnées Upptime de maintenance uniquement dans le commentaire HTML, avec de vrais retours à la ligne et les slugs exacts des services concernés.
- Vérifier avant publication que la date de début précède la date de fin et que la fenêtre couvre uniquement l'intervention annoncée.
- Une indisponibilité comprise dans une fenêtre de maintenance annoncée ne doit pas réduire le SLA public. Conserver l'événement dans l'historique pour la traçabilité, mais exclure exactement son chevauchement avec la maintenance du calcul de disponibilité.
