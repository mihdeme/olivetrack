# Phase 3 — Sacs et rémunérations (acquisition, pas paiement)

## Règles métier
- Chaque groupe récolte un nombre entier de sacs pour une journée de travail, à son propre tarif par sac (valeur initiale **100,00 DH**).
- Tarif conservé sur la récolte; modifier le tarif plus tard ne réécrit pas les anciennes journées.
- Montant total = sacs × tarif, calculé en **centimes entiers** PostgreSQL, jamais en nombres flottants.
- Les ouvriers affectés au groupe ce jour-là se partagent le total à parts égales.
- Les centimes résiduels sont distribués déterministiquement (tri par UUID) : la somme des parts est **exactement** égale au coût du groupe.
- Une personne peut figurer dans plusieurs groupes à des dates différentes, mais dans un seul groupe par jour (contrainte phase 2).
- Aucune ligne `worker_earnings` n'est un décaissement : avances, paiements et balances arrivent en phase 4.

## Historique et corrections
- Une récolte est identifiée par `group_id`; un groupe n'a donc qu'une saisie de sacs pour la journée.
- Enregistrer une récolte **verrouille les membres du groupe**. Les changements de membre sont refusés par un trigger PostgreSQL, même s'ils contournent le navigateur.
- Pour corriger la composition : **mettre les sacs à 0** (suppression explicite des écritures du groupe), corriger les présents, ressaisir les sacs et le tarif.
- Pour corriger seulement les sacs ou le tarif : la RPC réécrit les parts dans **une transaction atomique**. L'interface demande confirmation.
- Les rémunérations précédentes restent enregistrées si l'ouvrier est archivé ou réactivé.

## Sécurité
- `group_harvests` et `worker_earnings` : **RLS de lecture propriétaire unique**.
- Aucune permission d'écriture, suppression ni TRUNCATE n'est donnée directement aux rôles navigateur.
- `save_group_harvest` est une RPC `SECURITY DEFINER` **intentionnelle**, accessible uniquement au rôle `authenticated`, contrôlant strictement l'UID du propriétaire et toutes les données.
- `search_path = ''`, qualification explicite des tables et `REVOKE ... FROM PUBLIC,anon`.
- Le linter peut émettre un avertissement pour cette RPC privilégiée : il ne faut pas le masquer sans conserver l'atomicité et les autorisations fortes. Réauditer lors de la phase 4.
- Supabase Auth : l'avertissement indépendant `Leaked Password Protection Disabled` subsiste dans les réglages Auth.

## Tests vérifiés côté base
- Répartition 100,00 DH sur trois personnes : 33,34 + 33,33 + 33,33 DH (tri déterministe).
- Correction 2 sacs × 125,00 DH = 250,00 DH distribués exactement.
- Refus de retrait / changement d'un membre d'un groupe verrouillé.
- Remise à zéro : suppression des parts et déverrouillage du groupe.
- Tests sous transaction `ROLLBACK` : aucune donnée de test conservée.
- Aucun accès anonyme à la RPC ; aucune écriture directe des gains par le navigateur.

## Validation téléphone avant clôture phase 3
1. Onglet Récolte, choisir une journée et un groupe avec plusieurs ouvriers.
2. Enregistrer 1 sac à 100 DH, vérifier le coût total et les parts exactes.
3. Actualiser et constater la persistance.
4. Vérifier les gains cumulés dans Ouvriers.
5. Vérifier le verrouillage de la composition; mettre les sacs à 0 puis modifier le groupe.
6. Corriger tarif / nombre de sacs et confirmer la recomposition.
7. Vérifier qu'aucun paiement n'est affiché comme effectué.
