# Rapport d'audit de sécurité — Le Poste

**Date :** 2026-07-17
**Périmètre :** code source (`src/`, `index.html`, `tools/`), configuration de déploiement (`vercel.json`), dépendances (`package.json` / `package-lock.json`).
**Stacks détectées :** JavaScript (React 18 + react-three-fiber, Vite), Python (script Blender local, hors bundle).
**Contexte :** site **100 % statique** (aucun backend, aucune authentification, aucune base de données, aucun cookie/stockage). La surface d'attaque se limite au front servi par Vercel et à l'outillage de développement local.

## Résumé exécutif

| Sévérité | Trouvées | Corrigées dans cette passe |
|---|---|---|
| Critique | 0 | — |
| Haute | 0 | — |
| Moyenne | 3 | **3** ✅ |
| Basse | 1 | **1** ✅ |

**Après remédiation : `npm audit` → 0 vulnérabilité, build et smoke test complets OK.**

Priorités traitées :
1. Montée de Vite 5.4.21 (branche en fin de vie, 2 avis de sécurité) → **Vite 7.3.6** (esbuild 0.28.1).
2. Ajout des **en-têtes de sécurité HTTP** sur Vercel.
3. `window.open` durci avec `noopener,noreferrer`.

## Constats — motifs de code

| # | Sévérité | Titre | Emplacement | Statut |
|---|---|---|---|---|
| 1 | Moyenne | En-têtes de sécurité HTTP absents | `vercel.json` | ✅ corrigé |
| 2 | Basse | `window.open` sans `noopener` | `src/scene/Kitchen.jsx` | ✅ corrigé |

### [MOYENNE] En-têtes de sécurité HTTP absents — ✅ corrigé
- **Catégorie :** A05:2021 Security Misconfiguration
- **Emplacement :** `vercel.json`
- **Description :** seul un en-tête de cache était servi ; pas de `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` ni `Permissions-Policy`.
- **Scénario d'attaque :** sans `X-Frame-Options`, le site peut être encadré dans une iframe tierce (clickjacking sur les liens de contact) ; sans `nosniff`, un navigateur ancien pourrait « deviner » un type MIME.
- **Remédiation appliquée :** ajout dans `vercel.json` de `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Suite recommandée (optionnel) :** une CSP complète (`default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:`) — à valider sur un déploiement de préversion car le décodeur meshopt (WASM) et les styles inline de drei doivent être autorisés explicitement.

### [BASSE] `window.open` sans `noopener` — ✅ corrigé
- **Catégorie :** CWE-1022 (reverse tabnabbing)
- **Emplacement :** `src/scene/Kitchen.jsx` (ouverture du CV)
- **Description :** `window.open(url, '_blank')` donne à l'onglet ouvert une référence `window.opener`. Ici la cible est le propre PDF du site (même origine), l'impact réel est donc quasi nul — corrigé par principe.
- **Remédiation appliquée :** `window.open(url, '_blank', 'noopener,noreferrer')`. Les 8 liens `<a target="_blank">` du projet portaient déjà tous `rel="noreferrer"` ✅.

## Constats — CVE des dépendances

| # | Sévérité | Paquet | Installé (avant) | Avis | Corrigé par |
|---|---|---|---|---|---|
| 1 | Moyenne | vite | 5.4.21 | CVE-2026-39365 / GHSA-4w7w-66w2-5vf9 | **vite 7.3.6** ✅ |
| 2 | Moyenne | esbuild | 0.21.5 (via vite 5) | GHSA-67mh-4wv8-2f99 (CVSS 5.3) | **esbuild 0.28.1** (via vite 7) ✅ |

### [MOYENNE] vite 5.4.21 — CVE-2026-39365 — ✅ corrigé
- **Description :** traversée de chemin via la gestion des fichiers `.map` des dépendances optimisées : des segments `../` non filtrés permettaient de lire des fichiers hors racine du projet, en contournant `server.fs.strict`.
- **Impact réel ici :** **serveur de développement uniquement** (les builds de production ne sont pas concernés), et exploitable seulement si le dev server est exposé au réseau via `--host` — ce qui n'est pas le cas dans ce projet. La branche 5.x étant en fin de vie, aucun correctif 5.4.x n'existait.
- **Versions corrigées :** 6.4.2 / 7.3.2 / 8.0.5 → montée effectuée vers **7.3.6**.
- **Source :** [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)

### [MOYENNE] esbuild ≤ 0.24.2 — GHSA-67mh-4wv8-2f99 — ✅ corrigé
- **Description :** le serveur de développement d'esbuild répondait avec `Access-Control-Allow-Origin: *`, permettant à n'importe quel site web ouvert dans le navigateur du développeur de lire les réponses du dev server (code source, etc.).
- **Impact réel ici :** développement local uniquement ; jamais présent en production.
- **Correction :** esbuild 0.25+ — obtenu automatiquement via la montée Vite 7 (esbuild 0.28.1).
- **Source :** [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)

### Dépendances vérifiées sans avis connu
- **three 0.169.0** — les CVE connues (CVE-2022-0177, CVE-2020-28496) concernent des versions < 0.137 ✅
- **react / react-dom 18.3.1** — les CVE critiques de déc. 2025 (CVE-2025-55182 etc.) ne touchent que les React Server Components (`react-server-dom-*`), absents de ce projet client-only ✅
- **@react-three/fiber 8.18, @react-three/drei 9.122, @react-three/postprocessing, zustand 5, maath** — aucun avis publié trouvé ✅
- **puppeteer-core 25, @gltf-transform/cli 4.4** — devDependencies, outillage local jamais servi ✅

## Points sains notés lors de la revue
- Aucun secret/API key en dur ; pas de fichier `.env` ; `.gitignore` sain.
- Aucun `eval`, `innerHTML`, `dangerouslySetInnerHTML`, stockage navigateur.
- Le `mailto:` du formulaire encode ses paramètres via `encodeURIComponent` (pas d'injection d'en-têtes).
- Les hooks de debug (`window.__sceneStore`, `__scene`, `__cam`) sont conditionnés à `import.meta.env.DEV` → absents du bundle de production.
- `package-lock.json` présent (versions transitives épinglées) ; aucun script `postinstall`.
- Email/téléphone affichés = choix assumé d'un portfolio public.

## Non vérifié / hors périmètre
- Les ~200 dépendances transitives n'ont pas été recherchées une à une (couvertes par `npm audit` → 0 vulnérabilité après montée de Vite).
- La CSP complète n'a pas été activée (voir constat n°1 — à tester sur une préversion Vercel).
- Ce rapport n'est pas un test d'intrusion ; pour du continu, activer **Dependabot** sur le dépôt GitHub.

## Méthodologie
Revue statique selon la checklist OWASP Top 10 (2021) + motifs spécifiques JavaScript/React, `npm audit` sur l'arbre complet, vérification en ligne des avis (GitHub Advisories) pour les dépendances directes, puis **remédiation immédiate et re-test** : `npm audit` → 0 vulnérabilité, `vite build` OK, smoke test Puppeteer de toutes les vues (entrée, 6 zones, détail projet, saisie formulaire, Échap ×2, mode classique) sans aucune erreur console.
