<?php
namespace App\Core;

final class Router {
    private array $routes = [];

    public function get(string $path, $handler): void { $this->routes['GET'][$path] = $handler; }
    public function post(string $path, $handler): void { $this->routes['POST'][$path] = $handler; }
    public function patch(string $path, $handler): void { $this->routes['PATCH'][$path] = $handler; }

    public function dispatch(string $method, string $uri): void {
        $path = parse_url($uri, PHP_URL_PATH);
        foreach ($this->routes[$method] ?? [] as $pattern => $handler) {
            $regex = '#^' . preg_replace('#\\{(\\w+)\\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
            if (preg_match($regex, $path, $m)) {
                $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
                $this->invoke($handler, $params);
                return;
            }
        }
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Not found']);
    }

    private function invoke($handler, array $params): void {
        if (is_array($handler)) {
            [$class, $method] = $handler;
            $obj = new $class();
            $obj->$method($params);
            return;
        }
        call_user_func($handler, $params);
    }
}
