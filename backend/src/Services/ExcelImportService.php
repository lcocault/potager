<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\CropPath;
use App\Models\Species;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as SpreadsheetDate;

class ExcelImportService
{
    private CropPath $cropPathModel;
    private Species $speciesModel;

    public function __construct()
    {
        $this->cropPathModel = new CropPath();
        $this->speciesModel  = new Species();
    }

    /**
     * Expected columns (case-insensitive, order doesn't matter):
     * espece | species       - species name (required)
     * nom    | name          - itinerary name (required)
     * semis  | sowing_date   - sowing date
     * condition | sowing_condition
     * repiquage | transplant_date
     * plantation | planting_date
     * recolte | harvest_date
     * notes
     *
     * @return array{imported:int, errors:list<string>, paths:list<array<string,mixed>>}
     */
    public function import(string $filePath): array
    {
        $spreadsheet = IOFactory::load($filePath);
        $sheet       = $spreadsheet->getActiveSheet();
        $rows        = $sheet->toArray(null, true, true, true);

        if (empty($rows)) {
            throw new \RuntimeException('The file is empty');
        }

        // First row = headers
        $headers = array_map(
            fn($h) => strtolower(trim((string) ($h ?? ''))),
            array_shift($rows)
        );

        $colMap = $this->buildColumnMap($headers);

        $imported = 0;
        $errors   = [];
        $paths    = [];

        foreach ($rows as $rowIndex => $row) {
            $lineNum = $rowIndex + 2; // +2 because row 1 was headers
            try {
                $data = $this->mapRow($row, $colMap);
                if ($data === null) {
                    continue; // skip empty rows
                }
                // Resolve species
                $speciesId             = $this->speciesModel->findOrCreate($data['species_name']);
                $data['species_id']    = $speciesId;
                unset($data['species_name']);

                $id      = $this->cropPathModel->create($data);
                $path    = $this->cropPathModel->findById($id);
                $paths[] = $path;
                $imported++;
            } catch (\Throwable $e) {
                $errors[] = "Line $lineNum: " . $e->getMessage();
            }
        }

        return [
            'imported' => $imported,
            'errors'   => $errors,
            'paths'    => $paths,
        ];
    }

    /** @param list<string> $headers */
    private function buildColumnMap(array $headers): array
    {
        $map = [];
        $synonyms = [
            'species_name'     => ['espece', 'espèce', 'species', 'plante'],
            'name'             => ['nom', 'name', 'itineraire', 'itinéraire'],
            'sowing_date'      => ['semis', 'sowing_date', 'date_semis', 'date semis'],
            'sowing_condition' => ['condition', 'conditions', 'sowing_condition', 'type_semis'],
            'transplant_date'  => ['repiquage', 'transplant_date', 'date_repiquage'],
            'planting_date'    => ['plantation', 'planting_date', 'mise_en_terre'],
            'harvest_date'     => ['recolte', 'récolte', 'harvest_date', 'date_recolte'],
            'notes'            => ['notes', 'remarques', 'commentaires'],
        ];

        foreach ($headers as $colLetter => $header) {
            foreach ($synonyms as $field => $aliases) {
                if (in_array($header, $aliases, true)) {
                    $map[$field] = $colLetter;
                    break;
                }
            }
        }
        return $map;
    }

    /** @return array<string,mixed>|null */
    private function mapRow(array $row, array $colMap): ?array
    {
        $speciesName = isset($colMap['species_name']) ? trim((string) ($row[$colMap['species_name']] ?? '')) : '';
        $name        = isset($colMap['name'])         ? trim((string) ($row[$colMap['name']] ?? ''))         : '';

        if ($speciesName === '' && $name === '') {
            return null; // empty row
        }
        if ($speciesName === '') {
            throw new \InvalidArgumentException('Species/espece column is required');
        }
        if ($name === '') {
            $name = $speciesName . ' - import';
        }

        $data = [
            'species_name'     => $speciesName,
            'name'             => $name,
            'sowing_date'      => $this->parseDate($row[$colMap['sowing_date'] ?? ''] ?? null),
            'sowing_condition' => $this->parseSowingCondition($row[$colMap['sowing_condition'] ?? ''] ?? null),
            'transplant_date'  => $this->parseDate($row[$colMap['transplant_date'] ?? ''] ?? null),
            'planting_date'    => $this->parseDate($row[$colMap['planting_date'] ?? ''] ?? null),
            'harvest_date'     => $this->parseDate($row[$colMap['harvest_date'] ?? ''] ?? null),
            'notes'            => isset($colMap['notes']) ? ($row[$colMap['notes']] ?? null) : null,
        ];
        return $data;
    }

    private function parseDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        // Numeric = Excel serial date
        if (is_numeric($value)) {
            try {
                $date = SpreadsheetDate::excelToDateTimeObject((float) $value);
                return $date->format('m-d');
            } catch (\Throwable) {
                return null;
            }
        }
        // Try to parse string date – unambiguous ISO format is preferred
        $formats = ['Y-m-d', 'd/m/Y', 'd-m-Y', 'm-d'];
        foreach ($formats as $format) {
            $dt = \DateTime::createFromFormat($format, trim((string) $value));
            if ($dt !== false) {
                return $dt->format('m-d');
            }
        }
        return null;
    }

    private function parseSowingCondition(mixed $value): string
    {
        if ($value === null || $value === '') {
            return 'pleine_terre';
        }
        $normalized = strtolower(trim((string) $value));
        $map = [
            'pleine terre'       => 'pleine_terre',
            'pleine_terre'       => 'pleine_terre',
            'serre froide'       => 'godet_serre_froide',
            'godet serre froide' => 'godet_serre_froide',
            'godet_serre_froide' => 'godet_serre_froide',
            'serre chauffee'     => 'godet_serre_chauffee',
            'serre chauffée'     => 'godet_serre_chauffee',
            'godet_serre_chauffee' => 'godet_serre_chauffee',
            'chassis'            => 'sous_chassis',
            'sous chassis'       => 'sous_chassis',
            'sous_chassis'       => 'sous_chassis',
            'interieur'          => 'interieur',
            'intérieur'          => 'interieur',
        ];
        return $map[$normalized] ?? 'pleine_terre';
    }
}
