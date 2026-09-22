extends RefCounted

# The bundled Godot 4.6.1 Web runtime schedules file-system synchronization.
# JavaScriptBridge's local context can await that runtime's pending sync and
# explicitly flush this checkpoint before we tell the player it is saved.
static func begin() -> void:
	JavaScriptBridge.eval("""
	const request = { state: 0 };
	window.__genesisSaveSync = request;
	(async function () {
		try {
			if (typeof GodotFS === 'undefined' || typeof GodotOS === 'undefined') {
				request.state = -1;
				return;
			}
			// Serialize the engine's scheduled flushes with explicit saves. Its
			// default sync() otherwise resolves early if another flush is active.
			if (!GodotFS._genesisQueuedSync) {
				const originalSync = GodotFS.sync.bind(GodotFS);
				GodotFS.sync = function () {
					const job = (GodotFS._genesisSyncQueue || Promise.resolve())
						.catch(() => {}).then(async function () {
							while (GodotFS._syncing) {
								await new Promise(resolve => setTimeout(resolve, 20));
							}
							return originalSync();
						});
					GodotFS._genesisSyncQueue = job;
					return job;
				};
				GodotFS._genesisQueuedSync = true;
			}
			await GodotOS._fs_sync_promise;
			const sync = GodotFS.sync();
			GodotOS._fs_sync_promise = sync;
			const error = await sync;
			request.state = error ? -1 : 1;
		} catch (error) {
			request.state = -1;
		}
	})();
	""", false)

static func status() -> int:
	return int(JavaScriptBridge.eval("window.__genesisSaveSync ? window.__genesisSaveSync.state : -1", true))
