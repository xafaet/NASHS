<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('settings')) {
            Schema::create('settings', function (Blueprint $table) {
                $table->id();
                $table->string('key', 191)->unique();
                $table->longText('value')->nullable();
                $table->string('group', 100)->default('general')->index();
                $table->string('type', 50)->default('string');
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        // Seed registration_image_max_size (default 1.5MB)
        $exists = DB::table('settings')->where('key', 'registration_image_max_size')->exists();
        if (!$exists) {
            DB::table('settings')->insert([
                'key' => 'registration_image_max_size',
                'value' => '1.5',
                'group' => 'registration',
                'type' => 'numeric',
                'description' => 'Maximum allowed registration photograph file size in Megabytes (MB). Default: 1.5MB.',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
