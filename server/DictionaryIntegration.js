/**
 * Dictionary Integration Module for Flashcard App
 * Fetches audio pronunciations and images from Merriam-Webster dictionary
 *
 * !!! IMPORTANT WARNING !!!
 * This module relies on web scraping the Merriam-Webster dictionary website.
 * The structure of external websites can change at any time without notice.
 * If Merriam-Webster updates their website's HTML, the functions
 * `fetchDictionaryContent`, `extractAudioUrl`, and `extractImageUrl`
 * are HIGHLY LIKELY TO BREAK.
 *
 * For a more robust solution, consider using an official API if available.
 * This implementation is provided as a demonstration and may require
 * frequent maintenance if the source website changes.
 * !!! END WARNING !!!
 */

const DICTIONARY_CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Fetches dictionary content (audio URL and image URL) for a given word
 *
 * @param {string} word - The word to look up
 * @return {Object} Object containing audio and image URLs
 */
function fetchDictionaryContent(word) {
  try {
    // Normalize the word (lowercase, trim, replace spaces with hyphens)
    const normalizedWord = word.toLowerCase().trim().replace(/\s+/g, '-');

    // Construct the dictionary URL
    const dictionaryUrl = `https://www.merriam-webster.com/dictionary/${normalizedWord}`;

    // Fetch the dictionary page
    const response = UrlFetchApp.fetch(dictionaryUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
    });

    // Check if request was successful
    if (response.getResponseCode() !== 200) {
      return {
        success: false,
        message: `Failed to fetch dictionary entry for "${word}". Response code: ${response.getResponseCode()}`,
      };
    }

    // Get the page content
    const content = response.getContentText();

    // Extract audio URL
    const audioUrl = extractAudioUrl(content, normalizedWord);

    // Extract image URL
    const imageUrl = extractImageUrl(content, normalizedWord);

    Logger.log(`Dictionary content fetched for "${word}". Audio: ${audioUrl ? 'Found' : 'Not found'}, Image: ${imageUrl ? 'Found' : 'Not found'}`);

    return {
      success: true,
      word: word,
      audioUrl: audioUrl,
      imageUrl: imageUrl,
      sourceUrl: dictionaryUrl,
    };
  } catch (error) {
    Logger.log(`Error fetching dictionary content for "${word}": ${error.message}`);
    return {
      success: false,
      message: `Error fetching dictionary content: ${error.message}`,
    };
  }
}

/**
 * Extracts the audio URL from the dictionary page content
 *
 * @param {string} content - The HTML content of the dictionary page
 * @param {string} word - The normalized word
 * @return {string|null} The audio URL or null if not found
 */
function extractAudioUrl(content, word) {
  try {
    const firstLetter = word.charAt(0);
    // Updated regex to be more flexible with audio file naming patterns
    // This pattern looks for data-hw (headword), data-lang, data-dir, and data-file attributes
    // common in Merriam-Webster audio player elements.
    const audioPlayerPattern = /<a[^>]*?class="hw_pron_sound.*?data-file="([^"]+)".*?data-dir="([^"]+)".*?<\/a>/is;
    let match = content.match(audioPlayerPattern);

    if (match && match[1] && match[2]) {
        const audioFile = match[1];
        const audioDir = match[2];
        // Construct the URL. Subdirectory might be part of dir (e.g. "gg") or just first letter.
        // URL format: https://media.merriam-webster.com/audio/prons/en/us/mp3/{dir}/{file}.mp3
        // Sometimes the dir in data-dir is just the first letter, sometimes it's a subfolder like "bix", "gg", etc.
        // The audio file itself often starts with the word.
        // Example: https://media.merriam-webster.com/audio/prons/en/us/mp3/d/dog00001.mp3
        return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${audioDir}/${audioFile}.mp3`;
    }

    // Fallback: Original pattern if the above fails.
    // This is less reliable as MW has updated their audio delivery.
    const legacyAudioPattern = new RegExp(`\\?pronunciation&lang=en_us&dir=${firstLetter}&file=(${word}\\d+|${word.substring(0,5)}[a-zA-Z0-9]{3})`, 'i');
    match = content.match(legacyAudioPattern);

    if (match && match[1]) {
      return `https://www.merriam-webster.com/dictionary/${word}?pronunciation&lang=en_us&dir=${firstLetter}&file=${match[1]}`;
    }
    
    // Try to find a direct mp3 link if possible (less common now)
    const directMp3Pattern = new RegExp(`(https?://media.merriam-webster.com/audio/prons/en/us/mp3/${firstLetter}/[${word.substring(0,2)}].*?\\.mp3)`, 'i');
    match = content.match(directMp3Pattern);
    if (match && match[1]) {
        return match[1];
    }

    return null;
  } catch (error) {
    Logger.log(`Error extracting audio URL for "${word}": ${error.message}`);
    return null;
  }
}

/**
 * Extracts the image URL from the dictionary page content
 *
 * @param {string} content - The HTML content of the dictionary page
 * @param {string} word - The normalized word (unused in current patterns but kept for context)
 * @return {string|null} The image URL or null if not found
 */
