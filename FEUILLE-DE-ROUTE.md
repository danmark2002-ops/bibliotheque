# Feuille de route — Bibliothèque

Mise à jour : 2026-10-28 (v10.1). À lire au début de chaque conversation.

## Fait (récent)
- v10.2 (2026-10-28) : page 2,9 → 0,5 Mo (moteur PDF à part), polices intégrées (plus d'appel à Google), étagère ~18 éléments/livre au lieu de 44, rayons visibles garnis d'abord ; mesuré (300 livres, CPU ×4) étagère ~0,6 s au lieu de ~2,2 s, défilement 45 au lieu de 32 images/s ; cibles tactiles 44 px, petites icônes 22×40 et contraste ≥ 3:1.
- v10.3 (2026-10-28) : balado à deux voix (Camille et Alex) — plan puis segments écrits par Gemini, deux voix différentes, lecteur natif (écran éteint, Android Auto), 5/15/30 min. À valider par le propriétaire avant la suite.
- v10.4 (2026-10-28) : le propriétaire a trouvé les deux voix du balado identiques et monotones → voix de studio Gemini (femme Sulafat, homme Puck ; clé gratuite de la personne) en scènes de ~80 s fabriquées d'avance, gardées sur le téléphone, jouées d'un trait ; Gemini écrit aussi le ton de chaque réplique et des balises <laugh> <sigh> <short pause>. Repli : voix du téléphone avec écart de hauteur net. Essais sur ordinateur : android/test-studio (sh run.sh). Non vérifié sur téléphone : la qualité réelle des voix, le nom exact du modèle TTS accepté par la clé.
- v10.5 (2026-10-28) : Gemini Pro refusé en boucle → les modèles Pro sont maintenant essayés un par un (un Pro payant qui répond « quota 0 » n'empêche plus gemini-2.5-pro), la vraie raison de Google est gardée et affichée sous le résumé ; essais : android/test-studio/IaTest.java. Balado : barre d'avancement (texte écrit + voix fabriquées) dans l'écran du balado.
- v10.6 (2026-10-28) : voix du balado encore « presque identiques » (vidéo du propriétaire : les deux animateurs à ~195 Hz, voix du téléphone) → repli renforcé : on MESURE la hauteur de chaque voix française installée (Studio.pitch, testé) et Camille prend la plus aiguë, Alex la plus grave ; l'écran dit quelle voix joue (« Voix de studio Gemini ✓ » ou la raison du repli).
- v10.7 (2026-10-28) : suivi du balado cohérent — pastille de progression visible partout (écriture puis voix, en %), qui ramène à l'écran du balado ; relancer ne recommence jamais (reprise si interrompu) ; onglets Livres · Balados · Résumés · Vidéos (option B choisie par le propriétaire).
- v10.8 (2026-10-28) : capture du propriétaire = voix du téléphone (« voix de studio pas disponible ») → la réponse exacte de Google est gardée pour chaque essai et affichée ; bouton « Tester la voix de studio » ; plus jamais de voix robotiques sans le choix de la personne (pause + Réessayer / Voix du téléphone) ; scènes longues (1re ~1 100 lettres, puis ~4 500 : 3-4 demandes pour 15 min, réduites toutes seules si Gemini coupe le son) ; réponse lue en octets (19 Mo en 0,1 s) ; lecture en continu (AudioTrack STREAM) ; modèles 3.8 / 3.8-lite / 3.1 (palier gratuit) ; texte plus parlé (répliques courtes, relances, <breath>) ; supprimer balado, résumé, vidéo depuis les onglets.
- v10.9 (2026-10-28) : « Unable to resolve host » (capture du propriétaire : le texte du balado échoue alors que le test de voix passe) → une coupure de réseau n'est plus un échec : l'app attend jusqu'à 15 min le retour de la connexion et continue toute seule (message clair à l'écran) ; un refus de Gemini n'est plus confondu avec une panne de réseau (testé).
- Idée à débattre (propriétaire, 2026-10-28) : étagères séparées pour balados / résumés / vidéos faits à partir des livres.
- Leçon : le masque CSS sur 1 500 icônes ralentissait le défilement (mesuré) → images déjà colorées ; content-visibility reste exclu (sautait sur Android, v6.8).
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

## Choisi (2026-10-28) / en cours
PRIORITÉ N° 1 : **balado à deux voix** (deux animateurs discutent du livre ; téléphone, auto, télé) — y mettre le plus d'efforts.
Fondations : étagère qui ne dessine que le visible · boutons plus faciles à toucher et lisibles · polices intégrées · sauvegarde / restauration de la bibliothèque · démarrage plus court · corrections de sécurité.
Beauté : belles couvertures pour les PDF sans couverture · option ambiance par livre · ouverture de livre animée · thème clair papier crème · page de lecture soignée · premier lancement qui émerveille · plaisir de finir un livre.
Atouts IA : Professeur réglable (enfant de 10 ans / étudiant / expert) · résumé en 3 longueurs · résumé à écouter en 5 min · vidéos en épisodes de 3 min · bande-annonce verticale de 30 s · lire un livre anglais en français.
Maquettes vues le 2026-10-28 : le propriétaire préfère garder le design actuel. Règle : interface épurée, intuitive, jamais intimidante (pas d'avalanche de boutons).
Note : les petites icônes sous les livres sont voulues (préférence du propriétaire) ; on les rend plus faciles à toucher plutôt que de les retirer.

## Idées rejetées
(rien pour l'instant)

## Décisions de design
- Un seul code cohérent, pas de rustines. Rien de payant ni relié au propriétaire. Clés chiffrées.
