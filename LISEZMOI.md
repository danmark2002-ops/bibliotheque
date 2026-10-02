# Bibliothèque — mise en ligne

Le projet contient deux parties :

- **`server/`** : le serveur. Il garde tes livres, affiche l'étagère, gère les liens de partage et note qui lit quoi.
- **`android/`** : l'application Android, compilée gratuitement par GitHub.

Les gens à qui tu partages un lien n'ont rien à installer. Ils lisent dans leur navigateur, sur téléphone ou sur ordinateur.

---

## Étape 1 — Mettre le projet sur GitHub (10 min)

1. Crée un compte gratuit sur **github.com**.
2. Clique sur **New repository**. Nomme-le `bibliotheque`, choisis **Private**, puis **Create repository**.
3. Clique sur **uploading an existing file**, glisse **tout le contenu** du dossier décompressé, puis **Commit changes**.
4. Vérifie que le dossier `.github` est bien là. Un ordinateur peut cacher les dossiers qui commencent par un point, et ce dossier ne sera alors pas envoyé. S'il manque, ajoute-le à la main : **Add file → Create new file**, nom `.github/workflows/apk.yml`, puis colle le contenu du fichier `apk.yml` et enregistre.

## Étape 2 — Mettre le serveur en ligne sur Railway (10 min)

1. Va sur **railway.com** et connecte-toi avec ton compte GitHub.
2. **New Project → Deploy from GitHub repo →** choisis `bibliotheque`. Railway lit le fichier `Dockerfile` tout seul.
3. Dans le service, ouvre **Settings → Volumes → Add Volume** et indique `/data` comme chemin de montage (*mount path*). **C'est indispensable** : sans volume, tes livres disparaîtraient à chaque redémarrage.
4. Ouvre **Settings → Networking → Generate Domain**. Tu obtiens une adresse du genre `https://bibliotheque-production.up.railway.app`.
5. Ouvre cette adresse dans ton navigateur, donne un nom à ta bibliothèque et choisis ton mot de passe. **Fais-le tout de suite** : la première personne qui ouvre l'adresse choisit le mot de passe.

Coût : Railway offre un crédit d'essai, puis le forfait Hobby coûte environ 5 $ US par mois, volume compris.

## Étape 3 — Installer l'APK sur ton téléphone

1. Sur GitHub, ouvre l'onglet **Actions**. La tâche « Construire l'APK » démarre toute seule et prend environ 4 minutes. Si elle ne démarre pas, clique sur **Run workflow**.
2. Une fois la tâche finie (crochet vert), va dans **Releases** (colonne de droite de la page du dépôt) et télécharge **Bibliotheque.apk** depuis ton téléphone.
3. Ouvre le fichier. Android demandera d'autoriser l'installation d'applications provenant de cette source : accepte.
4. Au premier lancement, colle l'adresse Railway de l'étape 2.

## Utilisation

- **Ajouter un livre** : PDF ou texte (.txt). Sur ordinateur, tu peux aussi glisser les fichiers sur la page.
- **Modifier ou supprimer un livre** : appui long sur le livre, ou le bouton ✎ (« Organiser »).
- **Partager** :
  - un **lien personnel** par personne, pour savoir exactement qui lit ;
  - ou un **lien ouvert** : chaque visiteur écrit son nom en entrant.
  - Un lien peut être désactivé à tout moment.
- **Lecteurs** : pour chaque personne, tu vois :
  - ses visites, avec la date, l'heure, la durée et l'appareil ;
  - les livres ouverts, avec le nombre d'ouvertures ;
  - la page où elle est rendue et l'historique complet.
- **Lecture audio** : bouton 🎧 dans le lecteur. La lecture avance phrase par phrase et tourne les pages toute seule. Tu peux régler la vitesse. Dans l'application, c'est la voix française du téléphone qui lit : si elle sonne mal, installe « Synthèse vocale Google » et choisis-la dans les réglages Android.

## Protection des livres

Les invités ne reçoivent **jamais le fichier**. Le serveur leur envoie une page à la fois, sous forme d'image, avec leur nom en filigrane. On ne peut donc pas les télécharger, mais aucune protection n'empêche une capture d'écran. Le filigrane sert justement à décourager ce genre de copie.
