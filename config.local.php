<?php
defined('APP_SECURE_INIT') or die('Прямой доступ запрещен.');

return [
    'db' => [
        'host'     => 'localhost',
        'port'     => 3306,
        'dbname'   => 'urfu4onlin',
        'user'     => 'urfu4onlin',
        'password' => 'HYSYRGQVqQ6@UDDJ',
        'charset'  => 'utf8mb4'
    ],
    'app' => [
        'secret_key'   => 'c3f1a980e81b37d4e5f9a28b0d71a4329e1c0b8f1d2e3a4b5c6d7e8f9a0b1c2d',
        'runtime_dir'  => __DIR__ . '/runtime',
        'debug'        => false
    ],
    'google_maps' => [
        'api_key' => '',
    ],
    'yandex_maps' => [
        'api_key' => '6c559619-3826-40f2-8f33-d512b8cc9888',
    ],
    'gigachat' => [
        'authorization_key' => 'MDFhMDdiMDMtY2NkMS03ZDY4LTk1MDQtMGJkODE5NDI1MGZmOjQ4MmE3YmI5LTRiNzUtNGRhYS05ZTZmLTg1MDVjY2IwMWVhZA==',
        'base_url' => 'https://gigachat.devices.sberbank.ru/api/v1',
        'verify_ssl' => false,
        'model' => 'GigaChat',
        'scope' => 'GIGACHAT_API_PERS',
    ],
    'gemini' => [
        'api_key' => 'AQ.Ab8RN6LO-nhdON07GdR-KuAyJTLpNDHd22N6vklgWbg25VGcWw',
        'model' => 'gemini-2.5-flash'
    ]
];
