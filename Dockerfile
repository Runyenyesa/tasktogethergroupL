FROM php:8.2-cli

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends git unzip zip libzip-dev libsqlite3-dev && \
    docker-php-ext-install zip pdo pdo_sqlite pdo_mysql && \
    rm -rf /var/lib/apt/lists/*

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

COPY . /app

RUN composer update --no-dev --prefer-dist --no-interaction --optimize-autoloader

RUN mkdir -p /app/storage && chmod 777 /app/storage

EXPOSE 10000

CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-10000} -t public"]
