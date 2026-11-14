# OliveTrack — Phase 7 : audit de sécurité, fiabilité et lancement

Date de contrôle : 14 novembre 2026. Branche : `phase-7-security-audit-hardening`.

## Décision de mise en service

**Prêt pour une recette terrain contrôlée, pas encore pour un feu vert de production sans réserve.** L'application fonctionne sur iPhone et les phases précédentes ont été vérifiées. Les contrôles SQL de phase 7 sont passés. Les risques résiduels ci-dessous doivent être compris et arbitrés par le propriétaire.

### Résultats vérifiés

| Contrôle | Résultat |
| --- | --- |
| Projet Supabase | ACTIVE_HEALTHY au moment de l'audit, PostgreSQL 17.11 |
| RLS sur les tables | 10 / 10 tables publiques activées |
| Lecture anonyme sur tables métier | Refusée sur toutes les tables |
| TRUNCATE depuis authenticated | Refusé sur toutes les tables |
| DELETE direct sur les journaux financiers | Refusé |
| INSERT direct sur les journaux financiers | Refusé |
| Fonctions d'écriture RPC | 8 fonctions SECURITY DEFINER explicitement appelables par authenticated, vérifiant l'UID propriétaire |
| Exécution des RPC métier par anon | Refusée |
| Présences sans journée | 0 |
| Rémunération individuelle et groupe simultanés | 0 |
| Rémunération individuelle sans présence | 0 |
| Contrepassations de vente incohérentes | 0 |
| Contrepassations de paie incohérentes | 0 |
| Scénarios 90 ouvriers, rémunération et opérations en masse | SQL ROLLBACK exécutés avec succès lors des phases précédentes |
| Tests GitHub / publication Pages | Vérifier les nouveaux runs sur `main` après fusion |

**Important :** une vérification ponctuelle de l'intégrité n'est pas un substitut à un audit de restauration, d'intrusion ou de conformité juridique indépendant.

### Correctifs phase 7

1. **Historique des gains cumulés** : la lecture non paginée de `worker_earnings` ne pouvait pas garantir l'exhaustivité au-delà de la limite courante de 1 000 résultats de PostgREST. Le code est désormais paginé par lots de 500 avec ordre stable de clé composite, pour éviter des totaux tronqués en fin de saison.
2. **Export propriétaire** : module `Bilans → Copie de sauvegarde`, lecture des **dix tables métier complètes** (colonnes conservées), pagination et téléchargement JSON direct depuis le navigateur, sans mutation SQL.
3. **Ergonomie et confidentialité de l'export** : panneau replié par défaut ; consentement explicite ; message indiquant que le fichier est **non chiffré** et contient identités, téléphones, revenus, paiements et transactions.

### Vérification d'un export JSON

Depuis l'iPhone : **Bilans → Copie de sauvegarde → Exporter mes données (.json)**.
Ensuite : dans l'app **Fichiers**, vérifier le nom `olivetrack-sauvegarde-AAAA-MM-JJ.json`, et ouvrir avec une application de lecture JSON de confiance si nécessaire. Le fichier doit comporter `schema: olivetrack-export-v1`, `exported_at`, `row_counts` et `tables`. Vérifier que `tables` contient les dix noms, et que les comptes de lignes correspondent aux tableaux de l'application.

Attention : ce fichier contient des données personnelles et financières **en clair**. Le placer uniquement dans un stockage privé protégé. Ne pas envoyer ce fichier dans des messageries publiques ni à des tiers. Une sauvegarde JSON est utile pour vérifier et récupérer les données manuellement, mais **ce n'est pas une restauration automatisée testée**. Il faut également vérifier les sauvegardes natives disponibles dans le plan Supabase et documenter la procédure de récupération.

### Risques résiduels et arbitrages

**P1 — Protection des comptes**. L'avis de sécurité Supabase `auth_leaked_password_protection` signale que la détection des mots de passe compromis est désactivée. La documentation Supabase indique que cette option est disponible sur l'offre **Supabase Pro et au-dessus** : https://supabase.com/docs/guides/auth/password-security . Vérifier le plan, activer la protection si accessible, imposer un mot de passe long et unique et envisager MFA. Cette action appartient aux réglages Auth du propriétaire, pas au code JavaScript.

**P1 — Restauration non éprouvée**. L'export JSON ne garantit pas la reprise complète après panne. Avant d'utiliser OliveTrack comme unique registre, vérifier qu'une sauvegarde distante Supabase existe et tester la restauration sur un environnement isolé approprié, sans écraser les vraies données.

**P2 — Connexion Internet nécessaire**. OliveTrack n'a pas de file d'attente hors ligne ni de synchronisation différée. Ne pas supposer qu'une présence ou un paiement est enregistré si le réseau tombe. Attendre la confirmation à l'écran et rouvrir la date/journal pour vérifier avant de resaisir. Un filet de secours papier reste conseillé pour la récolte.

**P2 — Fonctionnalités financières à comprendre**. Les avances des ouvriers peuvent donner un solde négatif. Le flux financier net est `encaissements - dépenses - paiements ouvriers`, ce n'est pas le solde physique des espèces. Un bon de pesée valorise une vente ; il ne prouve pas que l'acheteur a payé. Les contrepassations corrigent les écritures mais ne prouvent pas la remise/récupération d'espèces.

**P2 — Fonctions privilégiées exposées**. Huit RPC en `public` sont `SECURITY DEFINER` avec `EXECUTE` pour le rôle `authenticated`. Cela explique les avertissements du linter ; leur logique inclut des vérifications d'UID propriétaire, une validation des entrées, et le refus à `anon`. Tout ajout/modification ultérieur impose une revue des contrôles d'accès, et une réduction de surface API serait une amélioration souhaitable.

**P3 — Portée de l'audit**. Tests applicatifs et SQL + inspections de rendu PDF de phase 6 sont validés ; pas de test indépendant d'intrusion, d'exercice de restauration ni de preuve de fonctionnement réel hors ligne. Le premier paiement réel depuis l'iPhone reste le point de recette métier de phase 4 à confirmer quand l'occasion se présente.

### Check-list de mise en route terrain

1. Tester les cinq onglets sur iPhone avec connexion mobile.
2. Créer une **copie de sauvegarde** et vérifier la présence du fichier dans Fichiers ; confirmer que les comptes de lignes sont cohérents.
3. Vérifier les données réelles déjà enregistrées et les soldes ouvriers/acheteurs.
4. Confirmer que la commande d'impression des rapports A4 fonctionne comme testé en phase 6.
5. Tester la procédure de correction sans modifier des paiements réels.
6. Vérifier les options d'authentification et sauvegarde dans Supabase (notamment mot de passe compromis, MFA et reprise).
7. Préparer une solution papier en cas d'absence de réseau.
8. Après la première paie réelle, rapprocher la somme effectivement remise, le registre de paie et l'écriture de paiement.

### Routine de fin de journée

- Contrôler nombre de présents, groupes, sacs, rémunérations et cohérence des soldes.
- Vérifier les bons du collecteur, l'argent reçu et les dépenses réellement payées.
- Vérifier les écritures de caisse et corriger les erreurs par contrepassation motivée.
- Faire un export privé périodique ; ne pas multiplier des copies en clair non protégées.

**Aucune opération de migration destructive, aucun effacement et aucune écriture financière de test ne sont nécessaires pour cette phase 7.**
