# Backend PHP App InDeep Booking
# Image minimal: PHP 8.3 CLI + ekstensi pdo_mysql (PDO MySQL sesuai stack PRD).
# Zero framework, zero Composer — semua query pakai PDO native (PRD Bab 14.1).
FROM php:8.3-cli

# Waktu WIB sesuai PRD Bab 15 (semua waktu simpan WIB)
ENV TZ=Asia/Jakarta
RUN echo 'date.timezone = Asia/Jakarta' > /usr/local/etc/php/conf.d/timezone.ini

# Ekstensi wajib buat koneksi MySQL InnoDB
RUN docker-php-ext-install pdo_mysql

WORKDIR /app
