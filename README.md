# 🌱 Mon Potager

Application web complète de gestion d'un potager personnel.

## Fonctionnalités

- 📅 **Calendrier des itinéraires** – Timeline visuelle des cycles de culture, avec import Excel
- 🗺️ **Plan du terrain** – Éditeur graphique interactif d'une grille 2D (drag & paint)
- 🌿 **Suivi des cultures** – Suivi réel des semis, repiquages, plantations et récoltes avec superposition sur la grille

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend | PHP 8.1+ (MVC, API REST) |
| Base de données | PostgreSQL 14+ |
| Frontend | HTML/CSS + TypeScript |
| Déploiement | AlwaysData (Apache + PHP) |

## Démarrage rapide

```bash
# 1. Créer la base de données
psql -U postgres -c "CREATE DATABASE potager;"
psql -U postgres -d potager -f sql/schema.sql

# 2. Installer les dépendances PHP
cd backend && composer install

# 3. Configurer la base (variables d'env ou config/database.php)
export DB_NAME=potager DB_USER=postgres DB_PASSWORD=secret

# 4. Lancer le backend
cd backend/public && php -S localhost:8000

# 5. Ouvrir le frontend
open frontend/public/index.html
```

## Documentation

Voir [docs/installation.md](docs/installation.md) pour les instructions complètes de déploiement sur AlwaysData.

## Structure du projet

```
potager/
├── sql/schema.sql          ← Schéma PostgreSQL
├── backend/                ← API REST PHP
│   ├── public/index.php    ← Point d'entrée
│   └── src/                ← MVC (Core, Controllers, Models, Services)
├── frontend/               ← Interface web
│   ├── src/*.ts            ← Sources TypeScript
│   └── public/             ← HTML, CSS, JS compilé
└── docs/                   ← Documentation + exemple Excel
```
