<?php

declare(strict_types=1);

return [
    'host'     => getenv('DB_HOST')     ?: 'localhost',
    'port'     => getenv('DB_PORT')     ?: '5432',
    'dbname'   => getenv('DB_NAME')     ?: 'potager',
    'user'     => getenv('DB_USER')     ?: 'potager_user',
    'password' => getenv('DB_PASSWORD') ?: '',
];
