# Building artwork save compatibility

The user authorized the full artwork, hitbox integration, push and deployment on 2026-09-05. This release preserves all loaded building, resource-site and character coordinates. It does not perform a layout migration.

Older saves are backed up as their exact serialized bytes before Load or an explicit Save can replace the ordinary save key. Backup writes are read back and verified. Distinct imported legacy saves receive separate backups; the first original is never overwritten. Download original save and Restore original save file are explicit controls under Atmosphere. Restoring changes the stored file only; the running settlement continues until the player chooses Load.

Automatic approval review rejected a proposed saved-layout migration twice: first because backup and rollback safeguards were insufficient, then because relocating saved buildings, resources and characters required explicit approval. The user was asked about a precise backed-up migration; no answer has arrived. That optional migration is excluded, while the independently authorized artwork and gameplay release proceeds.

If subsequently approved, migration must operate on a staged clone, keep roads, walls, gates and Hall anchors fixed, move only conflicts to nearby clear positions, and preserve all IDs, stock, supplies, health, queues, cargo, technologies and elapsed progress. Failure must leave both running state and persistent original untouched. Identity/economy preservation, conflict clearance, idempotence and rollback checks are required before its release.
