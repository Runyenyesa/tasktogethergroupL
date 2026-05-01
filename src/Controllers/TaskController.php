<?php
namespace App\Controllers;

use App\Repositories\TaskRepository;

final class TaskController {
    private TaskRepository $repo;

    public function __construct() { $this->repo = new TaskRepository(); }

    public function list(array $params): void {
        header('Content-Type: application/json');
        $gid = $params['id'] ?? '';
        echo json_encode($this->repo->listByGroup($gid));
    }

    public function create(array $params): void {
        header('Content-Type: application/json');
        $gid = $params['id'] ?? '';
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (!isset($body['name']) || trim($body['name']) === '') {
            http_response_code(400);
            echo json_encode(['error' => 'name is required']);
            return;
        }
        $body['groupId'] = $gid;
        $id = $this->repo->create($body);
        http_response_code(201);
        echo json_encode(['id' => $id]);
    }
}
