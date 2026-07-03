# Task: Create 18 CALTEX MD WhatsApp Bot Command Module Files

## Summary
Created 18 complete command module files for the CALTEX MD WhatsApp bot plugin system. Each file exports a default Plugin object compatible with the existing plugin-loader.ts interface.

## Files Created
All files in `/home/z/my-project/src/lib/commands/`:

1. **repo.ts** - Repository info card (name, GitHub link, version, developer, license)
2. **update.ts** - Auto update system (update, checkupdate, version, rollback) - owner only
3. **premium.ts** - Premium management (premium, addpremium, delpremium, premiumlist) with plan tiers and duration parsing
4. **backup.ts** - Backup system (backup, restore, backuplist) with multiple backup types
5. **analytics.ts** - Bot analytics (stats, botstats, groupstats, userstats) with system metrics
6. **utility.ts** - Utility commands (runtime, system, health, speed, owner, donate, support, menu, about, changelog)
7. **reminder.ts** - Reminder system (remind, reminders) with flexible time parsing and recurring support
8. **notes.ts** - Notes system (note add/get/delete, notes) for personal note management
9. **autoreply.ts** - Auto-reply system (autoreply, setreply, delreply) with regex and group-specific rules
10. **afk.ts** - AFK system (afk, back) with duration tracking
11. **scheduler.ts** - Scheduler (schedule, listschedule, delschedule) for timed message delivery
12. **language.ts** - Multi-language (language, languages) with per-user/group preferences
13. **theme.ts** - Theme system (theme, themes) for menu display styling
14. **maintenance.ts** - Maintenance mode toggle (maintenance on/off/status) - owner only
15. **import-export.ts** - Configuration import/export (exportconfig, importconfig) as JSON
16. **apikeys.ts** - API key manager (apikeys, apikeyadd, apikeydel, apikeytoggle) with key masking
17. **plugin-manager.ts** - Plugin lifecycle (plugins, plugininfo, enableplugin, disableplugin, reloadplugin, reloadall, installplugin, removeplugin)
18. **group-analytics.ts** - Group analytics (gstats, gactivity, gtop) with activity tracking

## Technical Details
- All files import `type { Plugin, CommandContext }` from `../plugin-loader`
- Database access via `import { db } from '@/lib/db'`
- Proper error handling with try/catch in all handlers
- WhatsApp messages formatted with emojis and clean layout
- Owner/admin permission checks enforced
- Prisma schema already had all required tables (no schema changes needed)
- Lint passes with zero errors
