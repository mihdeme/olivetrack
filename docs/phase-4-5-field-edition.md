# OliveTrack — phase 4.5 « Field Edition »

## Périmètre métier validé
**Trois modes seulement** :
- **Collectif au sac** : groupe du jour, tarif et quantité de sacs, montant équitable réparti au centime par la RPC existante `save_group_harvest`.
- **Individuel au sac** : présent sans groupe, nombre de sacs et tarif individuels, montant direct.
- **À la journée** : présent sans groupe, un tarif journalier qui correspond à une journée complète.

Aucun mode **forfait** : transport, entretien et autres charges sont des **dépenses hors paie** (phase 5). Le mode est défini **par personne et par jour**, pas définitivement dans la fiche de l'ouvrier.

Un même ouvrier ne reçoit pas simultanément une rémunération collective et individuelle le même jour ; il faut remettre la rémunération à zéro avant de déplacer la personne. Les gains historiques de groupes, les paiements et les fiches ne sont pas migrés ou réécrits.

### Calcul du compte
Gains acquis = anciennes parts collectives `worker_earnings` + nouvelles parts individuelles `worker_day_compensations`. Le paiement net est la somme du journal `worker_payments`, contrepassations incluses. Solde = acquis − payé net.

Les RPC d'avance et de paiement valident désormais le solde en additionnant **les deux sources** de gains. Les écritures de paiement restent immuables.

### Intégrité et sécurité
- RLS de lecture propriétaire sur la nouvelle table; aucun accès public/anonyme, pas d'insert direct via client.
- `save_individual_compensation` est une RPC privilégiée à UID strict, transactionnelle, verrouillant l'ouvrier et son enregistrement de présence avant la modification.
- La présence est obligatoire et le groupe doit être vide pour ajouter une rémunération individuelle.
- Le trigger `protect_individual_compensation` empêche de retirer ou d'affecter au collectif un ouvrier dont la rémunération individuelle existe.
- Le trigger de phase 3 reste actif et empêche de changer un groupe dont la récolte est enregistrée.
- `bulk_attendance` exécute des actions sur 1 à 100 ouvriers en une transaction, avec contrôles de propriétaire et validation des références.

## Refonte mobile
Le skill Frontend Design (https://agenticskills.io/skills/frontend-design) a servi de référence : direction esthétique intentionnelle, hiérarchie éditoriale, typographie contrastée, couleurs olive/pierre, animations sobres et espaces denses utilisés à bon escient.

- Accueil avec **vraies données** : ouvriers actifs, sacs collectifs + individuels, gains et solde.
- Récolte/« Journée » : date, indicateurs, **Pointage / Groupes / Gains**.
- Recherche rapide, filtres Présents/Absents/Sans groupe et **sélection multiple** avec action collective.
- Saisie des rémunérations individuelles dans un panneau contextuel inférieur, sans rallonger la page.
- Registre searchable avec modification dans un panneau, navigation Ouvriers / Paies conservée.
- Interface responsive, zones tactiles agrandies, réduction des mouvements si préférence système.

## Tests de validation effectués
Transaction SQL **ROLLBACK** :
1. Un salarié fictif payé 120,00 DH à la journée.
2. Mode individuel changé à 3 sacs × 100,00 DH = 300,00 DH.
3. Refus d'affecter ce salarié à un groupe avant annulation de sa rémunération.
4. Refus de suppression de sa présence alors qu'une rémunération existe.
5. Paie possible sur les gains individuels, surpaiement refusé.
6. Réinitialisation à zéro puis affectation au collectif autorisée.
7. Test synthétique **90 ouvriers**, pointage en masse, affectation de 50 ouvriers, 100 sacs à 100 DH répartis exactement, refus de modification d'un groupe valorisé.
8. Aucun ouvrier ni paiement synthétique conservé après ROLLBACK.

## Critères d'acceptation iPhone
1. Registre : recherche de noms, ajout et modification via panneau.
2. Récolte : changement de date, pointage rapide, filtres et recherche.
3. Sélection multiple et affectation d'un groupe (tester 2–5 ouvriers réels, ne pas inventer des paiements).
4. Sans groupe : mode journée, puis individuel au sac ; vérifier exactitude et persistance.
5. Vérifier l'impossibilité d'affecter au collectif un ouvrier déjà rémunéré individuellement.
6. Remettre la rémunération individuelle à zéro puis affecter au collectif.
7. Vérifier les **gains cumulés**, soldes et paiements existants.
8. Confirmer l'affichage des vraies données dans l'accueil et la fluidité des interactions avec les effectifs existants.

**Phase 5 non commencée.** Les autres dépenses, les clients, les pesées et la trésorerie restent à développer.
