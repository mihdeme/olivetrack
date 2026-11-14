# Phase 5 — Ventes d'olives, bons de pesée, encaissements et dépenses

## 1. Modèle métier

### Bon de pesée / livraison
- Une livraison est rattachée à un acheteur, à une date de livraison et à un **poids net en kilogrammes**, enregistré en **grammes entiers**.
- Prix unitaire en **centimes de DH par kilogramme** ; montant total du bon = `ROUND(poids_en_grammes × prix_centimes/kg ÷ 1000)` en centimes, calculé dans PostgreSQL.
- Référence de bon, nombre de sacs et date de récolte **facultatifs**. Un bon peut porter sur plusieurs lots; la date de récolte renseignée est indicative. La correspondance automatique exacte entre sacs des équipes et poids pesé n'est pas encore disponible.
- Un **bon de pesée représente une vente valorisée**, pas un encaissement. Sa création n'ajoute pas d'argent à la caisse.

### Encaissement d'acheteur
- Somme **réellement reçue** en espèces, par banque ou autre moyen ; enregistrée séparément de la vente.
- Solde de l'acheteur = somme de ses bons de vente − somme de ses encaissements.
- Un solde acheteur **négatif** représente une avance/crédit reçu de cet acheteur (encaissement supérieur aux ventes actuellement enregistrées).
- Les encaissements sont rattachés à **l'acheteur**, pas automatiquement ventilés par bon.

### Dépenses d'exploitation
- Transport, carburant, matériel, entretien, repas/ravitaillement, autres charges.
- Les **rémunérations des ouvriers ne sont pas des dépenses à ressaisir** ici : elles sont gérées par les paiements du module Ouvriers (phase 4).
- Pas de rémunération « forfait » dans le registre d'ouvriers.

### Trésorerie
- `Flux financier net = encaissements effectivement reçus − dépenses d'exploitation payées − paiements ouvriers nets`.
- Ce chiffre couvre **tous les moyens de paiement** : ce n'est pas une caisse d'espèces physique, ni le solde du compte bancaire. Les apports de fonds initiaux et transferts non opérationnels ne sont pas enregistrés dans cette version.
- Le « reste à payer aux ouvriers » et le « reste à encaisser des acheteurs » sont des créances/dettes, **pas de l'argent disponible**.

## 2. Historique immuable et correction

- Tables `olives_buyers` (acheteurs modifiables/archivables) et `campaign_ledger` (journal append-only).
- Types de base : `sale`, `receipt`, `expense`. Pour chaque type, une écriture de contrepassation `*_reversal` négative annule exactement le montant d'origine et, pour les ventes, également le poids et le nombre de sacs.
- Une contrepassation référence une écriture d'origine et garde son motif. L'original est conservé.
- Double annulation interdite ; annulation d'une annulation interdite.
- Idempotence par `request_id` UUID unique, protégeant les retries réseau.
- Toutes les validations/écritures sont exécutées de façon atomique dans PostgreSQL.

## 3. Sécurité

- RLS propriétaire unique sur les acheteurs et le journal ; accès anonyme interdit.
- Le journal ne donne **aucun** droit d'INSERT, UPDATE, DELETE ou TRUNCATE au navigateur.
- Les RPCs `record_campaign_entry` et `reverse_campaign_entry` sont délibérément `SECURITY DEFINER` avec `search_path=''`, autorisation `auth.uid()` explicite et EXECUTE non accordé à anon/public.
- Les avertissements « authenticated SECURITY DEFINER » signalés par le linter sont attendus pour les RPCs d'écriture, mais chaque ajout doit conserver la vérification stricte du propriétaire.
- La protection Supabase Auth contre les mots de passe compromis reste une recommandation séparée.

## 4. Tests exécutés

Transaction SQL avec `ROLLBACK`, aucune écriture fictive conservée :
- Vente : 123,450 kg × 8 DH/kg = 987,60 DH ; 8 sacs.
- Un deuxième appel avec le même `request_id` renvoie la même écriture.
- Réutilisation du même UUID avec un prix modifié rejetée.
- Encaissement de 1 200 DH : crédit acheteur possible.
- Annulation de la vente : poids, sacs et montant net reviennent exactement à 0.
- Dépense de transport et contrepassation : solde net de dépense 0.
- Refus de suppression/modification directe, double annulation et annulation d'une annulation.
- Vente arrondie à 0 centime rejetée.
- Un autre UID ne peut pas lire ou enregistrer les opérations.
- Les données existantes (ouvriers, rémunérations, paiements) restent intactes.

## 5. Validation sur iPhone

1. Accéder à l'onglet **Caisse**, vérifier les quatre vues.
2. Créer un acheteur d'essai, puis saisir un bon de pesée avec 123,450 kg à 8 DH/kg : **987,60 DH**.
3. Vérifier que cette vente augmente la valeur vendue et le reste à encaisser, **pas** les encaissements reçus.
4. Enregistrer un **encaissement de test uniquement si réellement reçu**, ou dans un protocole d'essai avec contrepassation ; vérifier le nouveau reste à encaisser.
5. Saisir une dépense seulement si réellement payée, et vérifier qu'elle ne modifie pas les gains des ouvriers.
6. Consulter le **Journal** puis effectuer une correction par contrepassation d'une écriture de test.
7. Vérifier l'accueil et la persistance après actualisation.
8. Vérifier avec plusieurs acheteurs distincts que leurs soldes ne se mélangent pas.

**Ne pas enregistrer de faux encaissements ou dépenses sur des comptes réels.** Utiliser un acheteur de démonstration et une vente de test, puis contrepasser toutes les opérations d'essai. L'historique restera visible, de manière intentionnelle.

## 6. Restant en phase 6 / améliorations futures
- Documents PDF et rapports imprimables, export des tickets et relevés.
- Rapprochement fin des bons de pesée à des groupes/harvest IDs spécifiques si nécessaire.
- Gestion du fonds de caisse initial et rapprochement d'espèces / banque s'il est demandé.
