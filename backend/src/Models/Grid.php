<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

class Grid
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /** @return list<array<string,mixed>> */
    public function findAllLayouts(): array
    {
        $stmt = $this->db->query('SELECT * FROM grid_layout ORDER BY id');
        return $stmt->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function findLayoutById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM grid_layout WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch();
        return $result !== false ? $result : null;
    }

    /** @param array<string,mixed> $data */
    public function createLayout(array $data): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO grid_layout (name, cols, rows, cell_size) VALUES (:name, :cols, :rows, :cell_size) RETURNING id'
        );
        $stmt->execute([
            'name'      => $data['name'] ?? 'Mon potager',
            'cols'      => $data['cols'] ?? 20,
            'rows'      => $data['rows'] ?? 15,
            'cell_size' => $data['cell_size'] ?? 30,
        ]);
        return (int) $stmt->fetchColumn();
    }

    /** @param array<string,mixed> $data */
    public function updateLayout(int $id, array $data): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE grid_layout SET name=:name, cols=:cols, rows=:rows, cell_size=:cell_size WHERE id=:id'
        );
        return $stmt->execute([
            'id'        => $id,
            'name'      => $data['name'],
            'cols'      => $data['cols'],
            'rows'      => $data['rows'],
            'cell_size' => $data['cell_size'],
        ]);
    }

    /** @return list<array<string,mixed>> */
    public function getCells(int $layoutId): array
    {
        $stmt = $this->db->prepare('SELECT * FROM grid_cells WHERE layout_id = :lid ORDER BY row, col');
        $stmt->execute(['lid' => $layoutId]);
        return $stmt->fetchAll();
    }

    /** @param array<string,mixed> $data */
    public function upsertCell(int $layoutId, array $data): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO grid_cells (layout_id, col, row, type, label, color)
             VALUES (:lid, :col, :row, :type, :label, :color)
             ON CONFLICT (layout_id, col, row) DO UPDATE
             SET type=EXCLUDED.type, label=EXCLUDED.label, color=EXCLUDED.color, updated_at=NOW()'
        );
        $stmt->execute([
            'lid'   => $layoutId,
            'col'   => $data['col'],
            'row'   => $data['row'],
            'type'  => $data['type'] ?? 'vide',
            'label' => $data['label'] ?? null,
            'color' => $data['color'] ?? null,
        ]);
    }

    /** Save multiple cells at once */
    public function saveCells(int $layoutId, array $cells): void
    {
        foreach ($cells as $cell) {
            $this->upsertCell($layoutId, $cell);
        }
    }

    /** Reset all cells of a layout */
    public function clearCells(int $layoutId): void
    {
        $stmt = $this->db->prepare('DELETE FROM grid_cells WHERE layout_id = :lid');
        $stmt->execute(['lid' => $layoutId]);
    }

    /** Check if any crop instances are assigned to cells of this layout */
    public function hasCropAssignments(int $layoutId): bool
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM crop_cell_assignments cca
             JOIN grid_cells gc ON cca.cell_id = gc.id
             WHERE gc.layout_id = :lid'
        );
        $stmt->execute(['lid' => $layoutId]);
        return (int) $stmt->fetchColumn() > 0;
    }

    /** Delete a layout and its cells (CASCADE) */
    public function deleteLayout(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM grid_layout WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }

    /** Get cells with active crop instances on a given date */
    public function getCellsWithCrops(int $layoutId, string $date): array
    {
        $stmt = $this->db->prepare(
            'SELECT gc.col, gc.row, gc.type,
                    ci.id AS instance_id, ci.status,
                    s.name AS species_name, s.icon AS species_icon
             FROM grid_cells gc
             LEFT JOIN crop_cell_assignments cca ON cca.cell_id = gc.id
             LEFT JOIN crop_instances ci ON ci.id = cca.crop_instance_id
                 AND (ci.real_sowing_date IS NULL OR ci.real_sowing_date <= :date)
                 AND (ci.real_harvest_date IS NULL OR ci.real_harvest_date >= :date2)
             LEFT JOIN crop_paths cp ON cp.id = ci.crop_path_id
             LEFT JOIN species s ON s.id = cp.species_id
             WHERE gc.layout_id = :lid
             ORDER BY gc.row, gc.col'
        );
        $stmt->execute(['lid' => $layoutId, 'date' => $date, 'date2' => $date]);
        return $stmt->fetchAll();
    }
}
