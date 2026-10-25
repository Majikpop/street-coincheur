# Street Coincheur

Belote coinchée entre amis, jouable sur téléphone :
- **table en ligne** : chaque joueur sur son écran, via un lien ou un code à 4 lettres ;
- **passe-et-joue** : un même téléphone peut tenir deux sièges (le jeu se masque entre les mains) ;
- **IA** pour compléter une table ;
- **tournoi duplicate** : toutes les tables jouent les mêmes donnes, par séries de N donnes qui tournent entre les tables, avec classement en points de match (Nord-Sud et Est-Ouest).

Site statique (HTML/JS, sans compilation) + Firebase (Firestore + connexion anonyme) pour le temps réel.

## Mise en route (une fois, ~15 min)

### 1. Firebase
1. https://console.firebase.google.com → **Ajouter un projet** (ex. `street-coincheur`), Google Analytics inutile.
2. **Build → Authentication → Commencer → Sign-in method → Anonyme → Activer.**
3. **Build → Firestore Database → Créer une base de données** → emplacement `eur3 (europe)` → mode **production**.
4. Onglet **Règles** de Firestore : coller le contenu de `firestore.rules`, puis **Publier**.
5. **Paramètres du projet (roue dentée) → Vos applications → icône Web `</>`** → nom `web` (pas besoin de Firebase Hosting) → copier l'objet `firebaseConfig` dans `config.js`.
6. **Authentication → Paramètres → Domaines autorisés → Ajouter** : `majikpop.github.io`.

### 2. GitHub Pages
Dépôt → **Settings → Pages → Source : Deploy from a branch → main / (root) → Save.**
Le jeu est alors en ligne sur `https://majikpop.github.io/street-coincheur/` (une à deux minutes).

Sans `config.js` rempli, le jeu fonctionne hors ligne (parties sur le téléphone uniquement).

## Fichiers
| Fichier | Rôle |
|---|---|
| `engine.js` | Règles de la coinche, score, IA, duplicate (rotation, points de match) |
| `table.js` | Protocole d'une table : toute action est validée ici, dans une transaction |
| `app.js` | Interface, connexion Firebase, mode hors ligne |
| `config.js` | Configuration Firebase du projet |
| `firestore.rules` | Règles d'accès Firestore |
| `test/engine.test.js` | Tests du moteur (donnes complètes, score, coinche/surcoinche, duplicate) |

## Tests
Aucune dépendance, Node 18 ou plus : `npm test` (ou `node --test`).

## Limites connues (V1 pilote)
- Pas d'annonces de carrés ou suites (enchères à la couleur, sans atout et tout atout disponibles).
- Pas de comptes joueurs : identité anonyme par téléphone + prénom. Un joueur qui change de téléphone reprend son siège avec « C'est moi ».
- Les mains sont dans la base partagée : un joueur bricoleur pourrait les lire. Acceptable entre amis, à revoir avant une diffusion large.
