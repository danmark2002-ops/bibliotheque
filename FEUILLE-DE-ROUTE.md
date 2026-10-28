# Feuille de route — Bibliothèque

Mise à jour : 2026-10-28 (v10.1). À lire au début de chaque conversation.

## Fait (récent)
- v9.1 envoi chiffré de livres · v9.2–9.8 télé (télécommande, loupe, icônes sous les livres) · v10.0 Gemini Pro : raison du refus lue, attente ≤ 15 s · v10.1 clés chiffrées (Keystore), couvertures protégées.
- targetSdk 36, retour prédictif et plein écran déjà en place (vérifié dans le code).

## Audit du 2026-10-28 — 10 améliorations proposées (en attente de choix)
1. Signets + recherche dans le livre (puis surlignage / notes) — absents (0 occurrence).
2. Étagère virtualisée : 300 livres = 13 600 nœuds DOM, 33 images/s, pire image 200 ms (CPU ×4). Attention : la navigation télécommande dépend des éléments présents dans le DOM.
3. Zones tactiles et contrastes : petites icônes 15×20 px (1 500 pour 300 livres), contraste ≈ 2,2:1 ; boutons à 40 px (cible 48 dp).
4. Polices embarquées : l'APK charge Google Fonts en ligne (0 @font-face) → hors ligne la mise en page change, et chaque lancement contacte Google.
5. Réglages de lecture : seulement 3 fonds + taille. Ajouter interligne, marges, police (dont dyslexie), justification.
6. Sauvegarde / restauration de la bibliothèque (positions, signets, réglages) vers un dossier choisi ; réutiliser le format d'envoi chiffré.
7. Statistiques de lecture (temps, jours d'affilée, temps restant).
8. Filet de sécurité : tests Playwright hors dépôt (/tmp, perdus à la fin de la session) ; 0 test dans le dépôt ; 62 `catch {}` vides ; app.js = 4 415 lignes, 31 objets globaux ; JS non minifié (349 Ko) ; .git = 78 Mo (pages générées de 3 Mo versionnées).
9. Démarrage : 1,07 s à vide, 1,57 s avec 300 livres (CPU ×4) ; page de 2,9 Mo (moteur PDF encodé dedans) → fichiers séparés, minification.
10. Petites corrections : trafic non chiffré autorisé partout (réseau local seulement nécessaire) ; sauvegarde Android probablement incomplète (limite ≈ 25 Mo, à vérifier).

## Idées audacieuses
- « Où j'en étais » : rappel de 3 phrases par Gemini à la réouverture d'un livre.
- « Constellation des idées » : carte des thèmes reliant les livres de la bibliothèque.
- Cartes-citations : un passage en belle image partageable.

## Choisi / en cours
(rien pour l'instant)

## Idées rejetées
(rien pour l'instant)

## Décisions de design
- Un seul code cohérent, pas de rustines. Rien de payant ni relié au propriétaire. Clés chiffrées.
