import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// L'easter egg des easter eggs : le menu du jour, pour ceux qui inspectent.
console.log(
  '%c🍳 LE POSTE — cuisine du chef Noa Vellat',
  'color:#b87333;font-size:16px;font-weight:bold;',
);
console.log(
  '%cVous inspectez ma cuisine ? Bon réflexe.\n' +
    'Au menu des secrets : un laptop sur le plan de travail, une lampe\n' +
    "capricieuse, un canard sous la lampe, la marque de l'imprimante…\n" +
    'Et pour les initiés : ↑ ↑ ↓ ↓ ← → ← → B A — le coup de feu. 🔥',
  'color:#8a8a90;font-size:12px;line-height:1.7;',
);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
