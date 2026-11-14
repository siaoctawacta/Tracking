# Alertes WhatsApp — Kader Cargo

Le client reçoit **un message WhatsApp à chaque étape franchie** par son colis, sur le numéro saisi à la réception à Guangzhou :

| Étape | Déclencheur | Message |
|---|---|---|
| 1. Enregistré à Guangzhou | Création du colis (agent Guangzhou) | 📦 Colis bien reçu — contenu, poids, montant |
| 2. Chargement | Statut manuel ou clôture du lot | 🗂️ Colis en préparation d’expédition |
| 3. En vol / En mer | Statut manuel ou mise à jour du lot | ✈️ Votre colis est en vol — date d’arrivée prévue |
| 4. Arrivé à Lomé | Agent Lomé | 🛬 Arrivé à Lomé, dédouanement en cours |
| 5. Disponible au retrait | Agent Lomé (valide le dédouanement) | ✅ Colis prêt — montant à régler, pièces à présenter, contact |
| 6. Remis au client | Agent Lomé | 🤝 Colis remis — remerciement |

Règles :

- **Une seule alerte par étape** et par colis (pas de doublon si l’étape est validée deux fois).
- **Aucune alerte en cas de correction en arrière** (admin) pour ne pas embrouiller le client.
- La note saisie par l’agent est ajoutée au message (`📝 Note de l’agence : …`).
- Avant de valider une étape, l’agent voit **l’aperçu exact** du message dans le back-office.
- Envoi en arrière-plan avec **3 tentatives** (immédiate, +30 s, +2 min). Chaque alerte est visible dans la fiche du colis (Envoyé / En cours / Échec / Simulé) avec un bouton **Renvoyer**.

Le texte des messages est dans `server/src/lib/whatsapp.ts` (`composeStatusMessage`).

## Brancher un vrai compte WhatsApp

Sans identifiants, les messages sont **simulés** : affichés dans la console de l’API et dans le back-office.

### Option A — Twilio

```
TWILIO_ACCOUNT_SID=AC…
TWILIO_AUTH_TOKEN=…
TWILIO_WHATSAPP_FROM=+228XXXXXXXX
```

Le texte complet est envoyé tel quel. WhatsApp n’autorise ce texte libre que dans les 24 h suivant un message du client ; au-delà il faut des **modèles approuvés** (ci-dessous), à déclarer dans Twilio Content puis à référencer :

```
TWILIO_CONTENT_SIDS={"REGISTERED":"HX…","LOADING":"HX…","IN_TRANSIT":"HX…","ARRIVED":"HX…","READY":"HX…","DELIVERED":"HX…"}
```

### Option B — Meta WhatsApp Business Cloud API

```
META_WHATSAPP_TOKEN=EAA…
META_WHATSAPP_PHONE_NUMBER_ID=…
META_TEMPLATE_PREFIX=kader_
META_TEMPLATE_LANGUAGE=fr
```

Créez dans WhatsApp Manager six modèles de catégorie **Utility**, langue **Français**, nommés `kader_registered`, `kader_loading`, `kader_in_transit`, `kader_arrived`, `kader_ready`, `kader_delivered`.

## Modèles à faire approuver

Variables communes : `{{1}}` = prénom du client, `{{2}}` = numéro de suivi, `{{3}}` = détail de l’étape.

**kader_registered** — `{{3}}` = « 2 colis · 12,5 kg · 118 800 FCFA »
> 📦 Colis bien reçu à Guangzhou
> Bonjour {{1}}, votre colis {{2}} a été réceptionné et contrôlé dans notre entrepôt de Guangzhou ({{3}}). Conservez ce numéro de suivi : il vous sera demandé au retrait.

**kader_loading** — `{{3}}` = code du lot
> 🗂️ Colis en préparation d’expédition
> Bonjour {{1}}, votre colis {{2}} est en cours de chargement (lot {{3}}) à Guangzhou. Il partira très prochainement.

**kader_in_transit** — `{{3}}` = date d’arrivée prévue
> ✈️ Votre colis est en route
> Bonjour {{1}}, votre colis {{2}} a quitté Guangzhou à destination de Lomé. Arrivée prévue : {{3}}.

**kader_arrived** — `{{3}}` = « Lomé »
> 🛬 Votre colis est arrivé
> Bonjour {{1}}, votre colis {{2}} est bien arrivé à {{3}}. Il est en cours de dédouanement : nous vous prévenons dès qu’il est prêt.

**kader_ready** — `{{3}}` = montant
> ✅ Votre colis est prêt
> Bonjour {{1}}, votre colis {{2}} est dédouané et disponible à l’agence Kader Cargo de Lomé. Montant à régler : {{3}}. Présentez votre numéro de suivi et une pièce d’identité. Contact : +228 90 94 44 48.

**kader_delivered** — `{{3}}` = date de remise
> 🤝 Colis remis — merci !
> Bonjour {{1}}, votre colis {{2}} vous a été remis le {{3}}. Merci de votre confiance, à bientôt pour votre prochain envoi depuis Guangzhou !

## Codes de vérification et avis de compte

En plus des alertes de suivi, WhatsApp sert à envoyer :

- **`kader_otp`** — catégorie **Authentification** chez Meta (modèle standard « code de vérification » avec bouton *Copier le code*). `{{1}}` = code à 6 chiffres. Chez Twilio : `TWILIO_CONTENT_SIDS={"OTP":"HX…"}`.
- **`kader_account`** — catégorie **Utility**, avis de validation du compte. `{{1}}` = titre, `{{2}}` = message.
  > {{1}}
  > {{2}}

Les codes envoyés par e-mail utilisent le SMTP configuré (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`).
