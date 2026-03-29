<?php

declare(strict_types=1);

use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Controllers\SpeciesController;
use App\Controllers\CropPathsController;
use App\Controllers\CropInstancesController;
use App\Controllers\GridController;

require_once __DIR__ . '/../vendor/autoload.php';

// Error handling
set_error_handler(static function (int $errno, string $errstr): bool {
    throw new \ErrorException($errstr, 0, $errno);
});

set_exception_handler(static function (\Throwable $e): never {
    Response::serverError($e->getMessage());
});

$request = new Request();
$router  = new Router();

// ── Species ───────────────────────────────────────────────
$router->get('/api/species', function (Request $req) {
    (new SpeciesController())->index($req);
});
$router->get('/api/species/{id}', function (Request $req, array $p) {
    (new SpeciesController())->show($req, $p);
});
$router->post('/api/species', function (Request $req) {
    (new SpeciesController())->store($req);
});
$router->put('/api/species/{id}', function (Request $req, array $p) {
    (new SpeciesController())->update($req, $p);
});
$router->delete('/api/species/{id}', function (Request $req, array $p) {
    (new SpeciesController())->destroy($req, $p);
});

// ── Crop Paths ────────────────────────────────────────────
$router->get('/api/crop-paths', function (Request $req) {
    (new CropPathsController())->index($req);
});
$router->get('/api/crop-paths/{id}', function (Request $req, array $p) {
    (new CropPathsController())->show($req, $p);
});
$router->post('/api/crop-paths', function (Request $req) {
    (new CropPathsController())->store($req);
});
$router->post('/api/crop-paths/import', function (Request $req) {
    (new CropPathsController())->import($req);
});
$router->put('/api/crop-paths/{id}', function (Request $req, array $p) {
    (new CropPathsController())->update($req, $p);
});
$router->delete('/api/crop-paths/{id}', function (Request $req, array $p) {
    (new CropPathsController())->destroy($req, $p);
});

// ── Crop Instances ────────────────────────────────────────
$router->get('/api/crop-instances', function (Request $req) {
    (new CropInstancesController())->index($req);
});
$router->get('/api/crop-instances/{id}', function (Request $req, array $p) {
    (new CropInstancesController())->show($req, $p);
});
$router->post('/api/crop-instances', function (Request $req) {
    (new CropInstancesController())->store($req);
});
$router->put('/api/crop-instances/{id}', function (Request $req, array $p) {
    (new CropInstancesController())->update($req, $p);
});
$router->delete('/api/crop-instances/{id}', function (Request $req, array $p) {
    (new CropInstancesController())->destroy($req, $p);
});

// ── Grid ──────────────────────────────────────────────────
$router->get('/api/grid', function (Request $req) {
    (new GridController())->index($req);
});
$router->get('/api/grid/{id}', function (Request $req, array $p) {
    (new GridController())->show($req, $p);
});
$router->post('/api/grid', function (Request $req) {
    (new GridController())->store($req);
});
$router->put('/api/grid/{id}', function (Request $req, array $p) {
    (new GridController())->update($req, $p);
});
$router->delete('/api/grid/{id}/cells', function (Request $req, array $p) {
    (new GridController())->clearCells($req, $p);
});
$router->get('/api/grid/{id}/crops', function (Request $req, array $p) {
    (new GridController())->getCrops($req, $p);
});

$router->dispatch($request);
