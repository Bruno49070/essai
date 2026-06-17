# Lecteur EPUB vocal, prototype PWA

Ce prototype est une application web installable qui permet d’importer un fichier EPUB non protégé et de le lire à haute voix avec la synthèse vocale du navigateur.

## Objectif

L’objectif n’est pas de générer un fichier MP3. L’application sert à écouter un livre en lecture vocale, directement depuis le navigateur ou depuis une PWA installée sur Android.

## Fonctionnalités

- Import local d’un fichier `.epub`.
- Extraction du texte avec `epub.js`.
- Lecture vocale avec l’API Web Speech du navigateur.
- Choix de la voix disponible sur l’appareil.
- Réglage de la vitesse de lecture.
- Pause, reprise, arrêt, chapitre précédent et suivant.
- Sauvegarde locale de la position de lecture.
- Fonctionnement sans compte utilisateur.

## Limites

- Les EPUB protégés par DRM ne sont pas pris en charge.
- La qualité de la voix dépend du navigateur et du téléphone.
- Sur Android, la lecture en arrière-plan ou écran verrouillé peut être interrompue par Chrome.
- Le premier chargement utilise `epub.js` depuis un CDN.

## Installation locale

Depuis le dossier du projet :

```bash
python -m http.server 8080
```

Puis ouvrir :

```text
http://localhost:8080
```

## Installation sur Android

1. Publier le dossier sur un hébergement HTTPS, par exemple GitHub Pages.
2. Ouvrir l’adresse dans Chrome Android.
3. Menu Chrome, puis `Ajouter à l’écran d’accueil` ou `Installer l’application`.

## Fichiers

- `index.html` : application principale.
- `manifest.json` : configuration PWA.
- `service-worker.js` : cache local simple.
