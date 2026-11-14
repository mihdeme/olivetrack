# OliveTrack — Architecture et règles de sécurité (phase 0)

## Périmètre
Application personnelle de gestion de récolte oléicole, utilisable sur smartphone par un seul administrateur.
Saisie des groupes, ouvriers, sacs, pesées, livraisons, avances, salaires, dépenses, encaissements et génération de PDF A4 lisibles.
Aucun stockage de photos de fiches de pesage en V1.

## Architecture retenue
- Dépôt privé GitHub `mihdeme/olivetrack` : code, tests, migrations et documentation.
- Frontend : React + TypeScript, interface mobile et PWA.
- Hébergement statique envisagé : GitHub Pages, sous réserve de confirmation de conformité des conditions d'utilisation avant déploiement ; alternative : hébergeur statique adapté.
- Backend : Supabase (PostgreSQL 17, Auth, fonctions PostgreSQL/RPC).
- Région actuelle : eu-west-1.
- Un seul compte utilisateur autorisé en production, connexion email/mot de passe, sans MFA obligatoire.
- Rapports PDF générés à la demande et non conservés dans Supabase.
- V1 en ligne : pas de promesse de fonctionnement financier hors ligne avant implémentation et essais.

## Principes de données
- Séparer rémunérations acquises et paiements réellement versés.
- Séparer livraisons/ventes et encaissements.
- Enregistrer les tarifs par groupe et par date sans recalcul rétroactif.
- Rémunération actuelle : 100 DH/sac, répartis à parts égales entre membres du groupe.
- Poids réel issu des fiches acheteur ; 75–80 kg/sac sert seulement d'alerte.
- Enregistrer séparément date de récolte, date de livraison, date de pesée et date de paiement.
- Les corrections financières doivent être historisées ; transactions atomiques et identifiants d'opération idempotents.
- Les soldes sont dérivés des écritures vérifiables, et non dupliqués comme source de vérité.

## Sécurité requise
1. RLS obligatoire sur toutes les tables exposées, avec restriction explicite à l'UID autorisé ; aucun accès aux données métier par `anon`.
2. Les clés `service_role` et secrètes ne doivent jamais se trouver dans le dépôt ou dans le frontend.
3. Déployer des fonctions privilégiées uniquement avec nécessité documentée, droits `EXECUTE` limités et contrôles d'identité.
4. Désactiver l'inscription publique si possible ; vérifier la configuration Auth avant mise en production.
5. Validation des montants, protections contre doublons, opérations financières atomiques et journal d'audit.
6. Scripts/migrations versionnés, sauvegardes exportées hors de Supabase et restauration testée.
7. Ne pas utiliser de données réelles avant audit et tests de recette.

## Audit initial du 14 novembre 2026
- Projet Supabase `olivetrack` actif, PostgreSQL 17, région `eu-west-1`.
- Aucune table métier à la date de l'audit.
- Deux avertissements de sécurité liés aux permissions de `public.rls_auto_enable()` corrigés avec :
  `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;`
- Vérification SQL : `anon` = false, `authenticated` = false, `postgres` = true.
- Advisors Supabase sécurité, performance et santé sans alerte lors des vérifications.
- GitHub : dépôt privé, branche `main`, permissions administrateur disponibles.
- Limites de cet audit : configuration fine de Supabase Auth, permissions frontend après création des tables, déploiement, parcours de connexion et tests de pénétration restent à vérifier dans les phases suivantes.

## Portes de validation
Phase 0 : connexions et état initial vérifiés, correctif RLS appliqué, audit sans alerte connue, architecture documentée.
Phase 1 : tests réels d'authentification, d'interdiction des inscriptions publiques et des accès anonymes ; validation du déploiement mobile.
Les phases financières exigeront en plus des tests transactionnels, des rapprochements et des tests de doubles paiements.
