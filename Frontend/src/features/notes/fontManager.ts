import * as FileSystem from 'expo-file-system/legacy';
import * as Font from 'expo-font';

export interface OnDemandFont {
  id: string;
  label: string;
  regularName: string;
  boldName: string;
  regularUrl: string;
  boldUrl: string;
}

export const ON_DEMAND_FONTS: OnDemandFont[] = [
  {
    id: 'Roboto',
    label: 'Roboto',
    regularName: 'Roboto_400Regular',
    boldName: 'Roboto_700Bold',
    regularUrl: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbVmUiA8.ttf',
    boldUrl: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjalmUiA8.ttf',
  },
  {
    id: 'Montserrat',
    label: 'Montserrat',
    regularName: 'Montserrat_400Regular',
    boldName: 'Montserrat_700Bold',
    regularUrl: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aX8.ttf',
    boldUrl: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM73w5aX8.ttf',
  },
  {
    id: 'Lora',
    label: 'Lora',
    regularName: 'Lora_400Regular',
    boldName: 'Lora_700Bold',
    regularUrl: 'https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787weuxJBkqg.ttf',
    boldUrl: 'https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787z5vBJBkqg.ttf',
  },
  {
    id: 'Playfair Display',
    label: 'Playfair Display',
    regularName: 'PlayfairDisplay_400Regular',
    boldName: 'PlayfairDisplay_700Bold',
    regularUrl: 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.ttf',
    boldUrl: 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiunDXbtY.ttf',
  },
];

const FONTS_DIR = `${FileSystem.documentDirectory}fonts/`;

// Helper to ensure fonts directory exists
async function ensureDirectoryExists() {
  const dirInfo = await FileSystem.getInfoAsync(FONTS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(FONTS_DIR, { intermediates: true });
  }
}

// Get local paths for a font family
function getLocalUris(font: OnDemandFont) {
  return {
    regular: `${FONTS_DIR}${font.regularName}.ttf`,
    bold: `${FONTS_DIR}${font.boldName}.ttf`,
  };
}

// Check if a font is fully downloaded
export async function isFontDownloaded(fontId: string): Promise<boolean> {
  const font = ON_DEMAND_FONTS.find(f => f.id === fontId);
  if (!font) return true; // System fonts or unsupported fonts are considered downloaded

  try {
    const { regular, bold } = getLocalUris(font);
    const regInfo = await FileSystem.getInfoAsync(regular);
    const boldInfo = await FileSystem.getInfoAsync(bold);
    return !!(regInfo.exists && boldInfo.exists);
  } catch (error) {
    console.error(`Error checking font download status for ${fontId}:`, error);
    return false;
  }
}

// Download font files
export async function downloadFont(
  fontId: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  const font = ON_DEMAND_FONTS.find(f => f.id === fontId);
  if (!font) return true;

  try {
    await ensureDirectoryExists();
    const { regular, bold } = getLocalUris(font);

    // Track progress of both downloads
    let regProgress = 0;
    let boldProgress = 0;
    const updateProgress = () => {
      if (onProgress) {
        onProgress((regProgress + boldProgress) / 2);
      }
    };

    const regResumable = FileSystem.createDownloadResumable(
      font.regularUrl,
      regular,
      {},
      (downloadProgress) => {
        regProgress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        updateProgress();
      }
    );

    const boldResumable = FileSystem.createDownloadResumable(
      font.boldUrl,
      bold,
      {},
      (downloadProgress) => {
        boldProgress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        updateProgress();
      }
    );

    await Promise.all([
      regResumable.downloadAsync(),
      boldResumable.downloadAsync(),
    ]);

    return true;
  } catch (error) {
    console.error(`Error downloading font ${fontId}:`, error);
    return false;
  }
}

// Load a downloaded font into expo-font
export async function loadFont(fontId: string): Promise<boolean> {
  const font = ON_DEMAND_FONTS.find(f => f.id === fontId);
  if (!font) return true;

  try {
    const { regular, bold } = getLocalUris(font);
    const isDownloaded = await isFontDownloaded(fontId);
    if (!isDownloaded) {
      console.warn(`Font ${fontId} is not downloaded yet.`);
      return false;
    }

    const fontsToLoad: Record<string, string> = {};
    if (!Font.isLoaded(font.regularName)) {
      fontsToLoad[font.regularName] = regular;
    }
    if (!Font.isLoaded(font.boldName)) {
      fontsToLoad[font.boldName] = bold;
    }

    if (Object.keys(fontsToLoad).length > 0) {
      await Font.loadAsync(fontsToLoad);
    }
    return true;
  } catch (error) {
    console.error(`Error loading font ${fontId} into expo-font:`, error);
    return false;
  }
}

// Auto-load all already downloaded fonts on startup
export async function loadAllDownloadedFonts(): Promise<void> {
  try {
    await ensureDirectoryExists();
    for (const font of ON_DEMAND_FONTS) {
      const downloaded = await isFontDownloaded(font.id);
      if (downloaded) {
        await loadFont(font.id);
      }
    }
  } catch (error) {
    console.error('Error auto-loading downloaded fonts:', error);
  }
}
