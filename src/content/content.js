// CONTENT — synchronisé depuis noa-vellat.netlify.app (js/app/content.js).
// La scène 3D est un renderer de plus de ce contenu (voix « Mise en Place »).
export const CONTENT = {
  identity: {
    name: 'Noa Vellat',
    role: 'Développeur Web — Alternance 2025→2027',
    pitch:
      'De la brigade gastronomique au terminal. Épitechien en reconversion, ' +
      'je construis des solutions web rigoureuses, structurées et fiables.',
    dispo: 'Table disponible dès septembre 2026',
    location: 'Lyon, France',
    school: 'Epitech Lyon',
    cvUrl: '/cv.pdf',
  },

  // Un tiroir = un plat signature
  projects: [
    {
      id: 'jeux-videops',
      title: 'Jeux_Videops',
      course: 'Le plat de résistance',
      note: 'Rien ne quitte le passe sans contrôle : lint, tests, audit — puis on envoie.',
      desc:
        'Plateforme de jeux conteneurisée avec pipeline CI/CD complet — linting Google Style, ' +
        'tests unitaires & fonctionnels, npm audit, déploiement Docker automatisé via GitHub Actions.',
      tech: ['Docker', 'GitHub Actions', 'CI/CD', 'Node.js'],
      url: 'https://noavellat.github.io/Jeux_Videops/',
    },
    {
      id: 'klivio',
      title: 'Klivio',
      course: 'Amuse-bouche',
      note: 'Reproduit au gramme près, dressé au cordeau.',
      desc:
        "Reproduction pixel-perfect d'une maquette de plateforme de formations — " +
        'intégration responsive avec Tailwind CSS, animations et interactions fidèles.',
      tech: ['HTML5', 'CSS3', 'Tailwind'],
      url: 'https://noavellat.github.io/Klivio/',
    },
    {
      id: 'my-video-club',
      title: 'My Video Club',
      course: 'Plat mijoté',
      note: 'Mijoté côté serveur, servi sans accroc en salle.',
      desc:
        'Dashboard complet pour un gérant de cinéma — gestion des films, des réservations et du ' +
        "catalogue. Interface admin avec base SQL, back-end PHP et affichage dynamique.",
      tech: ['PHP', 'SQL', 'HTML5', 'CSS3'],
      url: 'https://github.com/NoaVellat',
    },
    {
      id: 'generateur-cv',
      title: 'Générateur de CV',
      course: 'Entrée express',
      note: 'Minute : saisie, aperçu, dressage — prêt en quelques gestes.',
      desc:
        'Application web pour créer son CV en quelques clics — saisie dynamique, ' +
        'aperçu en temps réel et export dans une interface simple et intuitive.',
      tech: ['HTML5', 'CSS3', 'JavaScript'],
      url: 'https://noavellat.github.io/My_CV_generator/',
    },
    {
      id: 'my-notion',
      title: 'My Notion',
      course: 'La signature du chef',
      note: 'Ma pièce de démonstration : base solide, dressage WebGL.',
      desc:
        'Clone minimaliste de Notion — éditeur de blocs riche avec autosave, Kanban en ' +
        'glisser-déposer, gestion des statuts. Next.js 16 (App Router & Server Actions), ' +
        'Prisma/PostgreSQL et fond animé WebGL.',
      tech: ['Next.js 16', 'React 19', 'TypeScript', 'Prisma', 'Three.js'],
      url: 'https://my-notion-pcwl.vercel.app/',
    },
    {
      id: 'core-lab',
      title: 'Core_Lab',
      course: 'Spécialité de la maison',
      note: 'Plat complet, stack MERN, pédagogie servie chaude.',
      desc:
        'Plateforme LMS de formation en ligne développée avec la stack MERN — gestion des cours, ' +
        'des utilisateurs et du suivi pédagogique.',
      tech: ['MongoDB', 'Express', 'React', 'Node.js'],
      url: 'https://github.com/NoaVellat/Core_Lab',
    },
    {
      id: 'portfolio-terminal',
      title: 'Portfolio Terminal',
      course: 'Menu dégustation',
      note: 'Un site, cinq ambiances — la carte change, la maison reste.',
      desc:
        'Mon portfolio « terminal » : cinq ambiances visuelles commutables en un clic ' +
        '(brigade, ingénierie, créatif…), animations matrix, bilingue FR/EN — ' +
        "l'autre salle de la maison, à visiter aussi.",
      tech: ['HTML5', 'CSS3', 'JavaScript'],
      url: 'https://noa-vellat.netlify.app/',
    },
  ],
  projectsCTA: { url: 'https://github.com/NoaVellat', label: 'Voir tous mes projets' },

  // Les Ingrédients — un bac de la saladette par famille (bac = étiquette 3D)
  skills: [
    {
      bac: 'FRONT',
      poste: 'Frontend — garde-manger',
      items: ['HTML5 / CSS3', 'JavaScript ES6+', 'React', 'Tailwind', 'Bootstrap', 'WordPress'],
    },
    {
      bac: 'BACK',
      poste: 'Backend — cuisine chaude',
      items: ['PHP / Laravel', 'Java / Spring Boot', 'SQL / MySQL', 'Node.js', 'API REST'],
    },
    {
      bac: 'DEVOPS',
      poste: 'DevOps & Cloud — le passe',
      items: ['Docker', 'GitHub Actions CI/CD', 'AWS', 'Tests unitaires', 'Linux / Bash', 'Git'],
    },
    {
      bac: 'MERN',
      poste: 'Stack MERN — menu complet',
      items: ['MongoDB', 'Mongoose', 'Express.js', 'React Hooks', 'Node.js', 'REST API'],
    },
    {
      bac: 'SOFT',
      poste: 'Fonds de sauce — transférables',
      items: ['Gestion de la pression', 'Priorisation', 'Travail en brigade', 'Rigueur du dressage', 'Sens du service'],
    },
  ],

  // Le Chef — récit de reconversion
  about: {
    paras: [
      "Mon parcours est atypique : plusieurs années en restauration gastronomique lyonnaise, " +
        "de commis à chef de partie. La brigade m'a forgé — rigueur absolue, gestion sous " +
        "pression, zéro place à l'approximatif.",
      'Aujourd’hui je transpose cette discipline dans le dev. Chaque fonction doit être propre. ' +
        'Chaque pipeline doit être stable. Chaque livraison doit être fiable. Même philosophie, autre outil.',
    ],
    quote: "Un plat raté ne s'envoie pas. Du code cassé ne se déploie pas. L'exigence, c'est la même.",
    tags: ['Rigueur', 'Autonomie', "Esprit d'équipe", 'Adaptabilité', 'Curiosité'],
    // La Brigade — états de service affichés sur le tableau
    timeline: [
      {
        year: '2025 →',
        title: 'Epitech Web Academie',
        sub: 'Alternant Dev Web · Lyon',
        detail: 'HTML/CSS, JS, PHP/Laravel, Java/Spring Boot, Docker, CI/CD, AWS, MERN',
      },
      {
        year: '2024–25',
        title: 'Chef de partie',
        sub: 'Les Cinq Mains · Lyon',
        detail: "Cuisine gastronomique, pâtisserie, gestion d'équipe",
      },
      {
        year: '2023–24',
        title: 'Demi-chef de partie',
        sub: 'Le Théodore · Lyon',
        detail: 'Cuisine avec le Chef Pâtissier, encadrement commis',
      },
      { year: '2020', title: 'Bac Pro TISSEC', sub: 'Institut des Ressources Industrielles · Lyon' },
      { year: '2019', title: 'Bac ES', sub: 'Lycée Colbert · Lyon' },
    ],
  },

  // Réservations
  contact: {
    pitch:
      'Je construis des solutions web rigoureuses et je cherche une équipe pour progresser. ' +
      'Vous avez un projet ou une opportunité ? Parlons-en.',
    email: 'noa.vellat@epitech.eu',
    tel: '06 29 62 66 89',
    telHref: '0629626689',
    github: { url: 'https://github.com/NoaVellat', handle: 'NoaVellat' },
    linkedin: { url: 'https://www.linkedin.com/in/noa-vellat-04594a207/', handle: 'noa-vellat' },
    site: 'https://noa-vellat.netlify.app/',
  },
};
