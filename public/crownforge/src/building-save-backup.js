import { BUILDING_ART_VERSION } from './building-depth-data.js?v=20260905-buildings1';

export const SAVE_KEY = 'crownforge-save-v1';
export const BUILDING_BACKUP_KEY = 'crownforge-save-before-building-depth-v1';
const BACKUP_POINTER = `${BUILDING_BACKUP_KEY}-latest`;

export function readSavedGameForBuildingUpgrade(storage) {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  const snapshot = JSON.parse(raw);
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.units) || !Array.isArray(snapshot.buildings)) return null;
  if (snapshot.buildingArtVersion !== BUILDING_ART_VERSION) {
    // Back up exact bytes before any in-memory conversion. Never overwrite the
    // first pre-upgrade save, including after the player saves the new layout.
    let key = BUILDING_BACKUP_KEY;
    // If a different legacy save is imported later, retain both originals.
    for (let index = 1; storage.getItem(key) != null && storage.getItem(key) !== raw; index++) key = `${BUILDING_BACKUP_KEY}-${index}`;
    if (storage.getItem(key) == null) storage.setItem(key, raw);
    const backup = storage.getItem(key);
    if (backup !== raw) throw new Error('Could not preserve the previous save exactly.');
    const verified = JSON.parse(backup);
    if (verified?.version !== 1 || !Array.isArray(verified.units) || !Array.isArray(verified.buildings)) throw new Error('Previous save backup could not be verified.');
    if (storage.getItem(SAVE_KEY) !== raw) throw new Error('The original save changed while being read.');
    storage.setItem(BACKUP_POINTER,key);
  }
  return snapshot;
}

export function previousBuildingSave(storage) {
  return storage.getItem(storage.getItem(BACKUP_POINTER) || BUILDING_BACKUP_KEY);
}

// Called only by the explicit Restore previous save control. This restores
// the stored bytes; the current running settlement is left in place.
export function restorePreviousBuildingSave(storage) {
  const original = previousBuildingSave(storage);
  if (!original) return false;
  const parsed = JSON.parse(original);
  if (parsed?.version !== 1 || !Array.isArray(parsed.units) || !Array.isArray(parsed.buildings)) return false;
  storage.setItem(SAVE_KEY, original);
  return storage.getItem(SAVE_KEY) === original;
}
