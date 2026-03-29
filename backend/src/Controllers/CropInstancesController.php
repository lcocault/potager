<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\CropInstance;

class CropInstancesController
{
    private CropInstance $model;

    public function __construct()
    {
        $this->model = new CropInstance();
    }

    /** GET /api/crop-instances */
    public function index(Request $request): never
    {
        $status = $request->queryParams['status'] ?? null;
        $date   = $request->queryParams['date'] ?? null;
        if ($date !== null) {
            Response::json($this->model->findByDate($date));
        }
        Response::json($this->model->findAll($status));
    }

    /** GET /api/crop-instances/{id} */
    public function show(Request $request, array $params): never
    {
        $instance = $this->model->findById((int) $params['id']);
        if ($instance === null) {
            Response::notFound('Crop instance not found');
        }
        $instance['cells'] = $this->model->getCells((int) $params['id']);
        Response::json($instance);
    }

    /** POST /api/crop-instances */
    public function store(Request $request): never
    {
        $data = $request->getBody();
        if (empty($data['crop_path_id'])) {
            Response::error('Field "crop_path_id" is required');
        }
        $this->validateStatus($data['status'] ?? 'planifie');
        $id       = $this->model->create($data);
        $instance = $this->model->findById($id);
        if (!empty($data['cell_ids']) && is_array($data['cell_ids'])) {
            $this->model->assignCells($id, array_map('intval', $data['cell_ids']));
        }
        $instance['cells'] = $this->model->getCells($id);
        Response::json($instance, 201);
    }

    /** PUT /api/crop-instances/{id} */
    public function update(Request $request, array $params): never
    {
        $data = $request->getBody();
        if ($this->model->findById((int) $params['id']) === null) {
            Response::notFound('Crop instance not found');
        }
        $this->validateStatus($data['status'] ?? 'planifie');
        $this->model->update((int) $params['id'], $data);
        if (isset($data['cell_ids']) && is_array($data['cell_ids'])) {
            $this->model->assignCells((int) $params['id'], array_map('intval', $data['cell_ids']));
        }
        $instance          = $this->model->findById((int) $params['id']);
        $instance['cells'] = $this->model->getCells((int) $params['id']);
        Response::json($instance);
    }

    /** DELETE /api/crop-instances/{id} */
    public function destroy(Request $request, array $params): never
    {
        if ($this->model->findById((int) $params['id']) === null) {
            Response::notFound('Crop instance not found');
        }
        $this->model->delete((int) $params['id']);
        Response::json(['success' => true]);
    }

    private function validateStatus(string $status): void
    {
        $valid = ['planifie', 'en_cours', 'termine', 'abandonne'];
        if (!in_array($status, $valid, true)) {
            Response::error('Invalid status value. Allowed: ' . implode(', ', $valid));
        }
    }
}
