# 🌱 Mon Potager – Guide d'installation et déploiement

## Prérequis

- PHP ≥ 8.1 avec extensions : `pdo`, `pdo_pgsql`, `json`, `fileinfo`
- PostgreSQL ≥ 14
- Node.js ≥ 18 (uniquement pour recompiler le TypeScript)
- Composer (gestionnaire de dépendances PHP)
- Serveur web Apache/Nginx (ou AlwaysData)

---

## 1. Base de données PostgreSQL

### Création de la base

```sql
CREATE USER potager_user WITH PASSWORD 'votre_mot_de_passe';
CREATE DATABASE potager OWNER potager_user;
GRANT ALL PRIVILEGES ON DATABASE potager TO potager_user;
```

### Import du schéma

```bash
psql -U potager_user -d potager -f sql/schema.sql
```

Le schéma crée :
- Les tables : `species`, `crop_paths`, `crop_instances`, `grid_cells`, `grid_layout`, `crop_cell_assignments`
- Les triggers `updated_at`
- 25 espèces prédéfinies
- Une grille de terrain par défaut (20×15)

---

## 2. Backend PHP

### Configuration de la base de données

Copiez le fichier de configuration et adaptez-le :

```bash
cp backend/config/database.php backend/config/database.local.php
```

Ou définissez des variables d'environnement :

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=potager
export DB_USER=potager_user
export DB_PASSWORD=votre_mot_de_passe
```

### Installation des dépendances PHP

```bash
cd backend
composer install --no-dev --optimize-autoloader
```

### Structure du backend

```
backend/
├── composer.json
├── config/database.php
├── public/
│   ├── index.php      ← Point d'entrée unique
│   └── .htaccess      ← Réécriture URL Apache
└── src/
    ├── Core/          ← Router, Database, Request, Response
    ├── Controllers/   ← SpeciesController, CropPathsController, etc.
    ├── Models/        ← Species, CropPath, CropInstance, Grid
    └── Services/      ← ExcelImportService
```

---

## 3. Frontend

Le frontend est pré-compilé (fichiers JS dans `frontend/public/js/`).
Si vous souhaitez recompiler le TypeScript :

```bash
cd frontend
npm install
npm run build
```

### Configuration de l'URL API

Dans `frontend/public/index.html`, modifiez :
```html
<script>
  window.API_BASE = '/api';  // ← adapter selon votre domaine
