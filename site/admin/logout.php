<?php
require __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] === 'POST') { csrf_check(); $_SESSION = []; session_destroy(); }
redirect('/admin/login.php');
