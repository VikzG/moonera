# Configuration des APIs de Vérification

Ce document décrit comment configurer les APIs externes utilisées pour la vérification de l'authenticité des utilisateurs et des looks.

## Vue d'ensemble

L'application utilise trois services pour assurer la vérification :

1. **Hive Moderation** - Détection d'images générées par IA
2. **Azure Face Liveness** - Vérification de la présence réelle (anti-deepfake)
3. **Azure Face Verify** - Comparaison et matching de visages

## Configuration des secrets Supabase

Les clés API doivent être configurées comme secrets dans votre projet Supabase. Ces secrets sont automatiquement disponibles dans les Edge Functions via `Deno.env.get()`.

### Étape 1 : Azure Face API

Azure Face API est utilisé pour le liveness check et le face matching.

1. Créez une ressource Azure Face API :
   - Connectez-vous au [portail Azure](https://portal.azure.com)
   - Créez une nouvelle ressource "Face"
   - Choisissez votre région (ex: East US)
   - Sélectionnez le tier de pricing (F0 gratuit pour commencer)

2. Récupérez vos credentials :
   - Endpoint : `https://VOTRE-REGION.api.cognitive.microsoft.com`
   - Key : Trouvée dans "Keys and Endpoint" de votre ressource

3. Configurez les secrets Supabase :
   ```bash
   supabase secrets set AZURE_FACE_ENDPOINT="https://VOTRE-REGION.api.cognitive.microsoft.com"
   supabase secrets set AZURE_FACE_KEY="votre-clé-azure"
   ```

**Documentation Azure Face API :**
- [Azure Face API Overview](https://learn.microsoft.com/en-us/azure/cognitive-services/face/overview)
- [Face Detection](https://learn.microsoft.com/en-us/azure/cognitive-services/face/concepts/face-detection)
- [Face Verification](https://learn.microsoft.com/en-us/azure/cognitive-services/face/how-to/verify-faces)

### Étape 2 : Hive Moderation API

Hive Moderation est utilisé pour détecter les images générées par IA.

1. Créez un compte Hive :
   - Inscrivez-vous sur [thehive.ai](https://thehive.ai)
   - Créez un nouveau projet
   - Activez le modèle "AI Generated Media"

2. Récupérez votre API key :
   - Dans le dashboard, allez dans "API Keys"
   - Créez une nouvelle clé ou copiez la clé existante

3. Configurez le secret Supabase :
   ```bash
   supabase secrets set HIVE_API_KEY="votre-clé-hive"
   ```

**Documentation Hive API :**
- [Hive API Documentation](https://docs.thehive.ai)
- [AI Generated Media Detection](https://docs.thehive.ai/docs/ai-generated-media)

## Mode Fallback

Si les clés API ne sont pas configurées, les Edge Functions utilisent automatiquement un mode "fallback" avec des simulations. Ce mode est utile pour :

- Le développement local
- Les tests
- Les environnements de staging

**Attention :** Le mode fallback ne doit JAMAIS être utilisé en production car il ne fournit pas de vraie protection contre les images IA et les deepfakes.

## Vérification de la configuration

Pour vérifier que vos secrets sont correctement configurés :

```bash
supabase secrets list
```

Vous devriez voir :
- `AZURE_FACE_ENDPOINT`
- `AZURE_FACE_KEY`
- `HIVE_API_KEY`

## Architecture de vérification

### Phase 1 : Inscription utilisateur (verify-selfie)

1. **Liveness Check** (Azure Face)
   - Détecte la présence d'un visage
   - Évalue la qualité de l'image (blur, exposition, bruit)
   - Valide que c'est une vraie personne

2. **AI Detection** (Hive)
   - Analyse si l'image est générée par IA
   - Rejette les selfies synthétiques

3. **Face Embedding** (Azure Face)
   - Crée un ID de visage unique
   - Stocké dans le profil utilisateur pour comparaisons futures

### Phase 2 : Publication de look (verify-look)

1. **AI Detection** (Hive)
   - Vérifie que la photo de la tenue est réelle
   - Rejette les images générées par IA

2. **Face Matching** (Azure Face Verify)
   - Compare le visage dans la tenue avec l'embedding stocké
   - Valide que c'est bien la même personne

## Tarification et limites

### Azure Face API

- **Tier gratuit (F0)** :
  - 20 appels/minute
  - 30 000 appels/mois
  - Parfait pour commencer

- **Tier Standard (S0)** :
  - 10 appels/seconde
  - $1 pour 1000 transactions (detect/verify)

### Hive Moderation

- **Plan gratuit** :
  - 100 requêtes/mois
  - Idéal pour les tests

- **Plan Starter** :
  - À partir de $99/mois
  - 10 000 requêtes incluses
  - $0.01 par requête supplémentaire

## Déploiement des Edge Functions

Après avoir configuré vos secrets, déployez les Edge Functions :

```bash
supabase functions deploy verify-selfie
supabase functions deploy verify-look
```

## Monitoring et logs

Pour voir les logs des Edge Functions et débugger les problèmes d'API :

```bash
supabase functions logs verify-selfie
supabase functions logs verify-look
```

## Troubleshooting

### Erreur : "Azure API error: 401"
- Vérifiez que `AZURE_FACE_KEY` est correct
- Assurez-vous que votre clé Azure n'a pas expiré

### Erreur : "Hive API error: 403"
- Vérifiez que `HIVE_API_KEY` est correct
- Vérifiez que vous n'avez pas dépassé vos limites de quota

### Erreur : "No face detected"
- La qualité de l'image est insuffisante
- Assurez-vous que le visage est bien visible et éclairé
- L'image ne doit pas être trop petite (minimum 200x200 pixels)

### Les vérifications utilisent le fallback
- Vérifiez que les secrets sont bien configurés avec `supabase secrets list`
- Redéployez les Edge Functions après avoir ajouté les secrets
- Consultez les logs pour voir les messages d'erreur spécifiques

## Sécurité

- Les clés API ne sont JAMAIS exposées côté client
- Toutes les vérifications se font côté serveur via Edge Functions
- Les secrets Supabase sont encryptés et sécurisés
- Les face embeddings sont stockés de manière sécurisée dans la base de données

## Support

Pour toute question ou problème :

- Azure Face API : [Support Azure](https://azure.microsoft.com/support)
- Hive Moderation : support@thehive.ai
- Documentation Supabase : [docs.supabase.com](https://docs.supabase.com)
