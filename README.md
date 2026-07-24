# Le Poste — Portfolio 3D « Cuisine du chef Noa Vellat »

> Portfolio 3D interactif en vue première personne statique, centré sur **un poste
> de cuisine gastronomique**. Chaque élément du décor mène à une section du
> portfolio. La scène 3D est un **renderer de plus** du contenu de
> [noa-vellat.netlify.app](https://noa-vellat.netlify.app).
>
> **Ce fichier est aussi un document de passation** : il permet de reprendre le
> projet dans une nouvelle session sans rien perdre.

---

## 1. Démarrer

```bash
npm install
npm run dev          # → http://localhost:5173  (serveur de dev, HMR)
npm run build        # build de prod dans dist/
npm run preview      # sert dist/ sur http://localhost:4173
```

> ⚠️ **Ne PAS utiliser Live Server (port 5500)** : c'est un serveur de fichiers
> statiques, il ne transpile pas le JSX ni ne résout les imports. Le projet a
> besoin de Vite (`npm run dev`).

### Régénérer le modèle 3D (nécessite Blender installé)

```bash
npm run assets       # Blender construit le poste → assets-src/poste.glb
                     # puis gltf-transform le compresse → public/models/poste.glb
npm run assets:pack  # juste l'étape de compression (si le .glb brut existe déjà)
```

### Voir le rendu sans ouvrir le navigateur (outil de dev)

```bash
npm run shots        # capture chaque POI dans tools/shots/ (dev server requis sur :5173)
```

---

## 2. Stack

| Rôle | Choix |
|---|---|
| Rendu | React 18 + `@react-three/fiber` (R3F 8) |
| Helpers 3D | `@react-three/drei` (useGLTF, Html, useProgress, Environment, Lightformer…) |
| Post-processing | `@react-three/postprocessing` (bloom + vignette + SMAA) |
| État | `zustand` |
| Animation caméra | `maath` (`easing.damp3` / `damp` — amortissement frame-rate independent) |
| Build | Vite |
| Modélisation | **Blender 5.x scripté en Python** → GLB → `@gltf-transform/cli` (meshopt) |
| Audio | **WebAudio synthétisé** (aucun fichier son) |
| Déploiement | **Vercel** (`vercel.json`) |

---

## 3. Le pipeline assets — LE point d'architecture

Le poste 3D n'est **pas** modélisé à la main dans Blender : il est **généré par
un script Python** ([`tools/build_kitchen.py`](tools/build_kitchen.py)), donc
versionnable, reproductible et itérable.

```
src/scene/layout.json   ← source de vérité des cotes (lu par JS ET Python)
        │
        ├─→ [Vite] src/scene/layout.js → le front (POI, positions R3F)
        │
        └─→ [Blender] tools/build_kitchen.py
                 → assets-src/poste.glb          (brut ~2 Mo, gitignoré)
                 → [gltf-transform meshopt]
                 → public/models/poste.glb        (~500 Ko, VERSIONNÉ)
```

**Conventions & pièges appris (à respecter absolument) :**

- **Objets `zone_*`** = interactifs côté R3F. Tout le reste = décor
  (`raycast = () => null`). Un objet Blender multi-matériaux arrive dans three.js
  comme un **Group de meshes** (un par matériau) → `zoneRootOf()` remonte les
  parents jusqu'au nom `zone_*`.
- **Origine = pivot** : pour toute pièce animée, le 1er objet du `join()` donne
  son origine au groupe. Ex. portes (charnière en 1er → `rotation.y`), casseroles
  du xylophone (crochet en 1er → balancement), tiroirs (façade centrée → `position.z`).
- **Inox : metalness ≤ 0.65** sinon les façades virent au **noir** (un métal pur
  ne vit que de reflets, l'env map 64px est trop pauvre).
- **Lettres cuivre : metalness ~0.55 + légère émission** sinon illisibles dans la
  pénombre. Matériau `copper_text`.
- **Texte 3D** = `bpy.ops.object.text_add` converti en mesh. **ASCII sans accents
  uniquement** (police par défaut de Blender).
- **NE PAS utiliser `gltf-transform optimize`** (join/flatten détruirait les nœuds
  `zone_*` et les origines-pivots). Utiliser **`meshopt`** qui préserve la hiérarchie.
- Le décodeur meshopt est embarqué dans three, drei le décode nativement (rien à
  configurer).

---

## 4. Structure du projet

```
src/
  main.jsx              # entrée + console.log easter egg (indice Konami)
  App.jsx              # Canvas, lumières, PerformanceMonitor, orchestration audio,
                       #   raccourcis clavier (Échap, Entrée, Konami), loader
  content/content.js   # CONTENT — synchronisé depuis noa-vellat.netlify.app
  store/useSceneStore.js  # zustand : view, zoneId, projectId, bacIndex, muted,
                          #   classic, lampOn, rush + actions
  scene/
    layout.json        # cotes du poste (source de vérité JS + Python)
    layout.js          # ré-export du JSON pour le front
    pois.js            # points d'intérêt caméra (pos + target) par état
    CameraRig.jsx      # useFrame : damp3 vers le POI courant + parallax souris
    Kitchen.jsx        # ⭐ cœur : charge le GLB, mappe les zones, TOUTES les
                       #   animations (portes, tiroirs, flammes, vapeur, xylophone,
                       #   couteau, terminal…), les tickets DOM
    textures.js        # CanvasTextures (carrelage métro, sol, terminal animé)
    Effects.jsx        # post-processing conditionné à quality
  audio/sfx.js         # WebAudio synthétisé (whoosh, bell, slide, tick, quack,
                       #   blup, potNote xylophone, ambiance mijotage)
  ui/
    Overlay.jsx        # HUD (nom, CV, mode classique, son), CTA d'entrée,
                       #   labels de survol, nav clavier
    ClassicMode.jsx    # fallback HTML complet (accessible sans WebGL)
  styles.css           # DA « ticket thermique », loader, HUD, mode classique

tools/
  build_kitchen.py     # génère tout le poste (Blender headless)
  shoot.mjs            # captures Puppeteer de chaque POI → tools/shots/
  shots/               # captures de contrôle (peuvent être régénérées)

public/
  models/poste.glb     # modèle compressé (~500 Ko, À COMMITTER pour Vercel)
  cv.pdf               # CV réel

assets-src/            # GLB brut (gitignoré, régénérable via npm run assets)
vercel.json            # cache immutable sur /models/*
```

---

## 5. Machine à états & carte des zones

`view` (dans le store) : **`entry` → `overview` → `focus` → `detail`**

- `entry` : couloir face aux portes battantes. Clic / Entrée → `enter()` → les
  battants s'ouvrent, la caméra traverse vers `overview`.
- `overview` : vue d'ensemble du poste, parallax souris actif.
- `focus` : caméra sur une zone (POI), le ticket DOM s'affiche.
- `detail` : un tiroir projet ouvert, spot chaud + bon de commande posé.

Échap remonte d'un état (`goBack()`). Le clic dans le vide (`onPointerMissed`) aussi.

| Zone 3D | `zoneId` | Section | Nœud GLB |
|---|---|---|---|
| Tiroirs (2×3) | `drawers` | Plats Signatures (6 projets) | `zone_drawer_0..5` |
| Saladette (5 bacs) | `skills` | Les Ingrédients (5 familles) | `zone_bac_0..4` |
| Tableau mural | `board` | La Brigade (parcours en post-its) | `zone_board` |
| Livre / étagère | `shelf` | Le Chef (récit reconversion) | `zone_book` |
| Le passe + lampe | `pass` | Réservations (contact) | `zone_pass` |
| Machine à bons | `cv` | Télécharge le CV | `ticket_machine`, `ticket_paper` |
| Portes d'entrée | `entry` | Ouverture de la scène | `door_L`, `door_R` |

**Voix « Mise en Place »** (table VOICE du portfolio) partout dans l'UI :
Plats Signatures · Les Ingrédients · La Brigade · Le Chef · Réservations.

---

## 6. Interactions & easter eggs

| Élément | Interaction | Nœud |
|---|---|---|
| 🎵 4 casseroles suspendues | **Xylophone** — clic = note (sol/la♯/do/ré♯) + balancement pendule | `zone_note_0..3` |
| 🎵 2 bocaux à épices | Timbre **cristal** (sinus purs, longue traîne) | `zone_glass_0..1` |
| 🎹 7 manettes du piano | **Le piano de cuisson joue du piano** — corde frappée (inharmonicité), gamme pentatonique de do ; quart de tour + coup de feu sur le foyer correspondant (0-3 = feux vifs, 4 = coupe-feu, 5 = friteuse, 6 = four) | `zone_knob_0..6` |
| 🥁 4 ustensiles de la barre | **Percussion** — gong (louche), cymbale (écumoire), bloc de bois (spatule), shaker (fouet) + pendule propre à chacun | `zone_ust_0..3` |
| 🥩 **Mini-jeu : cuire le steak** | Poêle du feu avant-droit — clic = lance une commande (cuisson au sort), clic = **retourne** (saisir les 2 faces), *Envoyer* au bon moment. La viande change de couleur selon la face saisie, saute à chaque retournement, grésil + feu qui pousse. Barème : justesse de cuisson **et** régularité de saisie (⭐×3). Cf. [useSteakStore](src/game/useSteakStore.js), [SteakHUD](src/ui/SteakHUD.jsx) | `zone_steak` |
| 🔪 5 légumes sur le billot | Clic = ouvre la famille de skills (couleur assortie) | `zone_veg_0..4` |
| 💻 Laptop (coin droit) | Écran-terminal animé (typing du build) · clic → **mode classique** | `zone_laptop` |
| 🦆 Canard bleu Epitech | Clic → coin-coin · se dandine en continu | `zone_duck` |
| 🍲 Marmite du piano | Clic → *bloup* | `zone_pot` |
| 💡 Lampe du passe | Clic → éteint / rallume | `lamp_shade`, `lamp_bulb` |
| 🧊 Porte chambre froide (g.) | Clic (teaser — galerie vidéo à venir) | `zone_froid` |
| 🍽️ Porte salle (d.) | Clic (teaser — à venir) | `zone_salle` |
| ⌨️ **Code Konami** ↑↑↓↓←→←→BA | « Coup de feu ! » : tous les tiroirs s'ouvrent, double cloche | — |
| 🖥️ Console (F12) | ASCII stylé + indice Konami | `main.jsx` |

**Légume → stack (couleurs partagées bac/légume/UI) :** tomate=Frontend (rouge),
courgette=Backend (vert), citron=DevOps (jaune), oignon=MERN (crème), carotte=Soft (orange).

**Animations en continu (`useFrame` de Kitchen.jsx) :** les 4 foyers du piano
pro — feux vifs, coupe-feu (fonte, respiration lente), friteuse (frémissement
serré) et four (lueur ambre à travers la vitre fumée) — qui vacillent chacun à
son rythme et montent quand on pousse leur manette, vapeur de la marmite/sauteuse
(sphères `meshBasic` translucides en boucle), canard qui se dandine, couteau qui
hache (rafale/pause), casseroles et ustensiles qui pendulent après frappe (une
inertie par ustensile, `UST_SWING`), terminal redessiné à 8 fps.

**Audio ([sfx.js](src/audio/sfx.js)) :** tout synthétisé, zéro asset. AudioContext
créé au 1er geste (autoplay policy). Orchestration centralisée dans un `subscribe`
zustand (App.jsx). Bouton muet dans le HUD. Ambiance = souffle de hotte (bruit brun)
+ frémissement de marmite (bulles aléatoires).

Quatre familles d'instruments, quatre synthèses distinctes — c'est le rapport
entre partiels qui fait entendre la matière : `struck()` additionne des partiels
amortis (multiples irrationnels = métal, entiers = note franche, et plus un
partiel est haut plus il meurt vite) pour le cuivre, le verre, le gong et la
cymbale ; `pianoKey()` y ajoute l'inharmonicité d'une corde raide
(`f·n·√(1+Bn²)`), une attaque de 4 ms et un feutre de marteau ; le bloc de bois
et le shaker, eux, ne sont **que** du bruit filtré — pas de note du tout. Le
mini-jeu du steak ajoute un **grésil bouclé** (`sizzleStart/Level/Stop` : bruit
filtré tenu + crépitements aléatoires, qui s'affole vers le cramé), un « flac »
au retournement, un carillon à l'envoi réussi et un buzzer au raté.

**Mini-jeu du steak** ([useSteakStore.js](src/game/useSteakStore.js)) : la
cuisson temps réel vit dans le `useFrame` de Kitchen.jsx (source de vérité, une
chaleur par face selon la face en contact) ; le store n'en reçoit qu'un miroir
throttlé (~12 Hz) pour le HUD. `round`/`flips` resynchronisent la boucle de
rendu sans coupler la logique à l'origine du clic (scène 3D **ou** boutons DOM).
Le HUD est un bon de commande docké à droite (même DA que les tickets du passe) ;
quitter le poste (Échap, retour, autre zone) coupe la partie et le grésil via un
`subscribe` dans App.jsx.

---

## 7. Contrat perf & accessibilité

- `PerformanceMonitor` (drei) : `quality: 'low'` → coupe postprocessing + ombres,
  DPR forcé à 1. DPR plafonné à 1.5 sur tactile.
- **Ombres temps réel** : une seule lumière projette (directionnelle), gatée
  `quality === 'high'`, shadow-camera bornée à la taille du poste.
- `prefers-reduced-motion` : smoothTime réduit (~0.12), parallax coupé, animation
  des tickets désactivée.
- **Navigation clavier** : Tab circule sur des boutons de zone invisibles, Enter
  déclenche, Échap remonte. Konami au clavier.
- **Tout le texte est DOM** (jamais rendu uniquement en 3D) → accessible, indexable.
- **Mode classique** : fallback HTML complet accessible en 1 clic depuis n'importe où.
- **Loader thématique** : « Mise en place en cours… » + barre de progression réelle.

---

## 8. Déploiement (Vercel)

- Vercel détecte Vite automatiquement (build `npm run build`, output `dist/`).
- [`vercel.json`](vercel.json) : cache immutable 1 an sur `/models/*`.
- **`public/models/poste.glb` DOIT être committé** (Vercel n'a ni Blender ni
  gltf-transform). `assets-src/` est gitignoré.
- Prévoir un **lien croisé** depuis le portfolio actuel vers le portfolio 3D (P4).

---

## 9. Où on en est (phases du brief)

- [x] **P0** Prototype gris (boucle overview→focus→detail, CameraRig, mobile)
- [x] **P1** Blocking Blender scripté (le poste, POI ajustés)
- [x] **Graphismes** hotte, saladette, carrelage, batterie cuivre, ombres, env map
- [x] **Entrée** portes battantes « NOA / VELLAT » + enseigne, animation de traversée
- [x] **P2** Contenu réel synchronisé, CV cliquable, mode classique complet
- [x] **P3 (partiel)** meshopt, loader, DPR mobile, favicon, méta OG
- [x] **Vie & interactivité** piano+four, xylophone, légumes-stacks, terminal animé,
      parcours en post-its, coin cuisson, vapeur, DA tickets « thermiques », easter eggs
- [ ] **PROCHAINE PHASE — les deux salles**
  - Chambre froide (gauche) = **galerie vidéo des projets**. Nécessite les mp4 de
    `noa-vellat.netlify.app/assets/videos/*.mp4` → à télécharger dans `public/`
    (poids ~10-30 Mo à vérifier, chargement à l'entrée dans la salle uniquement).
  - Salle du restaurant (droite) = à définir.
  - Les portes `zone_froid` / `zone_salle` sont déjà là (teasers).
- [ ] **P3 (reste)** bake lightmaps (optionnel), sons ✅, QA mobile réelle, Lighthouse
- [ ] **P4 Ship** déploiement Vercel + lien croisé

---

## 10. Notes de collaboration

- Communication et code en **français**.
- **Compte rendu pédagogique à chaque étape** : quelles briques de la stack, pourquoi
  ces choix, rôle de chaque fichier — l'utilisateur apprend la stack en construisant.
- **L'utilisateur committe lui-même** (ne pas commit sans demande explicite).
- Réflexe de validation visuelle : `npm run shots` après tout changement 3D, puis
  lire les PNG de `tools/shots/`. Le script force `quality: 'high'` avant capture
  (le headless SwiftShader ferait sinon basculer en `low`).

---

## 11. Identité (rappel)

Noa Vellat — Développeur Web, ex-chef de partie (gastronomie lyonnaise), Epitech Lyon,
**alternance 2025→2027**. Voix de marque : la rigueur de la brigade appliquée au code.
Contact : noa.vellat@epitech.eu · [github.com/NoaVellat](https://github.com/NoaVellat) ·
[LinkedIn](https://www.linkedin.com/in/noa-vellat-04594a207/).