function extractImageUrl(content, word) {
  try {
    // Pattern to match the image URL in the HTML (often in art-wrapper or similar divs)
    // Looking for <img src="URL_TO_IMAGE" class="art- અહીં" ...>
    // Or <img data-src="URL_TO_IMAGE" ...>
    // Illustrations are less consistently available than audio.
    const imagePattern = /<img\s+(?:alt="Illustration of[^"]*"\s+)?(?:class="[^"]*art[^"]*"\s+)?(?:data-src|src)="([^"]+)"[^>]*>/i;
    const match = content.match(imagePattern);

    if (match && match[1]) {
      // Ensure it's a full URL
      if (match[1].startsWith('http')) {
        return match[1];
      } else if (match[1].startsWith('/')) {
        return `https://www.merriam-webster.com${match[1]}`; // Prepend domain if relative
      }
    }
    
    // A more specific pattern for images within certain figure tags or divs
    const figureImagePattern = /<figure[^>]*>.*?<img\s+src="([^"]+)".*?<\/figure>/is;
    const figureMatch = content.match(figureImagePattern);
    if (figureMatch && figureMatch[1]) {
         if (figureMatch[1].startsWith('http')) {
            return figureMatch[1];
        } else if (figureMatch[1].startsWith('/')) {
            return `https://www.merriam-webster.com${figureMatch[1]}`;
        }
    }

    return null;
  } catch (error) {
    Logger.log(`Error extracting image URL for "${word}": ${error.message}`);
    return null;
  }
}

/**
 * Fetches and caches dictionary content in user properties.
 * Cache expires after DICTIONARY_CACHE_DURATION_MS.
 *
 * @param {string} word - The word to look up
 * @return {Object} Dictionary content
 */
function getCachedDictionaryContent(word) {
  const normalizedWord = word.toLowerCase().trim();
  const userProperties = PropertiesService.getUserProperties();
  const cacheKey = `dict_v2_${normalizedWord}`; // v2 to invalidate old cache format

  const cachedItem = userProperties.getProperty(cacheKey);

  if (cachedItem) {
    try {
      const parsedItem = JSON.parse(cachedItem);
      if (parsedItem && parsedItem.timestamp && (Date.now() - parsedItem.timestamp < DICTIONARY_CACHE_DURATION_MS)) {
        Logger.log(`Cache hit for dictionary word: "${normalizedWord}"`);
        return parsedItem.data; // Return only the data part
      } else {
        Logger.log(`Cache expired or invalid for dictionary word: "${normalizedWord}"`);
      }
    } catch (e) {
      Logger.log(`Error parsing cache for dictionary word: "${normalizedWord}". Error: ${e.message}`);
      // Invalid cache, will fetch fresh data
    }
  } else {
     Logger.log(`Cache miss for dictionary word: "${normalizedWord}"`);
  }

  // Fetch fresh content
  const content = fetchDictionaryContent(normalizedWord); // fetchDictionaryContent expects non-normalized word for messages

  // Cache successful results
  if (content.success) {
    try {
      const itemToCache = {
        data: content,
        timestamp: Date.now()
      };
      userProperties.setProperty(cacheKey, JSON.stringify(itemToCache));
      Logger.log(`Cached fresh dictionary content for: "${normalizedWord}"`);
    } catch (e) {
      Logger.log(`Error stringifying content for cache for word "${normalizedWord}". Error: ${e.message} Content: ${JSON.stringify(content)}`);
      // If stringify fails, don't break, just don't cache.
    }
  }
  
  return content;
}


/**
 * Test function to verify dictionary integration
 *
 * @param {string} word - The word to test
 * @return {Object} Test results
 */
function testDictionaryIntegration(word) {
  return getCachedDictionaryContent(word);
}

/**
 * Adds dictionary content to a flashcard's Side C
 *
 * @param {string} deckName - Name of the deck
 * @param {string} cardId - ID of the flashcard
 * @param {string} word - The word to add content for
 * @return {Object} Result of the operation
 */
