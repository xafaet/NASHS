<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AnimationSettingsController;
use App\Http\Controllers\DatabaseDiagnosticController;

/*
|--------------------------------------------------------------------------
| API Routes - Nanupur Abu Sobhan High School Alumni Platform
|--------------------------------------------------------------------------
*/

// Appearance & Animations Engine
Route::get('/appearance/animations', [AnimationSettingsController::class, 'index']);

// Protected admin endpoints
Route::middleware(['auth:sanctum'])->group(function () {
    Route::put('/admin/appearance/animations', [AnimationSettingsController::class, 'update']);
    Route::post('/admin/appearance/animations/reset', [AnimationSettingsController::class, 'reset']);
});

// Database Connection Diagnostic Endpoints
// Logs database configuration (excluding password) and credential origins to storage/logs/database-connection-diagnostic.log
Route::get('/system/db-diagnostic', [DatabaseDiagnosticController::class, 'diagnose']);
Route::post('/system/db-diagnostic/log', [DatabaseDiagnosticController::class, 'logDiagnostic']);
