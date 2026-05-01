<?php
namespace App\Repositories;

use App\Config\Database;
use PDO;

final class TaskRepository {
    public function listByGroup(string $groupId): array {
        $pdo = Database::pdo();
        $st = $pdo->prepare('SELECT * FROM tasks WHERE group_id = ? ORDER BY rowid DESC');
        $st->execute([$groupId]);
        return $st->fetchAll(PDO::FETCH_ASSOC);
    }

    public function create(array $t): string {
        $pdo = Database::pdo();
        $id = bin2hex(random_bytes(16));
        $st = $pdo->prepare('INSERT INTO tasks (id, group_id, project_id, name, description, assignee_id, status, due_date) VALUES (?,?,?,?,?,?,?,?)');
        $st->execute([
            $id,
            $t['groupId'],
            $t['projectId'] ?? null,
            $t['name'],
            $t['description'] ?? null,
            $t['assigneeId'] ?? null,
            $t['status'] ?? 'todo',
            $t['dueDate'] ?? null,
        ]);
        return $id;
    }
}
