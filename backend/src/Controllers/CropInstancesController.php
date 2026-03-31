<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\CropInstance;
use App\Models\CropPath;

class CropInstancesController
{
    private CropInstance $model;
    private CropPath $pathModel;

    public function __construct()
    {
        $this->model     = new CropInstance();
        $this->pathModel = new CropPath();
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

        // If a start_date is provided and the individual real dates are not set,
        // auto-calculate them from the itinerary's MM-DD offsets.
        if (!empty($data['start_date'])) {
            $path = $this->pathModel->findById((int) $data['crop_path_id']);
            if ($path !== null) {
                $data = $this->applyStartDate($data, $path);
            }
        }

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

    /**
     * Calculate real dates from a start_date and the itinerary's MM-DD dates.
     *
     * The start_date acts as the actual sowing date (anchor).  All other real
     * dates are shifted by the same number of days as the difference between
     * start_date and the itinerary's theoretical sowing date in the same year.
     * Only fields that are not already explicitly set in $data are filled.
     *
     * @param  array<string,mixed> $data  Request data (may already contain real_* dates)
     * @param  array<string,mixed> $path  Crop path record (with MM-DD date fields)
     * @return array<string,mixed>
     */
    private function applyStartDate(array $data, array $path): array
    {
        $startDate = $data['start_date'];
        try {
            $start = new \DateTime($startDate);
        } catch (\Throwable) {
            return $data;
        }

        $year = (int) $start->format('Y');

        // Determine anchor: the itinerary's sowing date in the same year
        $anchor = null;
        if (!empty($path['sowing_date'])) {
            $anchor = \DateTime::createFromFormat('Y-m-d', $year . '-' . $path['sowing_date']);
            if ($anchor === false) {
                $anchor = null;
            }
        }

        if ($anchor === null) {
            // No anchor – only fill real_sowing_date if not already set
            if (empty($data['real_sowing_date'])) {
                $data['real_sowing_date'] = $startDate;
            }
            return $data;
        }

        // Offset in days between actual start and theoretical anchor
        $diff       = $start->diff($anchor);
        $offsetDays = (int) $diff->days * ($start >= $anchor ? 1 : -1);

        $calcDate = function (?string $mmdd) use ($year, $offsetDays): ?string {
            if ($mmdd === null || $mmdd === '') {
                return null;
            }
            $dt = \DateTime::createFromFormat('Y-m-d', $year . '-' . $mmdd);
            if ($dt === false) {
                return null;
            }
            if ($offsetDays !== 0) {
                $dt->modify(($offsetDays > 0 ? '+' : '') . $offsetDays . ' days');
            }
            return $dt->format('Y-m-d');
        };

        // Only set a field if it was not explicitly provided in the request
        if (empty($data['real_sowing_date'])) {
            $data['real_sowing_date'] = $calcDate($path['sowing_date'] ?? null);
        }
        if (empty($data['real_transplant_date'])) {
            $data['real_transplant_date'] = $calcDate($path['transplant_date'] ?? null);
        }
        if (empty($data['real_planting_date'])) {
            $data['real_planting_date'] = $calcDate($path['planting_date'] ?? null);
        }
        if (empty($data['real_harvest_date'])) {
            $data['real_harvest_date'] = $calcDate($path['harvest_date'] ?? null);
        }

        return $data;
    }
}
