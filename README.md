# Street Coincheur

Belote coinchée entre amis, jouable sur téléphone, en habillage arcade.

**Jouer : https://majikpop.github.io/street-coincheur/**

## Ce qu'on peut faire
- **Partie libre** : score à atteindre au choix (500, 1000, 1500 ou 2000), option **MOC** (« Monte ou Coinche » : interdit de passer, on surenchérit ou on coinche).
- **Table en ligne** : chaque joueur sur son écran, via un lien (partage WhatsApp intégré) ou un code à 4 lettres.
- **Passe-et-joue** : un même téléphone peut tenir deux sièges (le jeu se masque entre les mains).
- **IA** pour compléter une table.
- **Tournoi duplicate** : toutes les tables jouent les mêmes donnes, par séries de N donnes qui tournent entre les tables, avec classement en points de match (Nord-Sud et Est-Ouest).
- Installable sur l'écran d'accueil (icône, manifeste), aperçu soigné quand on partage le lien.

Site statique (HTML/JS, sans compilation) + Firebase (Firestore + connexion anonyme) pour le temps réel.

## Règles appliquées
- **Contrats** : de 80 à 160 par dizaines, puis capot (250), à pique, cœur, carreau, trèfle, **sans atout** ou **tout atout**.
  - Sans atout : l'as vaut 19. Tout atout : chaque couleur est atout, barème réduit (V 14, 9 9, A 6, 10 5, R 3, D 1). Toujours 152 points + 10 de der.
- **Jeu** : fournir ; à l'atout, monter ; sinon couper ou surcouper (sous-couper si on ne peut pas monter). **Partenaire maître** : pas d'obligation de monter, couper ni surcouper.
- **Coinche** par l'adversaire du preneur, puis **surcoinche** possible par l'équipe preneuse.
- **Score** :
  - contrat réussi (au moins l'annonce et 82 points, belote comprise) : annonce + points faits pour l'attaque, points faits pour la défense ;
  - coinché / surcoinché réussi : 160 + annonce × 2 (× 4) pour l'attaque, rien pour la défense ;
  - chute : 160 + annonce × multiplicateur pour la défense ;
  - belote (+20) toujours à son détenteur ; capot = 250 points de cartes ; un contrat à 250 exige tous les plis.

## Mise en route
Déjà faite pour ce dépôt (projet Firebase `street-coincheur` branché dans `config.js`, GitHub Pages sur `main`). Pour une autre installation :

### 1. Firebase
1. https://console.firebase.google.com → **Ajouter un projet**, Google Analytics inutile.
2. **Build → Authentication → Commencer → Sign-in method → Anonyme → Activer.**
3. **Build → Firestore Database → Créer une base de données** → emplacement `eur3 (europe)` → mode **production**.
4. Onglet **Règles** de Firestore : coller le contenu de `firestore.rules`, puis **Publier**.
5. **Paramètres du projet (roue dentée) → Vos applications → icône Web `</>`** → nom `web` (pas besoin de Firebase Hosting) → copier l'objet `firebaseConfig` dans `config.js`.
6. **Authentication → Paramètres → Domaines autorisés → Ajouter** : le domaine GitHub Pages (ex. `majikpop.github.io`).

### 2. GitHub Pages
Dépôt → **Settings → Pages → Source : Deploy from a branch → main / (root) → Save.** Le site est en ligne une à deux minutes après chaque push sur `main`.

Sans `config.js` rempli, le jeu fonctionne hors ligne (parties sur le téléphone uniquement).

### Mise à jour
Les fichiers sont appelés avec `?v=…` dans `index.html` : changer ce numéro à chaque publication force les téléphones à recharger la nouvelle version. L'ancienne adresse `/v2/` redirige vers l'accueil.

## Fichiers
| Fichier | Rôle |
|---|---|
| `engine.js` | Règles de la coinche, score, IA, duplicate (rotation, points de match) — sans DOM |
| `table.js` | Protocole d'une table : toute action est validée ici, dans une transaction |
| `app.js` | Interface, connexion Firebase, mode hors ligne |
| `poster.js` | Affiche « Dédé contre Josie » de l'accueil (SVG) |
| `style.css` | Habillage arcade |
| `config.js` | Configuration Firebase du projet |
| `firestore.rules` | Règles d'accès Firestore |
| `test/engine.test.js` | Tests du moteur (donnes complètes, score, coinche/surcoinche, duplicate) |
| `og.png`, `icon*`, `manifest.webmanifest` | Aperçu de partage, icônes, installation sur l'écran d'accueil |

## Tests
Aucune dépendance, Node 18 ou plus : `npm test` (ou `node --test`).

## Limites connues
- Pas d'annonces de carrés ni de suites (seule la belote est comptée).
- Pas de comptes joueurs : identité anonyme par téléphone + prénom. Un joueur qui change de téléphone reprend son siège avec « C'est moi ».
- Les mains sont dans la base partagée : un joueur bricoleur pourrait les lire. Acceptable entre amis, à revoir avant une diffusion large.
