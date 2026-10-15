<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

/**
 * AnimationSettingsController
 *
 * Provides API endpoints for retrieving and managing the website's
 * global and component-level animation configuration.
 *
 * Persisted in the `site_settings` database table (key: 'animations_config')
 * with automatic file-based JSON fallback and cache invalidation.
 */
class AnimationSettingsController extends Controller
{
    /**
     * Cache key and storage settings.
     */
    protected const SETTING_KEY = 'animations_config';
    protected const CACHE_KEY = 'site_settings_animations_config';
    protected const CACHE_TTL_SECONDS = 3600; // 1 hour

    /**
     * Predefined default animation configuration.
     */
    protected array $defaultSettings = [
        'is_enabled'                 => true,
        'preset'                     => 'smooth', // 'minimal' | 'subtle' | 'smooth' | 'dynamic' | 'disabled'
        'duration'                   => 0.5,
        'default_delay'              => 0.0,
        'stagger_delay'              => 0.08,
        'scroll_triggered'           => true,
        'hover_effects'              => true,
        'play_mode'                  => 'once',   // 'once' | 'repeat'
        'intensity'                  => 'standard', // 'subtle' | 'standard' | 'high'
        'respect_reduced_motion'     => true,

        // Component & Page level toggles
        'enable_homepage'            => true,
        'enable_header_nav'          => true,
        'enable_hero_animations'     => true,
        'enable_stats_cards'         => true,
        'enable_notices_news'        => true,
        'enable_events_schedule'     => true,
        'enable_forms_inputs'        => true,
        'enable_member_portal'       => true,
        'enable_admin_interface'     => true,
        'enable_page_transitions'    => true,
        'enable_card_reveals'        => true,
        'enable_button_hover'        => true,
        'enable_counter_animations'  => true,
    ];