</script>
```

---

## 4. Déploiement sur AlwaysData

### Configuration du site

1. Dans le panneau AlwaysData, créez un site web
2. Pointez la racine vers `backend/public/`
3. Assurez-vous que `mod_rewrite` est activé

### Déploiement des fichiers frontend

Deux options :

**Option A – Servir depuis le backend**

Copiez le frontend dans `backend/public/` :
```bash
cp -r frontend/public/* backend/public/
```
Le `index.php` restera le point d'entrée pour les routes `/api/*`,
et les fichiers statiques seront servis directement.

**Option B – Site séparé (recommandé)**

Créez un deuxième site AlwaysData pointant vers `frontend/public/`.
Configurez l'URL API dans `index.html` :
```javascript
window.API_BASE = 'https://votre-backend.alwaysdata.net/api';
```

### Variables d'environnement AlwaysData

Dans le panneau `Configuration > Environnement`, ajoutez :
```
DB_HOST=postgresql-xxxx.alwaysdata.net
DB_PORT=5432
DB_NAME=votre_base
DB_USER=votre_utilisateur
DB_PASSWORD=votre_mot_de_passe
```

### Structure recommandée sur le serveur

```
www/
├── api/          ← backend/public/ (point d'entrée PHP)
│   ├── index.php
│   └── .htaccess
└── app/          ← frontend/public/ (site statique)
    ├── index.html
    ├── style.css
    └── js/
```

---

## 5. Import Excel

### Format attendu

Créez un fichier `.xlsx` avec une ligne d'en-têtes contenant au moins :

| Colonne obligatoire | Colonnes optionnelles |
|--------------------|-----------------------|
| `espece` ou `species` | `nom`, `semis`, `condition`, `repiquage`, `plantation`, `recolte`, `notes` |

### Exemple de fichier

Voir `docs/exemple-import.xlsx` dans le projet.

### Via l'interface

1. Allez dans le module **Calendrier**
2. Cliquez sur **📥 Importer Excel**
3. Sélectionnez votre fichier `.xlsx`
4. Les itinéraires sont créés automatiquement

### Via l'API REST

```bash
curl -X POST https://votre-domaine.net/api/crop-paths/import \
     -F "file=@mon-potager.xlsx"
```

---

## 6. API REST

### Endpoints disponibles

| Méthode | Endpoint                        | Description                     |
|---------|---------------------------------|---------------------------------|
| GET     | `/api/species`                  | Liste des espèces               |
| POST    | `/api/species`                  | Créer une espèce                |
| PUT     | `/api/species/{id}`             | Modifier une espèce             |
| DELETE  | `/api/species/{id}`             | Supprimer une espèce            |
| GET     | `/api/crop-paths`               | Liste des itinéraires           |
| GET     | `/api/crop-paths?species_id=1`  | Filtrer par espèce              |
| POST    | `/api/crop-paths`               | Créer un itinéraire             |
| POST    | `/api/crop-paths/import`        | Importer depuis Excel           |
| PUT     | `/api/crop-paths/{id}`          | Modifier un itinéraire          |
| DELETE  | `/api/crop-paths/{id}`          | Supprimer un itinéraire         |
| GET     | `/api/crop-instances`           | Liste des cultures              |
| GET     | `/api/crop-instances?status=en_cours` | Filtrer par statut       |
| GET     | `/api/crop-instances?date=2024-06-15` | Actives à une date       |
| POST    | `/api/crop-instances`           | Créer une culture               |
| PUT     | `/api/crop-instances/{id}`      | Modifier une culture            |
| DELETE  | `/api/crop-instances/{id}`      | Supprimer une culture           |
| GET     | `/api/grid`                     | Liste des plans de terrain      |
| GET     | `/api/grid/{id}`                | Plan avec ses cellules          |
| POST    | `/api/grid`                     | Créer un plan                   |
| PUT     | `/api/grid/{id}`                | Enregistrer le plan             |
| DELETE  | `/api/grid/{id}/cells`          | Réinitialiser les cellules      |
| GET     | `/api/grid/{id}/crops?date=...` | Cultures sur le terrain à date  |

---

## 7. Développement local

### Lancer le backend PHP

```bash
cd backend/public
php -S localhost:8000
```

### Lancer le frontend en mode développement

```bash
cd frontend
npm run watch    # recompile TypeScript automatiquement
npx serve public # serveur de développement
```

Accédez à `http://localhost:3000` (modifiez `API_BASE` dans `index.html` si nécessaire).

---

## 8. Structure complète du projet

```
potager/
├── README.md
├── sql/
│   └── schema.sql              ← Schéma PostgreSQL complet
├── docs/
│   └── installation.md         ← Ce fichier
├── backend/
│   ├── composer.json
│   ├── config/
│   │   └── database.php
│   ├── public/
│   │   ├── index.php           ← Routeur principal
│   │   └── .htaccess
│   └── src/
│       ├── Core/
│       │   ├── Database.php
│       │   ├── Request.php
│       │   ├── Response.php
│       │   └── Router.php
│       ├── Controllers/
│       │   ├── SpeciesController.php
│       │   ├── CropPathsController.php
│       │   ├── CropInstancesController.php
│       │   └── GridController.php
│       ├── Models/
│       │   ├── Species.php
│       │   ├── CropPath.php
│       │   ├── CropInstance.php
│       │   └── Grid.php
│       └── Services/
│           └── ExcelImportService.php
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── src/                    ← Sources TypeScript
    │   ├── api.ts
    │   ├── calendar.ts
    │   ├── grid.ts
    │   ├── tracking.ts
    │   └── main.ts
    └── public/                 ← Fichiers servis au navigateur
        ├── index.html
        ├── style.css
        └── js/                 ← TypeScript compilé (commit inclus)
            ├── api.js
            ├── calendar.js
            ├── grid.js
            ├── tracking.js
            └── main.js
```
