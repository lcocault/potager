<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\Species;

class SpeciesController
{
    private Species $model;

    public function __construct()
    {
        $this->model = new Species();
    }

    /** GET /api/species */
    public function index(Request $request): never
    {
        Response::json($this->model->findAll());
    }

    /** GET /api/species/{id} */
    public function show(Request $request, array $params): never
    {
        $species = $this->model->findById((int) $params['id']);
        if ($species === null) {
            Response::notFound('Species not found');
        }
        Response::json($species);
    }

    /** POST /api/species */
    public function store(Request $request): never
    {
        $data = $request->getBody();
        if (empty($data['name'])) {
            Response::error('Field "name" is required');
        }
        $id      = $this->model->create($data);
        $species = $this->model->findById($id);
        Response::json($species, 201);
    }

    /** PUT /api/species/{id} */
    public function update(Request $request, array $params): never
    {
        $data = $request->getBody();
        if (empty($data['name'])) {
            Response::error('Field "name" is required');
        }
        if ($this->model->findById((int) $params['id']) === null) {
            Response::notFound('Species not found');
        }
        $this->model->update((int) $params['id'], $data);
        Response::json($this->model->findById((int) $params['id']));
    }

    /** DELETE /api/species/{id} */
    public function destroy(Request $request, array $params): never
    {
        if ($this->model->findById((int) $params['id']) === null) {
            Response::notFound('Species not found');
        }
        $this->model->delete((int) $params['id']);
        Response::json(['success' => true]);
    }
}
