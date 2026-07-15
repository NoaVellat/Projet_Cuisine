# 🍳 REPRISE DE SESSION — à coller à Claude en début de nouvelle session

> Colle ce fichier (ou dis « lis REPRISE_SESSION.md ») au démarrage d'une nouvelle
> session pour que je reprenne le projet **Le Poste** sans rien perdre.

---

## Qui je suis (l'utilisateur)

Noa Vellat, il/lui. Développeur Web, **ex-chef de partie** (gastronomie lyonnaise),
Epitech Lyon, **alternance 2025→2027**. Portfolio actuel : noa-vellat.netlify.app.
J'apprends la stack en construisant ce projet avec toi.

## Comment je veux qu'on travaille (IMPORTANT)

1. **Compte rendu pédagogique à CHAQUE étape** : à la fin de chaque tâche, explique
   quelles briques de la stack tu as utilisées, **pourquoi** ces choix, et le rôle
   de chaque fichier créé/modifié. Pas juste « c'est fait ».
2. **On avance étape par étape**, c'est notre projet commun.
3. **Je committe moi-même** — ne commit jamais sans que je le demande.
4. **Déploiement = Vercel** (pas Netlify).
5. Communication et code **en français**.

## Ce qu'il faut lire en premier (dans cet ordre)

1. **`README.md`** — la doc complète : stack, pipeline assets, structure, carte des
   zones, easter eggs, état d'avancement, pièges appris. **Tout est dedans.**
2. `BRIEF_portfolio_3d_cuisine.md` — le brief d'origine (vision non négociable).
3. `src/scene/Kitchen.jsx` — le cœur : chargement GLB + toutes les interactions/animations.
4. `tools/build_kitchen.py` — la modélisation scriptée du poste.

## Le projet en une phrase

Portfolio 3D : une **cuisine de gastronomie en vue première personne statique**
(caméra à états, pas de déplacement libre). Chaque objet du décor a un sens et mène
à une section du portfolio. Le poste est **généré par un script Python Blender**,
pas modélisé à la main.

## Commandes essentielles

```bash
npm run dev      # http://localhost:5173  (JAMAIS Live Server / port 5500 !)
npm run assets   # régénère le GLB (Blender headless → meshopt)
npm run shots    # captures Puppeteer → tools/shots/  (pour VOIR le rendu)
npm run build    # build de prod
```

## Réflexe de validation visuelle

Après **tout** changement 3D : `npm run shots` puis **lire les PNG** de `tools/shots/`
avec l'outil Read. C'est mes yeux. Le script force `quality:'high'` avant capture
(sinon le headless SwiftShader bascule en `low` et coupe ombres/effets).

## Pièges qui mordent (déjà appris — ne pas refaire)

- **Inox metalness ≤ 0.65** sinon façades noires. **Lettres cuivre** = metalness
  ~0.55 + émission, sinon illisibles.
- Objet Blender multi-matériaux → **Group de meshes** en three.js (`zoneRootOf`).
- **Origine = pivot** : 1er objet du `join()` donne l'origine (portes/charnière,
  casseroles/crochet, tiroirs/façade).
- Texte 3D Blender = **ASCII sans accents** uniquement.
- **`gltf-transform meshopt`**, JAMAIS `optimize` (détruirait les `zone_*`).
- `shoot.mjs` : `waitUntil: 'domcontentloaded'` (networkidle0 bloqué par HMR).
- `public/models/poste.glb` **doit être committé** (Vercel n'a pas Blender).

## 👉 OÙ ON EN EST / PROCHAINE TÂCHE

Tout le poste est fait et vivant (P0→P3 partiel + interactivité complète : xylophone,
légumes-stacks, terminal animé, piano+four, parcours en post-its, easter eggs). Voir
la section 9 du README pour le détail coché.

**Prochaine phase = les deux salles voisines.** Les portes existent déjà dans le GLB
(`zone_froid` à gauche, `zone_salle` à droite), elles sont cliquables mais ne font
qu'un « tick » pour l'instant.

- **Chambre froide (gauche)** = galerie vidéo des projets. Il faut les mp4 de
  `noa-vellat.netlify.app/assets/videos/*.mp4` (jeux-videops, klivio, my-video-club,
  generateur-cv, my-notion, core_lab). **Question à me poser à Noa** : je les télécharge
  dans `public/` (poids ~10-30 Mo, chargés seulement à l'entrée dans la salle) ou il
  fournit des versions compressées ? Gérer le CORS si stream direct.
- **Salle du restaurant (droite)** = à définir avec Noa (tables ? ardoise du menu ?).

Mécanique pour ajouter une nouvelle salle/zone : nouvel état dans le store + POI dans
`pois.js` + nœud `zone_*` dans le GLB + branche dans le `onClick` de Kitchen.jsx.

## Reste à faire aussi (plus tard)

- QA mobile réelle (tactile), Lighthouse.
- Bake lightmaps Blender (optionnel — le rendu ombres+env actuel est déjà bon).
- P4 : déploiement Vercel + lien croisé depuis le portfolio actuel.

---

*Dernière mise à jour : 2026-07-15. Si le README a été modifié depuis, il fait foi.*
