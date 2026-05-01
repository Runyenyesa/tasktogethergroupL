<?php
namespace App\Entities;

final class Task {
    public string $id;
    public string $groupId;
    public ?string $projectId = null;
    public string $name;
    public ?string $description = null;
    public ?string $assigneeId = null;
    public string $status = 'todo';
    public ?string $dueDate = null; // YYYY-MM-DD
}
