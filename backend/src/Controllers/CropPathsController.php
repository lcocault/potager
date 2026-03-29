<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\CropPath;
use App\Services\ExcelImportService;

class CropPathsController
{
    private CropPath $model;

    public function __construct()
    {
        $this->model = new CropPath();
    }

    /** GET /api/crop-paths */
    public function index(Request $request): never
    {
        $speciesId = isset($request->queryParams['species_id'])
            ? (int) $request->queryParams['species_id']
            : null;
        Response::json($this->model->findAll($speciesId));
    }

    /** GET /api/crop-paths/{id} */
    public function show(Request $request, array $params): never
    {
        $path = $this->model->findById((int) $params['id']);
        if ($path === null) {
            Response::notFound('Crop path not found');
        }
        Response::json($path);
    }

    /** POST /api/crop-paths */
    public function store(Request $request): never
    {
        $data = $request->getBody();
        $this->validate($data);
        $id   = $this->model->create($data);
        Response::json($this->model->findById($id), 201);
    }

    /** PUT /api/crop-paths/{id} */
    public function update(Request $request, array $params): never
    {
        $data = $request->getBody();
        $this->validate($data);
        if ($this->model->findById((int) $params['id']) === null) {
            Response::notFound('Crop path not found');
        }
        $this->model->update((int) $params['id'], $data);
        Response::json($this->model->findById((int) $params['id']));
    }

    /** DELETE /api/crop-paths/{id} */
    public function destroy(Request $request, array $params): never
    {
        if ($this->model->findById((int) $params['id']) === null) {
            Response::notFound('Crop path not found');
        }
        $this->model->delete((int) $params['id']);
        Response::json(['success' => true]);
    }

    /** POST /api/crop-paths/import */
    public function import(Request $request): never
    {
        if (!isset($_FILES['file'])) {
            Response::error('No file uploaded');
        }
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('File upload error: ' . $file['error']);
        }
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['xlsx', 'xls', 'ods'], true)) {
            Response::error('Invalid file type. Allowed: xlsx, xls, ods');
        }
        try {
            $service = new ExcelImportService();
            $result  = $service->import($file['tmp_name']);
            Response::json($result, 201);
        } catch (\Throwable $e) {
            Response::error('Import failed: ' . $e->getMessage());
        }
    }

    /** @param array<string,mixed> $data */
    private function validate(array $data): void
    {
        if (empty($data['species_id'])) {
            Response::error('Field "species_id" is required');
        }
        if (empty($data['name'])) {
            Response::error('Field "name" is required');
        }
        $validConditions = [
            'pleine_terre', 'godet_serre_froide', 'godet_serre_chauffee', 'sous_chassis', 'interieur'
        ];
        if (!empty($data['sowing_condition']) && !in_array($data['sowing_condition'], $validConditions, true)) {
            Response::error('Invalid sowing_condition value');
        }
    }
}