    /**
     * GET /api/appearance/animations
     *
     * Retrieve the active animation settings for public frontend and client components.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        try {
            $settings = Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function () {
                return $this->loadSettingsFromStore();
            });

            return response()->json($settings, 200, [
                'Cache-Control' => 'public, max-age=60, stale-while-revalidate=120'
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to load animation settings from DB, using defaults: ' . $e->getMessage());
            return response()->json($this->defaultSettings, 200);
        }
    }

    /**
     * PUT /api/admin/appearance/animations
     *
     * Update animation settings. Requires authorized administrator access.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function update(Request $request): JsonResponse
    {
        // 1. Enforce Role-Based Authorization
        $user = $request->user();
        $allowedRoles = ['super_admin', 'admin', 'content_manager'];

        if ($user && !in_array($user->role ?? '', $allowedRoles)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized: Administrator privileges required to modify appearance settings.'
            ], 403);
        }

        // 2. Strict Input Validation with Allowlist
        $validator = Validator::make($request->all(), [
            'is_enabled'                => 'required|boolean',
            'preset'                    => 'required|string|in:minimal,subtle,smooth,dynamic,energetic,disabled',
            'duration'                  => 'required|numeric|min:0.1|max:2.0',
            'default_delay'             => 'nullable|numeric|min:0.0|max:1.5',
            'stagger_delay'             => 'required|numeric|min:0.02|max:0.5',
            'scroll_triggered'          => 'nullable|boolean',
            'hover_effects'             => 'nullable|boolean',
            'play_mode'                 => 'nullable|string|in:once,repeat',
            'intensity'                 => 'nullable|string|in:subtle,standard,high',
            'respect_reduced_motion'    => 'nullable|boolean',

            // Page and component settings
            'enable_homepage'           => 'nullable|boolean',
            'enable_header_nav'         => 'nullable|boolean',
            'enable_hero_animations'    => 'nullable|boolean',
            'enable_stats_cards'        => 'nullable|boolean',
            'enable_notices_news'       => 'nullable|boolean',
            'enable_events_schedule'    => 'nullable|boolean',
            'enable_forms_inputs'       => 'nullable|boolean',
            'enable_member_portal'      => 'nullable|boolean',
            'enable_admin_interface'    => 'nullable|boolean',
            'enable_page_transitions'   => 'nullable|boolean',
            'enable_card_reveals'       => 'nullable|boolean',
            'enable_button_hover'       => 'nullable|boolean',
            'enable_counter_animations' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors'  => $validator->errors()
            ], 422);
        }

        $validated = $validator->validated();
        $currentSettings = $this->loadSettingsFromStore();

        // 3. Normalize & Merge Payload
        $newSettings = array_merge($currentSettings, [
            'is_enabled'                => (bool)$validated['is_enabled'],
            'preset'                    => (string)$validated['preset'],
            'duration'                  => round((float)$validated['duration'], 2),
            'default_delay'             => isset($validated['default_delay']) ? round((float)$validated['default_delay'], 2) : 0.0,
            'stagger_delay'             => round((float)$validated['stagger_delay'], 2),
            'scroll_triggered'          => isset($validated['scroll_triggered']) ? (bool)$validated['scroll_triggered'] : true,
            'hover_effects'             => isset($validated['hover_effects']) ? (bool)$validated['hover_effects'] : true,
            'play_mode'                 => $validated['play_mode'] ?? 'once',
            'intensity'                 => $validated['intensity'] ?? 'standard',
            'respect_reduced_motion'    => isset($validated['respect_reduced_motion']) ? (bool)$validated['respect_reduced_motion'] : true,

            'enable_homepage'           => isset($validated['enable_homepage']) ? (bool)$validated['enable_homepage'] : true,
            'enable_header_nav'         => isset($validated['enable_header_nav']) ? (bool)$validated['enable_header_nav'] : true,
            'enable_hero_animations'    => isset($validated['enable_hero_animations']) ? (bool)$validated['enable_hero_animations'] : true,
            'enable_stats_cards'        => isset($validated['enable_stats_cards']) ? (bool)$validated['enable_stats_cards'] : true,
            'enable_notices_news'       => isset($validated['enable_notices_news']) ? (bool)$validated['enable_notices_news'] : true,
            'enable_events_schedule'    => isset($validated['enable_events_schedule']) ? (bool)$validated['enable_events_schedule'] : true,
            'enable_forms_inputs'       => isset($validated['enable_forms_inputs']) ? (bool)$validated['enable_forms_inputs'] : true,
            'enable_member_portal'      => isset($validated['enable_member_portal']) ? (bool)$validated['enable_member_portal'] : true,
            'enable_admin_interface'    => isset($validated['enable_admin_interface']) ? (bool)$validated['enable_admin_interface'] : true,
            'enable_page_transitions'   => isset($validated['enable_page_transitions']) ? (bool)$validated['enable_page_transitions'] : true,
            'enable_card_reveals'       => isset($validated['enable_card_reveals']) ? (bool)$validated['enable_card_reveals'] : true,
            'enable_button_hover'       => isset($validated['enable_button_hover']) ? (bool)$validated['enable_button_hover'] : true,
            'enable_counter_animations' => isset($validated['enable_counter_animations']) ? (bool)$validated['enable_counter_animations'] : true,
            'updated_at'                => now()->toIso8601String(),
        ]);

        // 4. Persist to Database & System Store
        $this->saveSettingsToStore($newSettings);

        // 5. Invalidate Cache
        Cache::forget(self::CACHE_KEY);

        // 6. Log Audit Entry if Audit System Exists
        try {
            DB::table('audit_logs')->insert([
                'user_name'  => $user->name ?? 'Admin',
                'user_email' => $user->email ?? 'admin@nashsians.com',
                'action'     => 'UPDATE_ANIMATIONS',
                'entity'     => 'Appearance',
                'details'    => sprintf(
                    'Updated animations configuration (Enabled: %s, Preset: %s, Duration: %ss)',
                    $newSettings['is_enabled'] ? 'Yes' : 'No',
                    $newSettings['preset'],
                    $newSettings['duration']
                ),
                'ip'         => $request->ip() ?? '127.0.0.1',
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Silently ignore if audit_logs table is optional
        }

        return response()->json($newSettings, 200);
    }

    /**
     * POST /api/admin/appearance/animations/reset
     *
     * Reset animation configuration to default system values.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function reset(Request $request): JsonResponse
    {
        $user = $request->user();
        $allowedRoles = ['super_admin', 'admin'];

        if ($user && !in_array($user->role ?? '', $allowedRoles)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized: Only Super Administrators can reset appearance defaults.'
            ], 403);
        }

        $defaults = array_merge($this->defaultSettings, [
            'updated_at' => now()->toIso8601String(),
        ]);

        $this->saveSettingsToStore($defaults);
        Cache::forget(self::CACHE_KEY);

        return response()->json($defaults, 200);
    }

    /**
     * Retrieve settings from database or fallback JSON store.
     *
     * @return array
     */
    protected function loadSettingsFromStore(): array
    {
        try {
            // Priority 1: Check site_settings table
            if (DB::getSchemaBuilder()->hasTable('site_settings')) {
                $record = DB::table('site_settings')
                    ->where('key', self::SETTING_KEY)
                    ->first();

                if ($record && !empty($record->value)) {
                    $decoded = json_decode($record->value, true);
                    if (is_array($decoded)) {
                        return array_merge($this->defaultSettings, $decoded);
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::debug('site_settings table lookup failed, checking local JSON store: ' . $e->getMessage());
        }

        // Priority 2: Fallback to local settings JSON store
        $fallbackPaths = [
            storage_path('app/settings.json'),
            base_path('data/settings.json'),
            base_path('data/db.json'),
        ];

        foreach ($fallbackPaths as $path) {
            if (file_exists($path)) {
                $content = @file_get_contents($path);
                if ($content) {
                    $json = json_decode($content, true);
                    if (isset($json[self::SETTING_KEY]) && is_array($json[self::SETTING_KEY])) {
                        return array_merge($this->defaultSettings, $json[self::SETTING_KEY]);
                    }
                }
            }
        }

        return $this->defaultSettings;
    }

    /**
     * Save settings to database and fallback store.
     *
     * @param array $settings
     * @return void
     */
    protected function saveSettingsToStore(array $settings): void
    {
        $encoded = json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        // 1. Save to site_settings table
        try {
            if (DB::getSchemaBuilder()->hasTable('site_settings')) {
                DB::table('site_settings')->updateOrInsert(
                    ['key' => self::SETTING_KEY],
                    ['value' => $encoded, 'updated_at' => now()]
                );
                return;
            }
        } catch (\Throwable $e) {
            Log::warning('Could not write to site_settings table: ' . $e->getMessage());
        }

        // 2. Fallback: Save to settings.json file
        $storageDir = storage_path('app');
        if (!is_dir($storageDir)) {
            @mkdir($storageDir, 0755, true);
        }

        $jsonFile = $storageDir . '/settings.json';
        $current = [];
        if (file_exists($jsonFile)) {
            $current = json_decode(file_get_contents($jsonFile), true) ?: [];
        }

        $current[self::SETTING_KEY] = $settings;
        @file_put_contents($jsonFile, json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }
}
