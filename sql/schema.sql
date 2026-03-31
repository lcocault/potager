-- ============================================================
-- Potager - Schéma PostgreSQL
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table : species (espèces végétales)
-- ============================================================
CREATE TABLE species (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    icon        VARCHAR(255),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_species_name ON species(name);

-- ============================================================
-- Table : crop_paths (itinéraires de culture)
-- ============================================================
CREATE TYPE sowing_condition AS ENUM (
    'pleine_terre',
    'godet_serre_froide',
    'godet_serre_chauffee',
    'sous_chassis',
    'interieur'
);

CREATE TABLE crop_paths (
    id                  SERIAL PRIMARY KEY,
    species_id          INTEGER NOT NULL REFERENCES species(id) ON DELETE CASCADE,
    name                VARCHAR(150) NOT NULL,
    sowing_date         VARCHAR(5),       -- MM-DD (year-agnostic)
    sowing_condition    sowing_condition DEFAULT 'pleine_terre',
    transplant_date     VARCHAR(5),       -- MM-DD (year-agnostic)
    planting_date       VARCHAR(5),       -- MM-DD (year-agnostic)
    harvest_date        VARCHAR(5),       -- MM-DD (year-agnostic)
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_crop_paths_species ON crop_paths(species_id);

-- ============================================================
-- Table : grid_layout (configurations du terrain)
-- ============================================================
CREATE TABLE grid_layout (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL DEFAULT 'Mon potager',
    cols        INTEGER NOT NULL DEFAULT 20,
    rows        INTEGER NOT NULL DEFAULT 20,
    cell_size   INTEGER NOT NULL DEFAULT 30,  -- cm
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Table : grid_cells (cellules de la grille)
-- ============================================================
CREATE TYPE cell_type AS ENUM (
    'bati',
    'non_cultivable',
    'vegetation',
    'carre_potager',
    'pleine_terre',
    'allee',
    'vide'
);

CREATE TABLE grid_cells (
    id          SERIAL PRIMARY KEY,
    layout_id   INTEGER NOT NULL REFERENCES grid_layout(id) ON DELETE CASCADE,
    col         INTEGER NOT NULL,
    row         INTEGER NOT NULL,
    type        cell_type NOT NULL DEFAULT 'vide',
    label       VARCHAR(100),
    color       VARCHAR(7),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (layout_id, col, row)
);

CREATE INDEX idx_grid_cells_layout ON grid_cells(layout_id);
CREATE INDEX idx_grid_cells_pos    ON grid_cells(layout_id, col, row);

-- ============================================================
-- Table : crop_instances (exécution réelle des cultures)
-- ============================================================
CREATE TYPE crop_status AS ENUM (
    'planifie',
    'en_cours',
    'termine',
    'abandonne'
);

CREATE TABLE crop_instances (
    id                   SERIAL PRIMARY KEY,
    crop_path_id         INTEGER NOT NULL REFERENCES crop_paths(id) ON DELETE CASCADE,
    status               crop_status NOT NULL DEFAULT 'planifie',
    start_date           DATE,           -- actual start date chosen when creating from itinerary
    real_sowing_date     DATE,
    real_transplant_date DATE,
    real_planting_date   DATE,
    real_harvest_date    DATE,
    notes                TEXT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_crop_instances_path   ON crop_instances(crop_path_id);
CREATE INDEX idx_crop_instances_status ON crop_instances(status);

-- ============================================================
-- Table : crop_cell_assignments (zones affectées aux cultures)
-- ============================================================
CREATE TABLE crop_cell_assignments (
    id                  SERIAL PRIMARY KEY,
    crop_instance_id    INTEGER NOT NULL REFERENCES crop_instances(id) ON DELETE CASCADE,
    cell_id             INTEGER NOT NULL REFERENCES grid_cells(id) ON DELETE CASCADE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (crop_instance_id, cell_id)
);

CREATE INDEX idx_crop_cell_instance ON crop_cell_assignments(crop_instance_id);
CREATE INDEX idx_crop_cell_cell     ON crop_cell_assignments(cell_id);

-- ============================================================
-- Triggers : updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_species_updated_at
    BEFORE UPDATE ON species
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_crop_paths_updated_at
    BEFORE UPDATE ON crop_paths
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_grid_layout_updated_at
    BEFORE UPDATE ON grid_layout
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_grid_cells_updated_at
    BEFORE UPDATE ON grid_cells
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_crop_instances_updated_at
    BEFORE UPDATE ON crop_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Données initiales : espèces communes
-- ============================================================
INSERT INTO species (name, description, icon) VALUES
    ('Tomate',        'Plante potagère, fruit rouge estival',           '🍅'),
    ('Courgette',     'Cucurbitacée, production abondante',             '🥒'),
    ('Carotte',       'Racine orange, riche en bêtacarotène',           '🥕'),
    ('Laitue',        'Salade feuillue, cycle court',                   '🥬'),
    ('Haricot vert',  'Légumineuse grimpante ou naine',                 '🫘'),
    ('Pois',          'Légumineuse, semis précoce',                     '🫛'),
    ('Radis',         'Racine rapide, 30 jours de cycle',               '🌱'),
    ('Épinard',       'Feuilles riches en fer, supporte le froid',      '🌿'),
    ('Betterave',     'Racine rouge ou jaune, douce',                   '🔴'),
    ('Poivron',       'Fruit coloré, besoin de chaleur',                '🫑'),
    ('Aubergine',     'Fruit violet, grande chaleur nécessaire',        '🍆'),
    ('Concombre',     'Cucurbitacée grimpante',                         '🥒'),
    ('Poireau',       'Légume d''hiver résistant',                      '🌱'),
    ('Chou',          'Brassicacée, nombreuses variétés',               '🥦'),
    ('Brocoli',       'Brassicacée, récolte en été-automne',            '🥦'),
    ('Ail',           'Bulbe aromatique, plantation automne',           '🧄'),
    ('Oignon',        'Bulbe, semis hivernal ou achat plants',          '🧅'),
    ('Persil',        'Herbe aromatique bisannuelle',                   '🌿'),
    ('Basilic',       'Herbe aromatique annuelle, sensible au froid',   '🌿'),
    ('Thym',          'Herbe aromatique vivace',                        '🌿'),
    ('Citrouille',    'Cucurbitacée géante, décoration et cuisine',     '🎃'),
    ('Maïs',          'Céréale haute, besoin de soleil',                '🌽'),
    ('Tournesol',     'Grande fleur jaune, graines comestibles',        '🌻'),
    ('Fraise',        'Fruit rouge, court, culture en bac ou plein air','🍓'),
    ('Piment',        'Épice, proche du poivron, chaleur nécessaire',   '🌶️');

-- Grille par défaut
INSERT INTO grid_layout (name, cols, rows, cell_size) VALUES ('Mon potager', 20, 15, 30);
