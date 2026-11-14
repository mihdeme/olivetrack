# OliveTrack 🌿

Application mobile de gestion de campagne oléicole. Code public ; données d'exploitation privées dans Supabase.

## État du projet
**Phases 1, 2 et 3 validées sur iPhone** : connexion, ouvriers, présences, groupes, sacs et calcul exact des rémunérations. **Phase 4 interface validée sur iPhone** : avances, paies hebdomadaires, versements partiels et soldes de départ, avec historique immuable (premier versement réel encore à valider). **Phase 4.5 en validation** : trois modes de rémunération, recherche, pointage collectif et interface Field Edition. Pesées, ventes, dépenses et caisse générale restent en phase 5.

## Structure
- `src/App.tsx` : connexion et navigation mobile.
- `src/supabase.ts` : client Supabase avec clé **publishable** seulement.
- `src/styles.css` : interface smartphone.
- `src/Phase2.tsx` : registre, présences, affectations aux groupes.
- `src/phase2-data.ts` : opérations Supabase pour les modules de phase 2.
- `supabase/migrations/` : SQL des tables, règles RLS et permissions.
- `src/Phase3.tsx` et `src/phase3-data.ts` : sacs, tarifs, rémunérations calculées en centimes.
- `docs/phase-3-regles-et-tests.md` : calculs et règles de verrouillage historiques.
- `src/Phase4.tsx` et `src/phase4-data.ts` : avances, paiements et soldes par ouvrier.
- `docs/phase-4-paiements-et-tests.md` : règles de journalisation et validations.
- `src/FieldDay.tsx`, `src/HomeEdition.tsx`, `src/field-edition.css` : nouvelle expérience Field Edition, gestion rapide des effectifs et tableau de bord réel.
- `src/phase45-data.ts` : rémunération individuelle, à la journée, et actions groupées.
- `docs/phase-4-5-field-edition.md` : modèle métier, validation et UX.
- `tests/` : contrôles de phases 1–4.5.
- `docs/architecture-securite.md` : décisions de la phase 0.

## Démarrage local
1. Installer Node.js 22 et exécuter `npm install`.
2. Copier `.env.example` vers `.env.local` et ajouter la clé **publishable** du projet Supabase.
3. `npm run dev` puis ouvrir l'adresse affichée.
4. `npm run test` et `npm run build` pour contrôler l'application.

**Ne jamais intégrer de clé `service_role`, de secret Supabase, de mot de passe ou de données de salaires dans le code.**

## Connexion
L'interface accepte uniquement les comptes Supabase Auth existants. Elle n'expose pas de formulaire d'inscription. **Ce n'est pas suffisant pour interdire les inscriptions par l'API** : le réglage d'inscription doit aussi être désactivé dans Supabase Auth, et les autorisations métier devront être garanties par RLS et une liste stricte des utilisateurs autorisés avant toute mise en production.

## Utilisation — phase 2
1. Onglet **Ouvriers** : ajouter le nom de chaque personne ; téléphone et remarques facultatifs. La recherche et les panneaux contextuels simplifient la gestion de dizaines de personnes.
2. Archiver une personne qui part : son identité et ses anciennes présences restent conservées. La réactiver si elle revient.
3. Onglet **Récolte** : choisir une date ; les sections Pointage / Groupes / Gains permettent de pointer en masse, d'affecter plusieurs personnes et de saisir les trois modes de rémunération.
4. Une personne ne peut avoir qu'une seule présence par date et ne peut donc appartenir qu'à un seul groupe ce jour-là.
5. **Modes de rémunération :** collectif au sac, individuel au sac (ouvrier sans groupe) ou à la journée (ouvrier sans groupe). Aucun forfait : les autres charges seront enregistrées en dépenses à la phase 5.
6. Une fois des gains enregistrés, les affectations correspondantes sont verrouillées. Pour changer les membres ou le mode de rémunération, remettre d'abord les gains de la journée à zéro, modifier l'affectation, puis ressaisir les montants.
7. Dans **Ouvriers → Paies et avances**, sélectionner un ouvrier, saisir le montant effectivement remis, la date et le type (avance / paie du mercredi / partiel / solde de départ), puis confirmer.
8. La rémunération gagnée n'est **pas** le paiement effectué. Le solde = gagné − sommes effectivement versées. Une avance peut créer un solde négatif temporaire.
9. Une erreur de paiement se corrige par **contrepassation** : l'original reste dans l'historique. Ne jamais enregistrer une sortie d'argent fictive sur le compte d'un véritable ouvrier.

## Hébergement
Le code est public sur GitHub et OliveTrack est disponible sur https://mihdeme.github.io/olivetrack/ . Les données restent privées via Supabase Auth et RLS. La compatibilité des conditions d'utilisation de GitHub Pages avec l'exploitation de l'outil doit être revue avant une utilisation commerciale régulière.

## Configuration
- Connexion Supabase Auth configurée pour le propriétaire ; inscriptions publiques désactivées.
- Variables de repository GitHub Actions : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_OWNER_USER_ID`.
- Chaque modification fusionnée dans `main` déclenche les contrôles et le déploiement Pages.
- Ne jamais saisir de faux paiements sur de véritables comptes ouvriers pour tester l'application.
