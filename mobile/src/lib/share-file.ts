import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Hand a file the API built (the export, the import template) to Android's share sheet — the
 * phone's twin of the web's saveFile, which hands it to the browser's download.
 *
 * A phone has no downloads folder an app can simply drop a file into, and asking for storage
 * access to make one would be a permission for a convenience. The share sheet already offers
 * every place the file could usefully go — Files ("Save to device"), Drive, Sheets, email, chat —
 * and needs no permission at all. The bytes are written to the app's cache first, which Android
 * clears on its own when space runs low; the same name is overwritten on the next export.
 */
export async function shareFile(bytes: Uint8Array, name: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  await file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}
