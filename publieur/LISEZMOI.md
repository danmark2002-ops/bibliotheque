# Publieur

Application Android qui publie une application sur Google Play presque toute seule : on touche « Publier » à côté d'un .aab
trouvé sur GitHub, le Publieur télécharge, vérifie, prépare la fiche et envoie à Google par l'API Android Publisher.

- Version actuelle : voir `app/build.gradle` (`versionName`). **Toujours annoncer le numéro de version en livrant une APK.**
- Interface : `android/app/src/main/assets/` (`app.js`, `aab.js`, `app.css`). Pont natif : `MainActivity.java` (+ `Secret.java`, le coffre).
- Un seul code : on modifie les fichiers d'origine, pas de rustines ni de couches ajoutées par-dessus.
- Compilation : GitHub Actions (`.github/workflows/publieur.yml`) → « Releases » (`publieur-N`). La clé de signature vit dans le cache privé des Actions.

## Ce que fait le Publieur tout seul

1. Cherche les `.aab` dans les dépôts GitHub suivis (par défaut `danmark2002-ops/bibliotheque`) ; un toucher télécharge le dernier.
2. Analyse le fichier (format, signature, empreinte de la clé, version, SDK visé, permissions à risque) et explique chaque problème.
3. Retrouve dans le dépôt la **fiche**, la **politique de confidentialité** et les **captures** de l'application (voir ci-dessous).
4. Génère la fiche Google Play, l'icône 512, la bannière 1024×500 ; remet les captures au bon format.
5. Envoie tout à Google (fichier, fiche, images, version), valide l'envoi **avant** de le confirmer, traduit les refus en français.
6. Crée et active le produit Premium (achat unique) avec le prix converti pour chaque pays.
7. Donne chaque réponse que Google réserve à la Play Console, prête à copier, avec le chemin exact.

## Ce que Google ne permet pas d'automatiser (vérifié)

- Créer l'application dans la Play Console (aucune méthode dans l'API) : une minute, une seule fois par application.
- Les formulaires « Contenu de l'app » : classification, public cible, annonces, accès… L'API n'a que `applications.dataSafety` (sécurité des données),
  et elle exige le gabarit CSV complet de la Play Console (782 lignes) : non reproduit tant qu'on n'a pas ce gabarit.
- Le profil de paiement (identité, banque) et le test fermé de 12 testeurs pendant 14 jours pour les comptes récents.

## Convention pour chaque application du dépôt (à créer en même temps que l'application)

Pour l'application `ca.exemple.app` :

```
docs/play/ca.exemple.app/fiche.json         réponses de la fiche
docs/play/ca.exemple.app/captures/01.png    2 à 8 captures d'écran réelles (téléphone, pas plus de 2:1)
docs/confidentialite/ca.exemple.app.md      politique de confidentialité (exacte : tout ce que l'app envoie en ligne y figure)
```

`fiche.json` (tous les champs sont facultatifs) :

```json
{
  "category": "Livres et références",
  "purpose": "Une phrase : à quoi sert l'app",
  "features": ["Ce que l'on peut faire", "…"],
  "ads": false, "account": false, "sends": true,
  "model": "free | premium", "price": "4.99",
  "premium": { "title": "Nom affiché à l'achat", "description": "Ce que Premium débloque. Paiement unique." },
  "todo": { "safety": [["Question de la Play Console", "Réponse exacte pour cette app"]] }
}
```

`todo` remplace les réponses suggérées pour un écran de la liste « Dans la Play Console » (`store`, `policy`, `access`, `ads`, `rating`,
`payments`, `licence`, `audience`, `safety`, `gov`, `fgs`, `testers`, `review`). Les mêmes dossiers servent de source unique : rien n'est codé en dur dans le Publieur.

## Essais

```
NODE_PATH=/opt/npm-tools/node_modules node publieur/tests/essai.cjs [filtre]
```

Charge l'interface réelle dans Chromium avec un faux pont Android, un faux Google Play (tous les appels de l'API, y compris les refus) et un faux GitHub.
Vérifie aussi que chaque appel JavaScript existe dans `MainActivity.java`. Le fichier `tests/fixture-bibliotheque.json.gz` est un vrai .aab de Bibliothèque
réduit à son manifeste et à ses ressources. **Ne jamais annoncer une correction sans avoir relancé les essais.** Le code Java, lui, n'est vérifié que par la compilation.