function addDictionaryContentToCard(deckName, cardId, word) {
  try {
    // CRITICAL FIX: Use direct admin check instead of isUserAdmin()
    const session = getUserSession();
    if (!session || !session.userName) {
      return { success: false, message: 'You must be logged in to modify cards.' };
    }
    
    // Use the forceAdminCheck function from AdminTools.js
    const isAdmin = forceAdminCheck(session.userName);
    if (!isAdmin) {
      return { success: false, message: 'Admin access required to modify cards.' };
    }

    const contentResult = getCachedDictionaryContent(word);

    if (!contentResult.success) {
      return contentResult; // Return the error from dictionary lookup
    }

    const ss = getDatabaseSpreadsheet(); // Assumes getDatabaseSpreadsheet is defined
    const deckSheet = ss.getSheetByName(deckName);

    if (!deckSheet) {
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const data = deckSheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('FlashcardID');
    const sideCIndex = headers.indexOf('FlashcardSideC');

    if (idIndex === -1) {
      return { success: false, message: 'FlashcardID column not found in deck.' };
    }
    if (sideCIndex === -1) {
      return { success: false, message: 'FlashcardSideC column not found in deck. Cannot add dictionary content.' };
    }

    let cardRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        cardRowIndex = i; // 0-based index for data array
        break;
      }
    }

    if (cardRowIndex === -1) {
      return { success: false, message: `Card "${cardId}" not found in deck "${deckName}".` };
    }

    let dictionaryTags = '';
    if (contentResult.audioUrl) {
      dictionaryTags += `[AUDIO:${contentResult.audioUrl}] `;
    }
    if (contentResult.imageUrl) {
      dictionaryTags += `[IMAGE:${contentResult.imageUrl}] `;
    }
    
    if (dictionaryTags === '') {
        return { success: false, message: `No audio or image found for "${word}" to add.` };
    }
    
    dictionaryTags += `[Source: Merriam-Webster for "${contentResult.word}"]`;


    // Get existing Side C content
    let existingSideC = data[cardRowIndex][sideCIndex] || '';
    
    // Remove any previous dictionary tags for the same word to avoid duplicates
    const oldTagsPattern = new RegExp(`\\[AUDIO:[^\\]]*?\\]\\s*\\[IMAGE:[^\\]]*?\\]\\s*\\[Source: Merriam-Webster for "${contentResult.word}"\\]|\\[AUDIO:[^\\]]*?\\]\\s*\\[Source: Merriam-Webster for "${contentResult.word}"\\]|\\[IMAGE:[^\\]]*?\\]\\s*\\[Source: Merriam-Webster for "${contentResult.word}"\\]`, 'gi');
    existingSideC = existingSideC.replace(oldTagsPattern, '').trim();

    // Append new dictionary content
    const newSideC = (existingSideC ? existingSideC + ' ' : '') + dictionaryTags.trim();

    deckSheet.getRange(cardRowIndex + 1, sideCIndex + 1).setValue(newSideC.trim()); // +1 for 1-based sheet row

    return {
      success: true,
      message: `Dictionary content for "${word}" added to card.`,
      contentAdded: dictionaryTags,
    };

  } catch (error) {
    Logger.log(`Error in addDictionaryContentToCard: ${error.message} (Word: ${word}, Deck: ${deckName}, Card: ${cardId})`);
    return { success: false, message: `Server error adding dictionary content: ${error.message}` };
  }
}


/**
 * Renders dictionary content in flashcard view
 *
 * @param {string} sideC - The sideC content containing dictionary markers
 * @return {string} Processed HTML content
 */
function renderDictionaryContent(sideC) {
  if (!sideC) return '';

  let processedContent = escapeHtml(sideC); // Escape first to prevent XSS from non-dictionary content

  // Process audio tags
  const audioPattern = /\[AUDIO:([^\]]+)\]/g;
  processedContent = processedContent.replace(audioPattern, (match, url) => {
    const unescapedUrl = url.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, "'");
    return `
      <div class="flashcard-audio">
        <audio controls style="width:100%;">
          <source src="${unescapedUrl}" type="audio/mpeg">
          Your browser does not support audio.
        </audio>
      </div>
    `;
  });

  // Process image tags
  const imagePattern = /\[IMAGE:([^\]]+)\]/g;
  processedContent = processedContent.replace(imagePattern, (match, url) => {
    const unescapedUrl = url.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, "'");
    return `
      <div class="flashcard-image">
        <img src="${unescapedUrl}" alt="Dictionary illustration" style="max-width: 100%; max-height: 150px; height: auto; object-fit: contain;">
      </div>
    `;
  });
  
  // Process source tags to make them less prominent or style them
  const sourcePattern = /\[Source:([^\]]+)\]/g;
  processedContent = processedContent.replace(sourcePattern, (match, sourceText) => {
      return `<span style="font-size: 0.7em; color: #777; display: block; text-align: right;">Source: ${sourceText.replace(/&/g, '&')}</span>`;
  });


  return processedContent;
}

// Helper function, should be in a utility file or main.html if used client-side
// For server-side rendering, this is fine here or in a server-side utility.
function escapeHtml(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
}


/**
 * Checks a word in the dictionary and returns content for preview
 *
 * @param {string} word - The word to look up
 * @return {Object} Dictionary content for preview
 */
function previewDictionaryContent(word) {
  try {
    // CRITICAL FIX: Use direct admin check instead of isUserAdmin()
    const session = getUserSession();
    if (!session || !session.userName) {
      return { success: false, message: 'You must be logged in to use dictionary tools.' };
    }
    
    // Use the forceAdminCheck function from AdminTools.js
    const isAdmin = forceAdminCheck(session.userName);
    if (!isAdmin) {
      return { success: false, message: 'Admin access required to use dictionary tools.' };
    }

    if (!word || word.trim() === '') {
      return { success: false, message: 'Word is required for dictionary lookup.' };
    }

    return getCachedDictionaryContent(word.trim());
  } catch (error) {
    Logger.log(`Error previewing dictionary content for "${word}": ${error.message}`);
    return { success: false, message: `Server error previewing dictionary content: ${error.message}` };
  }
}