<?php
namespace App\Config;

use PDO; use PDOException;

final class Database {
    private static ?PDO $pdo = null;

    public static function pdo(): PDO {
        if (self::$pdo) return self::$pdo;

        $dsn = $_ENV['DB_DSN'] ?? '';

        if ($dsn === '' || str_starts_with($dsn, 'sqlite:')) {
            // Default to SQLite file in storage/database.sqlite
            $base = dirname(__DIR__, 2);
            $storage = $base . DIRECTORY_SEPARATOR . 'storage';
            if (!is_dir($storage)) @mkdir($storage, 0777, true);
            $dbFile = $storage . DIRECTORY_SEPARATOR . 'database.sqlite';
            if ($dsn === '') $dsn = 'sqlite:' . $dbFile;
            self::$pdo = new PDO($dsn);
            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            self::$pdo->exec('PRAGMA foreign_keys = ON');
            self::ensureSchema();
            return self::$pdo;
        }

        try {
            self::$pdo = new PDO($dsn, $_ENV['DB_USER'] ?? null, $_ENV['DB_PASS'] ?? null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            return self::$pdo;
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'DB connection failed', 'detail' => $e->getMessage()]);
            exit;
        }
    }

    private static function ensureSchema(): void {
        $sql = [
            'CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT, created_at INTEGER)',
            'CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE)',
            'CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, project_id TEXT, name TEXT NOT NULL, description TEXT, assignee_id TEXT, status TEXT NOT NULL DEFAULT "todo", due_date TEXT, FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE)',
            'CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id)'
        ];
        foreach ($sql as $stmt) self::$pdo->exec($stmt);
    }
}
