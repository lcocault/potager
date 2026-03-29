<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

class Species
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /** @return list<array<string,mixed>> */
    public function findAll(): array
    {
        $stmt = $this->db->query('SELECT * FROM species ORDER BY name');
        return $stmt->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM species WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch();
        return $result !== false ? $result : null;
    }

    /** @param array<string,mixed> $data */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO species (name, description, icon) VALUES (:name, :description, :icon) RETURNING id'
        );
        $stmt->execute([
            'name'        => $data['name'],
            'description' => $data['description'] ?? null,
            'icon'        => $data['icon'] ?? null,
        ]);
        return (int) $stmt->fetchColumn();
    }

    /** @param array<string,mixed> $data */
    public function update(int $id, array $data): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE species SET name=:name, description=:description, icon=:icon WHERE id=:id'
        );
        return $stmt->execute([
            'id'          => $id,
            'name'        => $data['name'],
            'description' => $data['description'] ?? null,
            'icon'        => $data['icon'] ?? null,
        ]);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM species WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }

    /** Find or create species by name, return id */
    public function findOrCreate(string $name): int
    {
        $stmt = $this->db->prepare('SELECT id FROM species WHERE LOWER(name) = LOWER(:name)');
        $stmt->execute(['name' => $name]);
        $row = $stmt->fetch();
        if ($row) {
            return (int) $row['id'];
        }
        return $this->create(['name' => $name]);
    }
}
