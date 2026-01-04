---
description: Fix XLS/JSON uploads and migrate database
---

1.  **Analyze Files**:
    -   [x] List files in `src`.
    -   [x] specific script to read XLS headers.
    -   [x] Read `members.json`.

2.  **Database Migration**:
    -   [ ] Create SQL migration to add `team` column to `members` table.
    -   [ ] Apply migration (simulated by creating the file in `supabase/migrations`).

3.  **Fix JSON Upload (`Members.tsx`)**:
    -   [ ] Update `Member` interface to include `team`.
    -   [ ] Update `handleFileUpload` to map `İsim Soyisim` -> `full_name` and `Ekip` -> `team`.
    -   [ ] Update UI to display and edit `team`.

4.  **Fix XLS Upload (`BankImport.tsx`)**:
    -   [ ] Update `handleFileUpload` to scan for header row (containing "Tarih/Saat").
    -   [ ] Implement auto-mapping for known İşBank columns.
    -   [ ] Handle date parsing for "dd/mm/yyyy-HH:MM:SS" format.

5.  **Verify**:
    -   [ ] dry-run logic check.
