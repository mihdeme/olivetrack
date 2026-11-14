# Phase 4 — Avances, paie du mercredi, paiements partiels et solde de départ

## Principe comptable
- **Gagné** : somme des écritures `worker_earnings.amount_cents` (phase 3).
- **Versé net** : somme des écritures `worker_payments.amount_cents` (positives, moins les contrepassations négatives).
- **Solde restant** : gagné − versé net, calculé en centimes.
- Un solde négatif est possible et signalé : il s'agit d'une **avance à récupérer** ou d'une correction de rémunération à traiter.
- Une avance n'est pas un gain; elle est un versement effectivement effectué. **Elle ne doit pas être ressaisie au moment de la paie hebdomadaire**, sinon elle serait déduite deux fois.
- L'enregistrement de paie est indépendant des paiements du client et de la caisse (phase 5).

## Types de versement
1. `advance` — Avance, même si le solde n'est pas encore positif.
2. `weekly` — Paie hebdomadaire, généralement le mercredi; le jour réel est enregistré.
3. `partial` — Versement partiel hors paie habituelle.
4. `final` — Solde de départ, comptabilisé seulement si l'argent a été remis; archiver ensuite l'ouvrier séparément.

Les versements autres que les avances sont limités au solde positif disponible. Le formulaire affiche les soldes par personne, un bouton « Solde entier » et les versements hebdomadaires enregistrés à la date choisie.

## Corrections auditables
- Les paiements ne sont **ni modifiables ni supprimables** par le navigateur.
- Une erreur est corrigée par `reverse_worker_payment`, qui ajoute une écriture de même montant négatif avec référence à l'écriture d'origine et motif; l'original reste dans l'historique.
- Une contrepassation ne peut pas être contrepassée et un paiement original ne peut être contrepassé qu'une fois.
- Chaque écriture possède un UUID de requête unique : une même requête envoyée deux fois ne crée qu'une seule écriture.
- Une contrepassation est une correction comptable, **pas** un retour physique d'argent. En cas de remise effective de fonds, vérifier les écritures de caisse en phase 5.

## Sécurité
- Table `worker_payments`, RLS de lecture seulement pour l'UID propriétaire.
- Aucun accès anonyme; aucune écriture directe ni `TRUNCATE` donnée aux rôles publics.
- RPC `record_worker_payment` et `reverse_worker_payment` : `SECURITY DEFINER` **intentionnel** et limité à l'UID propriétaire, aux paramètres explicitement validés, avec `search_path = ''` et accès EXECUTE interdit à anon/public.
- Chaque paiement verrouille la ligne de l'ouvrier durant le contrôle de solde.
- Un déclencheur interdit UPDATE et DELETE sur les paiements, même si un droit était accidentellement accordé ultérieurement.
- L'avertissement Supabase sur les RPC `SECURITY DEFINER` est attendu, car le rôle `authenticated` doit pouvoir appeler ces RPC après vérification d'identité. Il ne constitue pas une preuve à lui seul d'une faille; toute modification future des RPC nécessite une nouvelle revue.
- Un avertissement distinct existe sur `Leaked Password Protection Disabled` (réglage Supabase Auth).

## Validation SQL déjà exécutée
Dans une transaction intégralement annulée :
- Un ouvrier fictif gagne 400,00 DH et reçoit une avance de 100,00 DH.
- Deux appels de la même requête d'avance renvoient la même écriture, sans double paiement.
- Une paie du mercredi de 200,00 DH donne 300,00 DH versés et 100,00 DH restant.
- Une tentative de versement supplémentaire de 150,00 DH est refusée.
- L'annulation de l'avance génère une contrepassation de −100,00 DH : 200,00 DH versés nets, 200,00 DH restant.
- Un deuxième essai d'annulation est refusé.
- Toute tentative de suppression directe est refusée.
- Le ROLLBACK conserve les données existantes et élimine les écritures de test.

## Critères de validation sur iPhone
1. Vérifier l'écran Ouvriers → Paies et avances et les soldes initiaux.
2. Sur un ouvrier de test avec des gains, enregistrer une avance de 20,00 DH (uniquement si **réellement versée**, ou avant la campagne avec un protocole de test réversible).
3. Vérifier la réduction du solde, puis la persistance après actualisation.
4. Vérifier le refus d'un paiement non-avance supérieur au solde.
5. Vérifier le journal, la sélection par ouvrier et le total « Paie hebdomadaire » à la date choisie.
6. Tester l'annulation comptable d'une écriture expérimentale et vérifier la contrepassation.
7. Vérifier que le cumul des gains n'a pas été modifié.

**Important : ne jamais valider des versements fictifs sur des comptes réels.** Utiliser un ouvrier de démonstration isolé ou effectuer un test technique sans enregistrement effectif, puis archiver le compte de démonstration. Les historiques d'écritures d'essai restent conservés à dessein.
