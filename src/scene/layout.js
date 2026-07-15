// Spec dimensionnelle du poste — source de vérité des proportions.
// Les valeurs vivent dans layout.json : lu ici par le front (Vite importe le
// JSON nativement) ET par tools/build_kitchen.py qui génère le modèle Blender.
// Toutes les dimensions en mètres, échelle réelle d'un poste de cuisine pro.
// Origine : centre du poste au sol (y = 0). Face avant du plan à z = +counter.d/2.
//
// Repères : counter h 0.88 + worktop t 0.05 → plan de travail à 0.93 m.
// hood = hotte d'extraction ; saladette = meuble réfrigéré à bacs GN (mise en place).
import layout from './layout.json';

export const LAYOUT = layout;
