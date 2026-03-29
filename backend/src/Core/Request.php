<?php

declare(strict_types=1);

namespace App\Core;

class Request
{
    public readonly string $method;
    public readonly string $path;
    /** @var array<string,string> */
    public readonly array $queryParams;
    /** @var array<string,mixed> */
    private array $body;

    public function __construct()
    {
        $this->method      = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $this->path        = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $this->queryParams = $_GET;
        $this->body        = $this->parseBody();
    }

    /** @return array<string,mixed> */
    private function parseBody(): array
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (str_contains($contentType, 'application/json')) {
            $raw = file_get_contents('php://input');
            return (array) json_decode($raw ?: '{}', true);
        }
        return $_POST;
    }

    /** @return array<string,mixed> */
    public function getBody(): array
    {
        return $this->body;
    }

    public function getBodyParam(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }
}
