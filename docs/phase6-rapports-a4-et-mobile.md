# OliveTrack — Phase 6 : rapports A4 et correctifs iPhone

## Objectif

Le module **Bilans** permet de préparer quatre états imprimables, calculés à partir des données réelles Supabase et datés :
1. **État de paie des ouvriers**, avec colonnes de signature et soldes d'ouverture / gains / versements nets / solde de fin.
2. **Journal de récolte**, avec ouvriers présents, affectations, modes de rémunération, sacs récoltés et gains.
3. **État ventes/acheteurs**, avec soldes antérieurs, ventes, encaissements et soldes de clôture.
4. **Bilan financier**, avec ventes valorisées, encaissements, dépenses et paiements ouvriers.

## Génération depuis l'iPhone

- Choisir un type de rapport, une date de début et une date de fin.
- Toucher **Générer l'aperçu A4**.
- Contrôler l'aperçu et les chiffres.
- Toucher **Imprimer / Enregistrer PDF**.
- Sur iPhone Safari : utiliser l'aperçu d'impression, puis **Partager → Enregistrer dans Fichiers** pour conserver le document PDF A4.

**Limite actuelle :** il s'agit de l'impression native HTML/CSS vers PDF, et non d'un téléchargement de PDF généré par serveur. Les données salariales ne transitent pas vers un service tiers de génération.

## Règles comptables

- **Paie :** le solde initial est la somme des gains antérieurs à la période moins les versements antérieurs ; gains et versements de période sont détaillés séparément ; le solde final les intègre.
- **Récolte :** une présence correspond à une personne un jour donné ; les sacs de chaque groupe ne sont comptés qu'une fois, séparément des livraisons acheteurs. Les rémunérations d'un groupe sont attribuées à ses membres via `worker_earnings`.
- **Acheteurs :** solde d'ouverture = ventes - recettes d'avant la période ; solde final = solde initial + ventes période - encaissements période ; les contrepassations sont prises en compte.
- **Finances :** les ventes valorisées ne sont pas de l'argent reçu ; les paiements ouvriers sont distincts des autres dépenses ; le flux financier net n'est **pas** un solde de caisse d'espèces ou un solde bancaire.
- Toutes les données de rapports sont des **copies de lecture**. Aucun rapport ne crée, modifie ou supprime des transactions.

## Mise en page PDF vérifiée

- Format **A4 portrait** : 210 × 297 mm.
- Zone imprimée jusqu'à 295 mm avec tolérance de 2 mm ; marges latérales 14 mm ; pied de page fixé à 13 mm du bas.
- Couleurs d'impression forcées pour les têtes de tableau et éléments de marque.
- Tableaux à colonnes proportionnées, sauts de page explicites, lignes non fractionnées, 14 lignes maximum par page.
- Pages numérotées, titre, période, date de génération, notes de lecture et en-tête récurrent.
- Colonnes de signature **vierges** (aucune signature inventée).

**Essai de rendu visuel local** : 90 lignes d'ouvriers, noms longs et 7 feuilles A4. Premier rendu constaté avec une coupure de page ; correction du système de cartes et de la géométrie, puis second rendu : **7 pages A4, les 7 pieds de page présents**, aucune ligne de tableau coupée. Le dernier pied de page a ensuite été ancré au bas de la feuille et un nouveau rendu de 7 pages a été validé. Test réalisé avec des noms et montants **synthétiques** et le moteur WeasyPrint ; la validation réelle Safari/iPhone reste indispensable.

## Correctifs de l'interface mobile

Un signalement par capture d'écran montrait :
- Les formulaires du bon de pesée débordant horizontalement des cartes.
- Les onglets glissant dans la zone de la barre de statut iOS.
- Des contrôles de date possédant une largeur intrinsèque excessive.

Correctifs :
- Grilles `minmax(0,1fr)` ; tous les champs et cartes `min-width:0/max-width:100%`.
- Contrôle des champs iOS `date` et enveloppes de contenu.
- Navigation supérieure `sticky` avec `safe-area-inset-top`.
- Onglets horizontaux tactiles et défilement contrôlé.
- Adaptation supplémentaire sur les écrans très étroits.
- Les impressions retirent toutes les commandes et marges d'écran pour ne laisser que l'A4.

## Scénario de validation iPhone avant clôture de phase 6

1. Sur **Caisse → Pesées & ventes**, vérifier que poids, prix, sacs et dates restent **à l'intérieur de leur cadre**.
2. Parcourir les quatre onglets Caisse et défiler sans que le contenu recouvre la barre de statut iOS.
3. Sur **Bilans**, sélectionner chacun des quatre rapports et générer un aperçu.
4. Vérifier l'état de paie avec les salariés, gains, soldes et colonnes de signature **vides**.
5. Vérifier le rapport quotidien et le rapport acheteurs sur la même période.
6. Vérifier le bilan financier : vente ≠ encaissement ; dépense d'exploitation ≠ paiement ouvrier.
7. Imprimer/Enregistrer PDF sur l'iPhone et inspecter les pages A4, notamment les tableaux, dernières lignes, sauts de page, en-têtes et pieds de page.
8. Vérifier que la génération des rapports n'a modifié aucune donnée de campagne.

Le PDF est une **édition de gestion**, pas une preuve de paiement ni une attestation signée avant signature effective.
