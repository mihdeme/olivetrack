# OliveTrack 🌿

Application mobile de gestion de campagne oléicole (projet privé).

## État du projet
**Phase 1 en cours** : fondations React, authentification Supabase et navigation responsive. Les modules métier ne sont pas encore implémentés ; aucune donnée de récolte réelle ne doit être saisie.

## Structure
- `src/App.tsx` : connexion et navigation mobile.
- `src/supabase.ts` : client Supabase avec clé **publishable** seulement.
- `src/styles.css` : interface smartphone.
- `tests/` : vérifications initiales.
- `docs/architecture-securite.md` : décisions de la phase 0.

## Démarrage local
1. Installer Node.js 22 et exécuter `npm install`.
2. Copier `.env.example` vers `.env.local` et ajouter la clé **publishable** du projet Supabase.
3. `npm run dev` puis ouvrir l'adresse affichée.
4. `npm run test` et `npm run build` pour contrôler l'application.

**Ne jamais intégrer de clé `service_role`, de secret Supabase, de mot de passe ou de données de salaires dans le code.**

## Connexion
L'interface accepte uniquement les comptes Supabase Auth existants. Elle n'expose pas de formulaire d'inscription. **Ce n'est pas suffisant pour interdire les inscriptions par l'API** : le réglage d'inscription doit aussi être désactivé dans Supabase Auth, et les autorisations métier devront être garanties par RLS et une liste stricte des utilisateurs autorisés avant toute mise en production.

## Hébergement
Le code reste privé sur GitHub. GitHub Pages sur dépôt privé exige un plan GitHub payant éligible ; de plus, il faut vérifier les conditions d'utilisation pour une application de gestion commerciale. Le déploiement public n'est **pas activé** à ce stade. Une plateforme statique adaptée pourra héberger la même application.

## Configuration en attente
- Créer le compte administrateur Supabase Auth depuis le tableau de bord (sans transmettre les identifiants).
- Désactiver les inscriptions publiques dans le dashboard Supabase.
- Configurer les variables publiques de build sur la plateforme de déploiement choisie.
- Vérifier l'authentification réelle depuis un téléphone et confirmer la fermeture de la phase 1.
