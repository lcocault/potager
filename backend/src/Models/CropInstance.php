<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

class CropInstance
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /** @return list<array<string,mixed>> */
    public function findAll(?string $status = null): array
    {
        if ($status !== null) {
            $stmt = $this->db->prepare(
                'SELECT ci.*,
                        cp.name AS path_name,
                        cp.sowing_date, cp.transplant_date, cp.planting_date, cp.harvest_date,
                        s.name AS species_name, s.icon AS species_icon
                 FROM crop_instances ci
                 JOIN crop_paths cp ON cp.id = ci.crop_path_id
                 JOIN species s ON s.id = cp.species_id
                 WHERE ci.status = :status
                 ORDER BY ci.real_sowing_date, ci.created_at'
            );
            $stmt->execute(['status' => $status]);
        } else {
            $stmt = $this->db->query(
                'SELECT ci.*,
                        cp.name AS path_name,
                        cp.sowing_date, cp.transplant_date, cp.planting_date, cp.harvest_date,
                        s.name AS species_name, s.icon AS species_icon
                 FROM crop_instances ci
                 JOIN crop_paths cp ON cp.id = ci.crop_path_id
                 JOIN species s ON s.id = cp.species_id
                 ORDER BY ci.real_sowing_date, ci.created_at'
            );
        }
        return $stmt->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT ci.*,
                    cp.name AS path_name,
                    cp.sowing_date, cp.transplant_date, cp.planting_date, cp.harvest_date,
                    s.name AS species_name, s.icon AS species_icon
             FROM crop_instances ci
             JOIN crop_paths cp ON cp.id = ci.crop_path_id
             JOIN species s ON s.id = cp.species_id
             WHERE ci.id = :id'
        );
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch();
        return $result !== false ? $result : null;
    }

    /** @return list<array<string,mixed>> */
    public function getCells(int $instanceId): array
    {
        $stmt = $this->db->prepare(
            'SELECT gc.*
             FROM crop_cell_assignments cca
             JOIN grid_cells gc ON gc.id = cca.cell_id
             WHERE cca.crop_instance_id = :id'
        );
        $stmt->execute(['id' => $instanceId]);
        return $stmt->fetchAll();
    }

    /** @param array<string,mixed> $data */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO crop_instances
                (crop_path_id, status, start_date, real_sowing_date, real_transplant_date, real_planting_date, real_harvest_date, nb_sowed, nb_transplanted, nb_planted, nb_harvested, notes)
             VALUES
                (:crop_path_id, :status, :start_date, :real_sowing_date, :real_transplant_date, :real_planting_date, :real_harvest_date, :nb_sowed, :nb_transplanted, :nb_planted, :nb_harvested, :notes)
             RETURNING id'
        );
        $stmt->execute([
            'crop_path_id'         => $data['crop_path_id'],
            'status'               => $data['status'] ?? 'planifie',
            'start_date'           => $data['start_date'] ?? null,
            'real_sowing_date'     => $data['real_sowing_date'] ?? null,
            'real_transplant_date' => $data['real_transplant_date'] ?? null,
            'real_planting_date'   => $data['real_planting_date'] ?? null,
            'real_harvest_date'    => $data['real_harvest_date'] ?? null,
            'nb_sowed'             => $this->toNullableInt($data, 'nb_sowed'),
            'nb_transplanted'      => $this->toNullableInt($data, 'nb_transplanted'),
            'nb_planted'           => $this->toNullableInt($data, 'nb_planted'),
            'nb_harvested'         => $this->toNullableInt($data, 'nb_harvested'),
            'notes'                => $data['notes'] ?? null,
        ]);
        return (int) $stmt->fetchColumn();
    }

    /** @param array<string,mixed> $data */
    public function update(int $id, array $data): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE crop_instances SET
                status=:status, start_date=:start_date,
                real_sowing_date=:real_sowing_date,
                real_transplant_date=:real_transplant_date, real_planting_date=:real_planting_date,
                real_harvest_date=:real_harvest_date,
                nb_sowed=:nb_sowed, nb_transplanted=:nb_transplanted,
                nb_planted=:nb_planted, nb_harvested=:nb_harvested,
                notes=:notes
             WHERE id=:id'
        );
        return $stmt->execute([
            'id'                   => $id,
            'status'               => $data['status'] ?? 'planifie',
            'start_date'           => $data['start_date'] ?? null,
            'real_sowing_date'     => $data['real_sowing_date'] ?? null,
            'real_transplant_date' => $data['real_transplant_date'] ?? null,
            'real_planting_date'   => $data['real_planting_date'] ?? null,
            'real_harvest_date'    => $data['real_harvest_date'] ?? null,
            'nb_sowed'             => $this->toNullableInt($data, 'nb_sowed'),
            'nb_transplanted'      => $this->toNullableInt($data, 'nb_transplanted'),
            'nb_planted'           => $this->toNullableInt($data, 'nb_planted'),
            'nb_harvested'         => $this->toNullableInt($data, 'nb_harvested'),
            'notes'                => $data['notes'] ?? null,
        ]);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM crop_instances WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }

    /**
     * Return the value of $data[$key] cast to int, or null if missing / blank.
     *
     * @param array<string,mixed> $data
     */
    private function toNullableInt(array $data, string $key): ?int
    {
        $val = $data[$key] ?? null;
        if ($val === null || $val === '') {
            return null;
        }
        return (int) $val;
    }

    /** @param list<int> $cellIds */
    public function assignCells(int $instanceId, array $cellIds): void
    {
        $this->db->prepare('DELETE FROM crop_cell_assignments WHERE crop_instance_id = :id')
                 ->execute(['id' => $instanceId]);
        if (empty($cellIds)) {
            return;
        }
        $stmt = $this->db->prepare(
            'INSERT INTO crop_cell_assignments (crop_instance_id, cell_id) VALUES (:iid, :cid) ON CONFLICT DO NOTHING'
        );
        foreach ($cellIds as $cellId) {
            $stmt->execute(['iid' => $instanceId, 'cid' => $cellId]);
        }
    }

    /** Return instances active on a given date */
    public function findByDate(string $date): array
    {
        $stmt = $this->db->prepare(
            'SELECT ci.*,
                    cp.name AS path_name,
                    cp.sowing_date, cp.transplant_date, cp.planting_date, cp.harvest_date,
                    s.name AS species_name, s.icon AS species_icon
             FROM crop_instances ci
             JOIN crop_paths cp ON cp.id = ci.crop_path_id
             JOIN species s ON s.id = cp.species_id
             WHERE (ci.real_sowing_date IS NULL OR ci.real_sowing_date <= :date)
               AND (ci.real_harvest_date IS NULL OR ci.real_harvest_date >= :date2)
             ORDER BY ci.created_at'
        );
        $stmt->execute(['date' => $date, 'date2' => $date]);
        return $stmt->fetchAll();
    }
}
