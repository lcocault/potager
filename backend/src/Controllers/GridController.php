<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\Grid;

class GridController
{
    private Grid $model;

    public function __construct()
    {
        $this->model = new Grid();
    }

    /** GET /api/grid */
    public function index(Request $request): never
    {
        Response::json($this->model->findAllLayouts());
    }

    /** GET /api/grid/{id} */
    public function show(Request $request, array $params): never
    {
        $layout = $this->model->findLayoutById((int) $params['id']);
        if ($layout === null) {
            Response::notFound('Grid layout not found');
        }
        $layout['cells'] = $this->model->getCells((int) $params['id']);
        Response::json($layout);
    }

    /** POST /api/grid */
    public function store(Request $request): never
    {
        $data = $request->getBody();
        $id   = $this->model->createLayout($data);
        $layout         = $this->model->findLayoutById($id);
        $layout['cells'] = [];
        Response::json($layout, 201);
    }

    /** PUT /api/grid/{id} */
    public function update(Request $request, array $params): never
    {
        $data = $request->getBody();
        if ($this->model->findLayoutById((int) $params['id']) === null) {
            Response::notFound('Grid layout not found');
        }
        if (!empty($data['cells']) && is_array($data['cells'])) {
            $this->model->saveCells((int) $params['id'], $data['cells']);
        }
        if (!empty($data['name']) || isset($data['cols']) || isset($data['rows'])) {
            $this->model->updateLayout((int) $params['id'], [
                'name'      => $data['name'] ?? 'Mon potager',
                'cols'      => $data['cols'] ?? 20,
                'rows'      => $data['rows'] ?? 15,
                'cell_size' => $data['cell_size'] ?? 30,
            ]);
        }
        $layout          = $this->model->findLayoutById((int) $params['id']);
        $layout['cells'] = $this->model->getCells((int) $params['id']);
        Response::json($layout);
    }

    /** DELETE /api/grid/{id}/cells */
    public function clearCells(Request $request, array $params): never
    {
        if ($this->model->findLayoutById((int) $params['id']) === null) {
            Response::notFound('Grid layout not found');
        }
        $this->model->clearCells((int) $params['id']);
        Response::json(['success' => true]);
    }

    /** DELETE /api/grid/{id} */
    public function destroy(Request $request, array $params): never
    {
        $id = (int) $params['id'];
        if ($this->model->findLayoutById($id) === null) {
            Response::notFound('Grid layout not found');
        }
        if ($this->model->hasCropAssignments($id)) {
            Response::error('Impossible de supprimer un plan auquel des cultures sont associées.', 409);
        }
        $this->model->deleteLayout($id);
        Response::json(['success' => true]);
    }

    /** GET /api/grid/{id}/crops?date=YYYY-MM-DD */
    public function getCrops(Request $request, array $params): never
    {
        if ($this->model->findLayoutById((int) $params['id']) === null) {
            Response::notFound('Grid layout not found');
        }
        $date = $request->queryParams['date'] ?? date('Y-m-d');
        Response::json($this->model->getCellsWithCrops((int) $params['id'], $date));
    }
}
