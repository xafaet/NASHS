<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AnimationSettingsController;

/*
|--------------------------------------------------------------------------
| API Routes - Appearance & Animations Engine
|--------------------------------------------------------------------------
|
| These routes handle retrieval of animation preferences for the frontend
| and administrative modification by authorized users.
|
*/

// Public endpoint for frontend clients & Framer Motion MotionContext
Route::get('/appearance/animations', [AnimationSettingsController::class, 'index']);

// Protected admin endpoints
Route::middleware(['auth:sanctum'])->group(function () {
    Route::put('/admin/appearance/animations', [AnimationSettingsController::class, 'update']);
    Route::post('/admin/appearance/animations/reset', [AnimationSettingsController::class, 'reset']);
});
