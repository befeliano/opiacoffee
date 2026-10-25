@echo off
REM Opia yerel geliştirme sunucusu -> http://localhost:8080  (yönetim: http://localhost:8080/admin/, bar: /admin/bar.php)
cd /d "%~dp0site"
"C:\Users\befes\php\php.exe" -d extension=pdo_sqlite -S 127.0.0.1:8080 router.php
