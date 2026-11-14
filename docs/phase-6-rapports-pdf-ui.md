# Phase 6 — Rapports PDF et correctifs de débordement iPhone

## Documents
L’onglet **Bilans** génère quatre PDF à partir des données Supabase accessibles au propriétaire :

1. **Feuille de paie et émargement — A4 paysage** : ouvriers, gains de la période, avances de la période, versements nets de la période, solde cumulé **à la date de fin**, et une colonne physique de signature (lignes guides). Les contrepassations sont prises en compte.
2. **Rapport journalier de récolte — A4 portrait** : effectif réellement présent, quantités de sacs par groupes et individuels, détails de rémunération et des présences (y compris travailleurs sans gain).
3. **Ventes et encaissements — A4 portrait** : ventes/encaissements sur la période, créance cumulée par acheteur à la date de fin, bons détaillés (poids, prix, références) et versements reçus. Un bon ne constitue **jamais** une entrée de trésorerie.
4. **Bilan financier — A4 portrait** : ventes valorisées, encaissements, sorties de trésorerie, salaires réellement payés, restes à encaisser et à payer cumulés à la date de fin, dépenses par catégorie et livre des opérations.

Les rapports périodiques offrent « Ce mois », « Toute la campagne » et une plage personnalisée. Le rapport de récolte se fait pour une **date**. Les documents sont générés depuis une photographie en lecture seule des écritures existantes ; aucune table ni opération financière n’est modifiée par l’export.

## Moteur PDF
- `src/report-pdf.ts` génère de véritables PDF vectoriels, pas des captures d’écran ni des pages HTML tronquées.
- Les formats sont en **points PDF** : A4 portrait **595 × 842 pt** ; paysage **842 × 595 pt**. Marges régulières (42 / 38 pt), titre, sous-titre, période, indicateurs sobres et pied de page.
- Lignes de tableaux recalculées selon la longueur du contenu, texte limité avec ellipsis pour les cellules excessivement longues, en-têtes multi-lignes et **répétés à chaque nouvelle page**.
- Numérotation « Page n / N ». Zone de signature d’environ 30 pt de haut sur la feuille de paie.
- Encodage **WinAnsi** des textes en Helvetica : accents français, apostrophes et tirets typographiques usuels pris en charge. Les scripts hors WinAnsi (ex. noms entièrement en arabe) ne sont pas encore incorporés ; à traiter avec un moteur Unicode avant le lancement si de tels caractères sont utilisés.
- Aucun accès à une API extérieure pour créer les documents, aucune police ou binaire à télécharger. Tous les calculs métier restent en centimes et grammes.
- L’app privilégie la feuille de partage native d’iOS pour enregistrer ou imprimer les PDF, et utilise le téléchargement `Blob` en solution de repli.
- Les fichiers téléchargés sont des documents sensibles contenant salaires, noms et montants : sauvegarde dans Fichiers ou partage avec prudence.

## Correctifs iPhone
Le formulaire **Caisse / Pesées & ventes** de la capture du 14 novembre 2026 présentait des champs étendus au-delà de la carte :
- Remplacement de grilles `1fr 1fr` par `minmax(0,1fr)` et contraintes explicites sur `input/select/textarea`.
- La ligne « sacs livrés / date de récolte » passe à **une colonne sur iPhone**, pour laisser le date-picker iOS afficher intégralement sa valeur.
- Les **quatre sous-onglets de Caisse** forment une grille 2 × 2 sur petit écran plutôt que de déborder horizontalement.
- Contrainte de largeur de toutes les cartes, ligne de totaux et entêtes ; texte long autorisé à passer à la ligne.
- Barre d’en-tête collante (sticky) avec `safe-area-inset-top` et navigation basse avec `safe-area-inset-bottom`.
- Les champs de période de Bilans passent à **une colonne** sur petits écrans, évitant le même problème iOS.

## Vérifications automatisées
`tests/phase6-pdf.test.mjs` vérifie :
- La génération réelle d’un document PDF A4 paysage comprenant **90 ouvriers synthétiques**, sur plusieurs pages.
- Des pointeurs `xref` cohérents et une fin de fichier PDF valide, ainsi que les accents/ponctuations WinAnsi.
- Un document portrait même en l’absence de données.
- L’intégration des quatre rapports, l’export PDF, et les règles CSS anti-débordement iPhone.
- Le code TypeScript et Vite sont validés dans GitHub Actions.

Un petit PDF synthétique a aussi été rendu en PNG pour contrôler visuellement l’identité du document (titre, indicateurs, marges, palette). Ce contrôle ne remplace pas la revue du rendu iOS réel pour des noms de longueur exceptionnelle ou des scripts non latins.

## Protocole de validation iPhone (sans modifications financières)
1. Ouvrir **Caisse / Pesées & ventes** : les quatre onglets, champs poids/prix, dates, cartes et bouton ne doivent plus dépasser du viewport (aucun scroll horizontal).
2. Dans **Bilans**, ouvrir les quatre rapports proposés et vérifier leurs formats et filtres.
3. Exporter la **feuille de paie** au format **A4 paysage**, vérifier colonnes, signatures, date, pagination et noms ; inspecter plusieurs pages si longue liste.
4. Exporter la **récolte journalière** pour une date déjà pointée.
5. Exporter **ventes/encaissements** et **bilan financier** ; vérifier que les montants réellement encaissés ne se confondent pas avec les ventes.
6. Ouvrir un PDF depuis Fichiers sur iPhone, utiliser le partage/impression et vérifier le résultat sur toute une page A4, sans texte tronqué.
7. Vérifier la persistance des données ; aucun bouton d’export ne doit modifier les soldes.

**Limites connues** : les frais d'ouverture de caisse ne sont pas encore enregistrés ; le flux financier net global n'est pas le solde physique des espèces, et il n'y a pas de rapprochement automatique de chaque bon à un groupe précis.
