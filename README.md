# Street Coincheur

Belote coinchée entre amis, jouable sur téléphone :
- **table en ligne** : chaque joueur sur son écran, via un lien ou un code à 4 lettres ;
- **passe-et-joue** : un même téléphone peut tenir deux sièges (le jeu se masque entre les mains) ;
- **IA** pour compléter une table ;
- **tournoi duplicate** : toutes les tables jouent les mêmes donnes, par séries de N donnes qui tournent entre les tables, avec classement en points de match (Nord-Sud et Est-Ouest) ;
- **profil joueur** : stats d'une partie à l'autre (contrats, capots, coinches, belotes, parties gagnées), palmarès, place obtenue dans chaque tournoi joué, et **hall of fame** de la bande. Un code `XXXX-XXXX` permet de retrouver son profil sur un autre téléphone.

Site statique (HTML/JS, sans compilation) + Firebase (Firestore + connexion anonyme) pour le temps réel.

## Mise en route (une fois, ~15 min)

### 1. Firebase
1. https://console.firebase.google.com → **Ajouter un projet** (ex. `street-coincheur`), Google Analytics inutile.
2. **Build → Authentication → Commencer → Sign-in method → Anonyme → Activer.**
3. **Build → Firestore Database → Créer une base de données** → emplacement `eur3 (europe)` → mode **production**.
4. Onglet **Règles** de Firestore : coller le contenu de `firestore.rules`, puis **Publier**. À refaire à chaque modification de ce fichier.
5. **Paramètres du projet (roue dentée) → Vos applications → icône Web `</>`** → nom `web` (pas besoin de Firebase Hosting) → copier l'objet `firebaseConfig` dans `config.js`.
6. **Authentication → Paramètres → Domaines autorisés → Ajouter** : `majikpop.github.io`.

### Code admin (gestion des profils)
1. Firestore → **Données** → **Commencer une collection** : ID `adminKeys`, puis ID du document = **votre code admin** (format `XXXX-XXXX-XXXX-XXXX`, en majuscules, tirets compris), un champ quelconque (ex. `note` = `organisateur`). Ce code n'est jamais dans le dépôt, qui est public.
2. Dans l'appli : **Hall of fame → Administration** (en bas), saisir le code. Une fois par téléphone.
3. L'écran liste les profils (donnes jouées, dates, code de récupération), signale les doublons probables (même prénom aux accents et majuscules près) et permet de supprimer un profil avec ses fiches et son code. Le téléphone d'un profil supprimé est délié à sa prochaine ouverture de l'app.

Changer de code : supprimer le document dans `adminKeys` et en créer un autre. Retirer l'accès à un téléphone déjà admin : supprimer son document dans `admins`.

### 2. GitHub Pages
Dépôt → **Settings → Pages → Source : Deploy from a branch → main / (root) → Save.**
Le jeu est alors en ligne sur `https://majikpop.github.io/street-coincheur/` (une à deux minutes).

Sans `config.js` rempli, le jeu fonctionne hors ligne (parties sur le téléphone uniquement).

## Fichiers
| Fichier | Rôle |
|---|---|
| `engine.js` | Règles de la coinche, score, IA, duplicate (rotation, points de match) |
| `table.js` | Protocole d'une table : toute action est validée ici, dans une transaction |
| `profile.js` | Profils : fiches de donne, stats, classements de tournoi, titres, hall of fame |
| `app.js` | Interface, connexion Firebase, mode hors ligne |
| `config.js` | Configuration Firebase du projet |
| `firestore.rules` | Règles d'accès Firestore |
| `test/engine.test.js` | Tests du moteur (donnes complètes, score, coinche/surcoinche, duplicate) |
| `test/profile.test.js` | Tests des profils (fiches écrites en fin de donne, stats, classements, hall of fame) |
| `tools/bench.js` | Banc d'essai de l'IA : statistiques d'enchères, duplicate contre une autre version, recalibrage du modèle d'annonce |

## Tests
Aucune dépendance, Node 18 ou plus : `npm test` (ou `node --test`).

Niveau de l'IA : `npm run bench`. Pour comparer à la version en ligne : `git show main:engine.js > /tmp/ancien.js` puis `npm run bench -- --vs /tmp/ancien.js` (écart moyen par donne en duplicate, camps inversés sur chaque donne).

## Limites connues (V1 pilote)
- Pas d'annonces de carrés ou suites (enchères à la couleur, sans atout et tout atout disponibles).
- Pas de comptes joueurs : identité anonyme par téléphone + prénom. Un joueur qui change de téléphone reprend son siège avec « C'est moi ».
- Profils : un joueur garde son code dans ses notes (boutons Copier / Envoyer dans mes notes, le lien envoyé pré-remplit le code). Chaque donne jouée à une table en ligne par un siège lié à un profil laisse une fiche (`players/<id>/deals`). Les stats ne comptent qu'à partir de la création du profil. Le résumé affiché au hall of fame est republié quand le joueur ouvre son profil ou le hall of fame. Les fiches sont écrites par les téléphones des joueurs : un bricoleur pourrait gonfler ses stats.
- Mains privées sans serveur : chaque main est un document à part que seul son joueur peut lire (règles Firestore). Restent possibles pour un bricoleur qui modifie le code :
  - le téléphone qui distribue (partie libre) ou l'organisateur qui crée le tournoi voit passer les quatre jeux ;
  - un joueur assis peut lire les mains de l'IA (ce sont les téléphones des joueurs qui la font jouer) ;
  - « C'est moi » permet de prendre un siège en cours de donne, donc sa main (visible de toute la table) ;
  - la validité des coups est vérifiée par le téléphone du joueur, pas par un arbitre.

  Pour aller au-delà : faire distribuer et arbitrer par un serveur (Cloud Functions, formule Blaze).
