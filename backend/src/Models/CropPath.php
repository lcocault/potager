<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

class CropPath
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /** @return list<array<string,mixed>> */
    public function findAll(?int $speciesId = null): array
    {
        if ($speciesId !== null) {
            $stmt = $this->db->prepare(
                'SELECT cp.*, s.name AS species_name, s.icon AS species_icon
                 FROM crop_paths cp
                 JOIN species s ON s.id = cp.species_id
                 WHERE cp.species_id = :sid
                 ORDER BY cp.sowing_date'
            );
            $stmt->execute(['sid' => $speciesId]);
        } else {
            $stmt = $this->db->query(
                'SELECT cp.*, s.name AS species_name, s.icon AS species_icon
                 FROM crop_paths cp
                 JOIN species s ON s.id = cp.species_id
                 ORDER BY cp.sowing_date'
            );
        }
        return $stmt->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT cp.*, s.name AS species_name, s.icon AS species_icon
             FROM crop_paths cp
             JOIN species s ON s.id = cp.species_id
             WHERE cp.id = :id'
        );
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch();
        return $result !== false ? $result : null;
    }

    /** @param array<string,mixed> $data */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO crop_paths
                (species_id, name, sowing_date, sowing_condition, transplant_date, planting_date, harvest_date, notes)
             VALUES
                (:species_id, :name, :sowing_date, :sowing_condition, :transplant_date, :planting_date, :harvest_date, :notes)
             RETURNING id'
        );
        $stmt->execute([
            'species_id'       => $data['species_id'],
            'name'             => $data['name'],
            'sowing_date'      => $data['sowing_date'] ?? null,
            'sowing_condition' => $data['sowing_condition'] ?? 'pleine_terre',
            'transplant_date'  => $data['transplant_date'] ?? null,
            'planting_date'    => $data['planting_date'] ?? null,
            'harvest_date'     => $data['harvest_date'] ?? null,
            'notes'            => $data['notes'] ?? null,
        ]);
        return (int) $stmt->fetchColumn();
    }

    /** @param array<string,mixed> $data */
    public function update(int $id, array $data): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE crop_paths SET
                species_id=:species_id, name=:name, sowing_date=:sowing_date,
                sowing_condition=:sowing_condition, transplant_date=:transplant_date,
                planting_date=:planting_date, harvest_date=:harvest_date, notes=:notes
             WHERE id=:id'
        );
        return $stmt->execute([
            'id'               => $id,
            'species_id'       => $data['species_id'],
            'name'             => $data['name'],
            'sowing_date'      => $data['sowing_date'] ?? null,
            'sowing_condition' => $data['sowing_condition'] ?? 'pleine_terre',
            'transplant_date'  => $data['transplant_date'] ?? null,
            'planting_date'    => $data['planting_date'] ?? null,
            'harvest_date'     => $data['harvest_date'] ?? null,
            'notes'            => $data['notes'] ?? null,
        ]);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM crop_paths WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }
}
