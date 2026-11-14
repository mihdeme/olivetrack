# OliveTrack 🌿

Application mobile de gestion de campagne oléicole (projet privé).

## État du projet
**Phase 1 validée côté téléphone** : application mobile accessible et authentification Supabase fonctionnelle. **Phase 2 en développement** : registre durable des ouvriers, présences quotidiennes, groupes par jour. Les sacs, salaires, pesées et finances ne sont pas encore implémentés.

## Structure
- `src/App.tsx` : connexion et navigation mobile.
- `src/supabase.ts` : client Supabase avec clé **publishable** seulement.
- `src/styles.css` : interface smartphone.
- `src/Phase2.tsx` : registre, présences, affectations aux groupes.
- `src/phase2-data.ts` : opérations Supabase pour les modules de phase 2.
- `supabase/migrations/` : SQL des tables, règles RLS et permissions.
- `tests/` : vérifications initiales et contrôles de phase 2.
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
1. Onglet **Ouvriers** : ajouter le nom de chaque personne ; téléphone et remarques facultatifs.
2. Archiver une personne qui part : son identité et ses anciennes présences restent conservées. La réactiver si elle revient.
3. Onglet **Récolte** : choisir une date, créer les groupes du jour, cocher les personnes présentes, puis choisir le groupe de chacune.
4. Une personne ne peut avoir qu'une seule présence par date et ne peut donc appartenir qu'à un seul groupe ce jour-là.
5. Aucun salaire, sac ou poids n'est encore calculé. Ces fonctions arriveront dans les phases suivantes.

## Hébergement
Le code reste privé sur GitHub. GitHub Pages sur dépôt privé exige un plan GitHub payant éligible ; de plus, il faut vérifier les conditions d'utilisation pour une application de gestion commerciale. Le déploiement public n'est **pas activé** à ce stade. Une plateforme statique adaptée pourra héberger la même application.

## Configuration en attente
- Créer le compte administrateur Supabase Auth depuis le tableau de bord (sans transmettre les identifiants).
- Désactiver les inscriptions publiques dans le dashboard Supabase.
- Configurer les variables publiques de build sur la plateforme de déploiement choisie.
- Vérifier l'authentification réelle depuis un téléphone et confirmer la fermeture de la phase 1.
