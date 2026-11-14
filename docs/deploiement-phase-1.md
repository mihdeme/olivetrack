# Phase 1 — Publication et déploiement (contrôle préalable)

## État du socle
- React / Vite / TypeScript, interface mobile responsive, onglets et formulaire de connexion.
- Supabase Auth : connexion email/mot de passe et contrôle **UI** de l'UID autorisé.
- Supabase DB métier : aucune table, donc aucune donnée de campagne exposée.
- Supabase Auth : compte administrateur existant et confirmé ; fermeture des inscriptions publiques déclarée par le propriétaire dans son tableau de bord (pas de lecture directe de ce réglage avec les outils actuels).
- Tests unitaires de fondation et compilation de production via GitHub Actions.
- Pas encore de validation de la connexion réelle sur iPhone.

## Avant de rendre le dépôt public
- Réviser le code ET l'historique Git du dépôt : aucun mot de passe / secret / données nominatives.
- Seules les clés *publishable* Supabase peuvent être utilisées dans le navigateur. **Jamais** de clé `service_role` ou `sb_secret_` !
- Les données métier à venir devront être protégées **par RLS et des opérations SQL/RPC**, jamais uniquement par l'UID vérifié dans React.
- La publication rend immédiatement tout code, historique et future modification du dépôt accessibles au public. Ne pas committer de secrets, même temporairement.

## Paramètres GitHub pour déploiement Pages
1. Avec le projet déjà fusionné dans `main`, rendre le dépôt **Public** via Settings → General → Danger Zone → Change repository visibility si tel est le choix final.
2. Settings → Secrets and variables → Actions → **Variables**, ajouter exactement :
   - `VITE_SUPABASE_URL` : URL publique du projet Supabase ;
   - `VITE_SUPABASE_PUBLISHABLE_KEY` : clé **publishable**, jamais une clé secrète ;
   - `VITE_OWNER_USER_ID` : UUID de l'unique utilisateur autorisé dans Supabase Auth.
3. Settings → Pages → Build and deployment → **GitHub Actions**.
4. Actions → `Deploy OliveTrack to GitHub Pages` → **Run workflow** (déploiement **manuel** pour le premier lancement).
5. Lire le journal Actions : `Validate public frontend settings`, `npm ci`, tests, build, Pages Deploy doivent réussir.
6. Ouvrir le site sur le téléphone. Vérifier que la page de connexion fonctionne, que la session persiste après rechargement, que la déconnexion fonctionne et qu'un compte non autorisé n'accède pas à l'application.
7. Vérifier que l'inscription publique Supabase est bien désactivée et que les futures tables n'exposent aucune donnée via API sans RLS.

**Note sur les conditions d'utilisation GitHub Pages** : GitHub Pages n'est pas destiné à l'hébergement gratuit d'un service commercial en ligne ou d'un site principalement dédié aux transactions commerciales et n'est pas recommandé pour des transactions sensibles telles que les mots de passe. Pour un outil privé de gestion de récolte, vérifier l'adéquation des conditions avant publication. Un hébergeur statique alternatif permet de conserver le dépôt privé si nécessaire.

## Critère de sortie phase 1
CI verte + dépôt fusionné dans main + hébergement configuré + tests de connexion sur iPhone + fermeture des inscriptions vérifiée + aucun problème de sécurité bloquant connu.

Jusqu'à ces validations, **phase 1 = prête techniquement à être testée mais non clôturée**.
