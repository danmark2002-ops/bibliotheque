# Politique de confidentialité — Bibliothèque

Dernière mise à jour : 22 octobre 2026 (application version 10.1)

Bibliothèque est une application de lecture qui fonctionne d'abord sur votre téléphone. Le développeur ne possède aucun serveur qui recevrait vos données, ne demande aucun compte, n'affiche aucune publicité et n'utilise aucun outil de statistiques ou de suivi.

## Ce qui reste sur votre téléphone

Vos livres, vos bibliothèques, votre progression de lecture et vos réglages sont enregistrés uniquement dans l'application, sur votre appareil. Les clés que vous saisissez (par exemple une clé Gemini ou Claude) y sont conservées chiffrées par le coffre sécurisé d'Android (Keystore). Le développeur n'a accès à rien de tout cela.

La reconnaissance du texte des pages photographiées et l'IA intégrée au téléphone (Gemini Nano), lorsqu'elle est disponible, fonctionnent sur l'appareil : vos pages ne sont pas envoyées. Ces deux fonctions reposent sur des composants Google (ML Kit, services Google Play) qui peuvent transmettre à Google des données techniques sur leur fonctionnement (modèle du téléphone, version d'Android, indicateurs de performance, erreurs), selon les conditions de Google.

## Au démarrage de l'application

- **Polices d'écriture** : l'application charge ses polices (Fraunces, Literata, Inter) depuis Google Fonts. Google reçoit alors l'adresse IP de votre appareil et les informations habituelles d'une requête web, mais rien sur ce que vous lisez. Sans connexion Internet, l'application utilise les polices du téléphone.

## Fonctions qui utilisent Internet, seulement quand vous les lancez

- **Livres gratuits** : la recherche et le téléchargement passent par des catalogues publics du domaine public (Gutendex / Projet Gutenberg, Wikisource et son service d'export). Les mots que vous cherchez leur sont envoyés.
- **Définitions et traduction** : le mot ou le passage touché est envoyé au Wiktionnaire ou au service de traduction MyMemory.
- **Résumés, Professeur et vidéos par IA en ligne** : si vous choisissez ces fonctions avec votre propre clé, le texte nécessaire (extraits ou totalité du livre choisi, votre question) est envoyé au service d'IA que vous avez choisi (Gemini de Google, ou Claude d'Anthropic). Leurs propres conditions s'appliquent, selon la clé que vous utilisez.
- **Images des vidéos** : pour illustrer une vidéo, des mots-clés tirés de la vidéo sont envoyés à Wikimedia Commons et à Openverse, puis les images choisies sont téléchargées depuis les sites qui les hébergent.
- **Partage d'une bibliothèque par lien** : le paquet est d'abord chiffré sur votre téléphone, puis déposé sur un hébergement temporaire (Litterbox, effacé après 72 heures ; sinon Uguu, effacé après 3 heures). La clé de déchiffrement se trouve seulement dans la partie du lien après le « # », que votre navigateur n'envoie jamais à un serveur : l'hébergeur ne peut pas lire vos livres. La page de réception du lien est servie par raw.githack.com. Vous pouvez aussi ouvrir un ancien lien Gofile reçu d'une autre personne.
- **Diffusion sur la télé** : Google Cast est utilisé seulement si vous l'activez. La vidéo est lue directement depuis votre téléphone par le Wi-Fi de la maison, grâce à un petit serveur temporaire qui n'est pas accessible depuis Internet.
- **Lecture à voix haute et commandes vocales** : la lecture utilise le moteur vocal de votre téléphone et les commandes vocales utilisent le service de reconnaissance vocale d'Android (en général celui de Google). Selon les réglages de votre téléphone, ces services peuvent traiter le texte ou le son en ligne, selon leurs propres conditions. Le son n'est ni enregistré ni envoyé au développeur.

Ces services ont leurs propres politiques de confidentialité. En dehors des polices ci-dessus, rien n'est envoyé sans une action de votre part.

## Autorisations

- **Fichiers** : seulement pour ouvrir les livres et les dossiers que vous choisissez vous-même.
- **Micro** : seulement pendant une commande vocale que vous lancez.
- **Lecture en arrière-plan** : pour continuer la lecture à voix haute quand l'écran est éteint.
- **Internet et état du réseau** : pour les fonctions ci-dessus.

## Achat de la version Premium

La version Premium est un achat unique facultatif. Le paiement est entièrement géré par Google Play : l'application ne voit jamais vos coordonnées de paiement et reçoit seulement de Google Play la confirmation que Premium est acheté, gardée sur votre téléphone.

## Conservation et suppression

Tout ce qui est sur votre téléphone s'efface en désinstallant l'application ou en effaçant ses données dans les réglages d'Android. Les fichiers partagés par lien s'effacent seuls après 72 heures (ou 3 heures). Le développeur ne conserve aucune donnée vous concernant.

## Enfants

L'application ne s'adresse pas particulièrement aux enfants de moins de 13 ans.

## Contact

Pour toute question, écrivez au développeur à l'adresse indiquée sur la fiche Google Play de l'application.

---

# Privacy policy — Bibliothèque

Last updated: October 22, 2026 (app version 10.1)

Bibliothèque works primarily on your device. The developer runs no server that receives your data, requires no account, shows no ads and uses no analytics or tracking tools. Your books, libraries, reading progress and settings stay on your device; keys you enter are stored encrypted with Android Keystore.

Text recognition and Gemini Nano run on the device; they rely on Google components (ML Kit, Google Play services) that may send technical diagnostics to Google. At startup the app loads its fonts from Google Fonts, so Google receives your device's IP address. When you start them, internet features send only what they need: searches to public-domain catalogs (Gutendex/Project Gutenberg, Wikisource), words to Wiktionary or MyMemory for definitions and translation, text to Gemini or Claude if you use your own API key, keywords to Wikimedia Commons and Openverse for video images. Library sharing by link encrypts the package on your phone before upload to a temporary host (Litterbox, 72 h, or Uguu, 3 h); the decryption key lives only after the « # » of the link and is never sent to a server. Text-to-speech and voice commands use your phone's speech services, which may process data online depending on your settings. Google Cast streams video from your phone over your home Wi-Fi only when you enable it.

The optional Premium upgrade is a one-time purchase handled entirely by Google Play: the app never sees your payment details and only receives Google Play's confirmation. Uninstalling the app or clearing its data erases everything on your device. The developer retains no data about you.
