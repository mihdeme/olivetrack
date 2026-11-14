# Phase 4.5 — Correction ergonomique des statuts quotidiens

## Problème signalé
Le changement d'un ouvrier « à la journée » ou « individuel au sac » vers un groupe ou une absence provoquait :
> Rémunération individuelle enregistrée : remettez-la à zéro avant de modifier la présence.

La contrainte de base était correcte contre les doublons, mais le parcours obligeait à naviguer entre plusieurs écrans.

## Nouveau parcours
Dans **Récolte → Pointage**, toucher le nom ou l'icône crayon d'un ouvrier.
Dans **Récolte → Groupes**, toucher le groupe / l'action modifier.
Dans **Récolte → Gains**, toucher la fiche d'une personne sans groupe.

Un panneau unique propose :
- Absent
- Présent, sans rémunération
- Collectif au sac, avec sélection du groupe
- À la journée (tarif en DH)
- Individuel au sac (quantité et tarif)

La confirmation affiche l'ancien / nouveau statut et les conséquences sur les gains individuels. Une seule opération `change_worker_day_status` met à jour l'affectation et la rémunération de façon atomique.

## Protections préservées
- Le changement depuis ou vers un groupe **déjà comptabilisé** reste interdit sans correction préalable des sacs du groupe, car il modifierait la rémunération de tous ses membres.
- Aucune écriture de paiement n'est modifiée ; le solde net est recalculé à partir des gains acquis.
- Le changement d'un mode individuel à un autre ne laisse jamais deux écritures pour le même ouvrier et la même journée.
- Les données existantes et l'historique des paiements sont préservés.
- L'opération exige le bon UID Supabase, et les droits RPC sont refusés à `anon`.

## Vérifications réalisées
Tests SQL avec `ROLLBACK` :
- Présent à la journée 120 DH → 3 sacs individuels × 100 DH → dans un groupe → à la journée 125 DH → absent → présent sans groupe.
- Les anciennes écritures individuelles sont remplacées et jamais dupliquées.
- Un groupe avec sacs comptabilisés refuse le déplacement et ne perd ni présence ni gain.
- Appel avec un autre UID refusé.

Tests GitHub Actions : TypeScript + suite de tests frontend et métier.

## Test iPhone
1. Sur une journée de test, choisir un ouvrier présent rémunéré à la journée et toucher son nom dans Pointage.
2. Changer en « Individuel au sac », renseigner quantité et tarif, puis confirmer.
3. Dans Groupes, choisir le même ouvrier et le déplacer directement dans un groupe sans récolte valorisée ; constater que le gain individuel est automatiquement retiré.
4. Passer de ce groupe à « À la journée », sans effectuer de remise à zéro manuelle.
5. Vérifier le recalcul des gains et du solde, puis actualiser.
6. Contrôler qu'une affectation touchant un groupe aux sacs déjà enregistrés reste protégée et affiche une consigne explicite.
