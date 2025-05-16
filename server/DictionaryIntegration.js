/**
 * Dictionary Integration Module for Flashcard App
 * Fetches audio pronunciations from Voice RSS API and images from Pixabay API.
 */

const MULTIMEDIA_CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Retrieves the Voice RSS API key from Script Properties.
 * @return {string|null} The API key or null if not found.
 * @private
 */
function getVoiceRssApiKey_() {
  // Retrieves the Voice RSS API key stored in Script Properties.
  // This key is necessary to authenticate requests to the Voice RSS API.
  return PropertiesService.getScriptProperties().getProperty('VOICERSS_API_KEY');
}

/**
 * Retrieves the Pixabay API key from Script Properties.
 * @return {string|null} The API key or null if not found.
 * @private
 */
function getPixabayApiKey_() {
  // Retrieves the Pixabay API key stored in Script Properties.
  // This key is necessary to authenticate requests to the Pixabay API.
  return PropertiesService.getScriptProperties().getProperty('PIXABAY_API_KEY');
}

/**
 * Fetches audio from Voice RSS API for a given word.
 *
 * @param {string} word - The word to get audio for.
 * @return {Object} { success: boolean, audioUrl?: string, message?: string }
 * audioUrl is a Base64 data URI if successful.
 * @private
 */
function fetchAudioFromVoiceRss_(word) {
  // Fetches audio pronunciation for the given word from the Voice RSS API.
  // Returns a Base64 encoded MP3 data URI.
  const apiKey = getVoiceRssApiKey_();
  if (!apiKey) {
    Logger.log('Voice RSS API key not found in Script Properties.');
    return { success: false, message: 'Audio service (VoiceRSS) not configured.' };
  }

  try {
    // Construct the API URL with necessary parameters.
    // hl=en-us: language English (US)
    // c=MP3: codec MP3
    // f=44khz_16bit_stereo: audio format
    // b64=true: response as Base64 data URI
    const apiUrl = `http://api.voicerss.org/?key=${apiKey}&hl=en-us&src=${encodeURIComponent(word)}&c=MP3&f=44khz_16bit_stereo&b64=true`;
    const response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true }); // muteHttpExceptions allows handling non-200 responses.
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      // Check if the response text itself is an error message from VoiceRSS.
      if (responseText.startsWith('ERROR')) {
        Logger.log(`Voice RSS API error for "${word}": ${responseText}`);
        return { success: false, message: `Audio generation failed for "${word}": ${responseText}` };
      }
      // If successful, the responseText is the Base64 data URI.
      Logger.log(`Voice RSS audio fetched successfully for "${word}".`);
      return { success: true, audioUrl: responseText };
    } else {
      Logger.log(`Voice RSS API request failed for "${word}". Code: ${responseCode}, Response: ${responseText}`);
      return { success: false, message: `Audio service request failed (Code: ${responseCode})` };
    }
  } catch (error) {
    Logger.log(`Error fetching audio from Voice RSS for "${word}": ${error.message}`);
    return { success: false, message: `Error fetching audio: ${error.message}` };
  }
}

/**
 * Fetches an image from Pixabay API for a given word.
 *
 * @param {string} word - The word to search an image for.
 * @return {Object} { success: boolean, imageUrl?: string, message?: string }
 * @private
 */
function fetchImageFromPixabay_(word) {
  // Fetches an image URL related to the given word from the Pixabay API.
  const apiKey = getPixabayApiKey_();
  if (!apiKey) {
    Logger.log('Pixabay API key not found in Script Properties.');
    return { success: false, message: 'Image service (Pixabay) not configured.' };
  }

  try {
    // Construct the API URL.
    // image_type=photo: search for photos
    // per_page=3: get a few results to pick from (we take the first)
    // safesearch=true: filter for safe content
    const apiUrl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(word)}&image_type=photo&per_page=3&safesearch=true`;
    const response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const data = JSON.parse(responseText);
      if (data.hits && data.hits.length > 0) {
        // Use webformatURL for a reasonably sized image.
        const imageUrl = data.hits[0].webformatURL; 
        Logger.log(`Pixabay image fetched successfully for "${word}": ${imageUrl}`);
        return { success: true, imageUrl: imageUrl };
      } else {
        Logger.log(`No images found on Pixabay for "${word}".`);
        return { success: false, message: `No image found for "${word}".` };
      }
    } else {
      Logger.log(`Pixabay API request failed for "${word}". Code: ${responseCode}, Response: ${responseText}`);
      return { success: false, message: `Image service request failed (Code: ${responseCode})` };
    }
  } catch (error) {
    Logger.log(`Error fetching image from Pixabay for "${word}": ${error.message}`);
    return { success: false, message: `Error fetching image: ${error.message}` };
  }
}

/**
 * Fetches multimedia content (audio URL and image URL) for a given word using APIs.
 *
 * @param {string} originalWord - The word to look up.
 * @return {Object} Object containing audio and image URLs, and success status.
 * @private
 */
function fetchMultimediaContentForWord_(originalWord) {
  // Normalizes the word and fetches both audio and image content.
  const normalizedWord = originalWord.toLowerCase().trim();

  const audioResult = fetchAudioFromVoiceRss_(normalizedWord);
  const imageResult = fetchImageFromPixabay_(normalizedWord);

  // Determine overall success and compile messages.
  let overallSuccess = audioResult.success || imageResult.success;
  let messages = [];
  if (!audioResult.success && audioResult.message) messages.push(`Audio: ${audioResult.message}`);
  if (!imageResult.success && imageResult.message) messages.push(`Image: ${imageResult.message}`);
  
  const finalMessage = overallSuccess ? 
                       (messages.length > 0 ? `Partial success. ${messages.join('; ')}` : "Content fetched successfully.") :
                       (messages.length > 0 ? messages.join('; ') : "Failed to fetch any content.");

  Logger.log(`Multimedia content fetched for "${originalWord}". Audio: ${audioResult.success}, Image: ${imageResult.success}`);
  return {
    success: overallSuccess,
    word: originalWord, // Return original word for display purposes
    audioUrl: audioResult.success ? audioResult.audioUrl : null,
    imageUrl: imageResult.success ? imageResult.imageUrl : null,
    message: finalMessage
  };
}

/**
 * Fetches and caches multimedia content (audio & image) in user properties.
 * Cache expires after MULTIMEDIA_CACHE_DURATION_MS.
 *
 * @param {string} word - The word to look up
 * @return {Object} Multimedia content
 */
function getCachedMultimediaContent(word) {
  // Retrieves multimedia content, using a cache to avoid redundant API calls.
  const normalizedWord = word.toLowerCase().trim();
  const userProperties = PropertiesService.getUserProperties(); // User-specific cache
  const cacheKey = `multimedia_v1_${normalizedWord}`; // Versioned cache key

  const cachedItem = userProperties.getProperty(cacheKey);

  if (cachedItem) {
    try {
      const parsedItem = JSON.parse(cachedItem);
      // Check if cache item exists and is not expired.
      if (parsedItem && parsedItem.timestamp && (Date.now() - parsedItem.timestamp < MULTIMEDIA_CACHE_DURATION_MS)) {
        Logger.log(`Cache hit for multimedia: "${normalizedWord}"`);
        return parsedItem.data;
      } else {
        Logger.log(`Cache expired or invalid for multimedia: "${normalizedWord}"`);
      }
    } catch (e) {
      Logger.log(`Error parsing cache for multimedia: "${normalizedWord}". Error: ${e.message}`);
      // If parsing fails, proceed to fetch fresh data.
    }
  } else {
     Logger.log(`Cache miss for multimedia: "${normalizedWord}"`);
  }

  // If cache miss or expired, fetch fresh content.
  const content = fetchMultimediaContentForWord_(word);

  // Cache the new content if successfully fetched (even partial success).
  if (content.success || content.audioUrl || content.imageUrl) { 
    try {
      const itemToCache = {
        data: content,
        timestamp: Date.now()
      };
      userProperties.setProperty(cacheKey, JSON.stringify(itemToCache));
      Logger.log(`Cached fresh multimedia content for: "${normalizedWord}"`);
    } catch (e) {
      Logger.log(`Error stringifying multimedia content for cache for word "${normalizedWord}". Error: ${e.message}`);
    }
  }
  return content;
}


/**
 * Checks a word and returns multimedia content for preview.
 * Accessible by admin users.
 *
 * @param {string} word - The word to look up
 * @return {Object} Multimedia content for preview
 */
function previewDictionaryContent(word) { 
  // Server-side function called by the client to get multimedia content.
  // Includes admin and login checks.
  try {
    const session = getUserSession(); // From Authentication.js
    if (!session || !session.userName) {
      return { success: false, message: 'You must be logged in to use these tools.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName); // From AdminTools.js
    if (!isAdmin) {
      return { success: false, message: 'Admin access required to use these tools.' };
    }

    if (!word || word.trim() === '') {
      return { success: false, message: 'Word is required for lookup.' };
    }

    return getCachedMultimediaContent(word.trim());
  } catch (error) {
    Logger.log(`Error previewing multimedia content for "${word}": ${error.message}`);
    return { success: false, message: `Server error previewing content: ${error.message}` };
  }
}

/**
 * Adds dictionary content (audio/image tags) to a flashcard's Side C.
 * Accessible by admin users.
 *
 * @param {string} deckName - Name of the deck
 * @param {string} cardId - ID of the flashcard
 * @param {string} word - The word whose content was looked up
 * @return {Object} Result of the operation
 */
function addDictionaryContentToCard(deckName, cardId, word) {
  // Adds multimedia tags to a specified card in a deck.
  // Includes admin and login checks.
  try {
    const session = getUserSession(); // From Authentication.js
    if (!session || !session.userName) {
      return { success: false, message: 'You must be logged in to modify cards.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName); // From AdminTools.js
    if (!isAdmin) {
      return { success: false, message: 'Admin access required to modify cards.' };
    }

    // Get (possibly cached) multimedia content for the word.
    const contentResult = getCachedMultimediaContent(word);

    // Only proceed if some content was actually found.
    if (!contentResult.success && !contentResult.audioUrl && !contentResult.imageUrl) { 
      return { success: false, message: contentResult.message || `No multimedia content could be fetched for "${word}".` };
    }

    const ss = getDatabaseSpreadsheet(); // From Database.js
    const deckSheet = ss.getSheetByName(deckName);

    if (!deckSheet) {
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    // Get sheet data and find the card.
    const data = deckSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idIndex = headers.indexOf('FlashcardID');
    const sideAIndex = headers.indexOf('FlashcardSideA'); 
    const sideCIndex = headers.indexOf('FlashcardSideC');

    // Validate required columns.
    if (idIndex === -1) return { success: false, message: 'FlashcardID column not found in deck.' };
    if (sideAIndex === -1) return { success: false, message: 'FlashcardSideA column not found (needed for source tag).' };
    if (sideCIndex === -1) return { success: false, message: 'FlashcardSideC column not found. Cannot add content.' };

    let cardRowIndex = -1;
    // let cardSideAValue = ''; // Not strictly needed here as word is passed in.
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        cardRowIndex = i;
        // cardSideAValue = data[i][sideAIndex] || word; 
        break;
      }
    }

    if (cardRowIndex === -1) {
      return { success: false, message: `Card "${cardId}" not found in deck "${deckName}".` };
    }

    // Construct multimedia tags.
    let multimediaTags = '';
    let sources = [];
    if (contentResult.audioUrl) {
      multimediaTags += `[AUDIO:${contentResult.audioUrl}] `;
      sources.push('VoiceRSS');
    }
    if (contentResult.imageUrl) {
      multimediaTags += `[IMAGE:${contentResult.imageUrl}] `;
      sources.push('Pixabay');
    }
    
    if (multimediaTags === '') { // Should not happen if initial check passed, but good safeguard.
        return { success: false, message: `No audio or image found for "${word}" to add.` };
    }
    
    // Add source information.
    const sourceString = sources.length > 0 ? `[Source: ${sources.join(', ')} for "${escapeHtmlServerSide(contentResult.word)}"]` : '';
    multimediaTags += sourceString;

    let existingSideC = data[cardRowIndex][sideCIndex] || '';
    
    // Remove any previous multimedia tags for the same word to avoid duplicates.
    // This regex attempts to match various combinations of old tags for the specific word.
    const oldTagsPatternGeneric = new RegExp(
        `\\[AUDIO:[^\\]]+?\\]\\s*(\\[IMAGE:[^\\]]+?\\]\\s*)?(\\[Source:[^\\]]+?for\\s*"${escapeRegex(contentResult.word)}"\\])?|` +
        `(\\[AUDIO:[^\\]]+?\\]\\s*)?\\[IMAGE:[^\\]]+?\\]\\s*(\\[Source:[^\\]]+?for\\s*"${escapeRegex(contentResult.word)}"\\])?|` +
        `(\\[AUDIO:[^\\]]+?\\]\\s*)?(\\[IMAGE:[^\\]]+?\\]\\s*)?\\[Source:[^\\]]+?for\\s*"${escapeRegex(contentResult.word)}"\\]`, 
    'gi');
    existingSideC = existingSideC.replace(oldTagsPatternGeneric, '').trim();

    // Append new tags to existing (cleaned) Side C content.
    const newSideC = (existingSideC ? existingSideC + '\n' : '') + multimediaTags.trim();

    deckSheet.getRange(cardRowIndex + 1, sideCIndex + 1).setValue(newSideC.trim());

    Logger.log(`Multimedia content for "${word}" added to card "${cardId}" by admin "${session.userName}".`);
    return {
      success: true,
      message: `Multimedia content for "${word}" added to card.`,
      contentAdded: multimediaTags,
    };

  } catch (error) {
    Logger.log(`Error in addDictionaryContentToCard: ${error.message} (Word: ${word}, Deck: ${deckName}, Card: ${cardId})`);
    return { success: false, message: `Server error adding multimedia content: ${error.message}` };
  }
}

/**
 * Renders content string with [AUDIO], [IMAGE], and [Source] tags into HTML.
 * @param {string} contentString - The raw content string from the sheet.
 * @return {string} HTML string with media tags rendered.
 */
function renderDictionaryContent(contentString) {
  // Converts custom tags like [AUDIO:...] and [IMAGE:...] into HTML.
  if (!contentString || typeof contentString !== 'string') return '';

  // Split the contentString by custom tags, keeping the tags as delimiters.
  const splitRegex = /(\[AUDIO:[^\]]+\]|\[IMAGE:[^\]]+\]|\[Source:[^\]]+\])/g;
  const tokens = contentString.split(splitRegex).filter(Boolean); // filter(Boolean) removes empty strings.

  let resultHtml = '';

  tokens.forEach(token => {
    if (token.startsWith('[AUDIO:')) {
      const url = token.substring(7, token.length - 1); 
      const safeUrl = escapeHtmlServerSide(url); // Escape URL for attribute.
      resultHtml += `
        <div class="flashcard-audio">
          <button class="audio-play-btn" data-audio-url="${safeUrl}">
            <span class="material-icons">play_arrow</span>
            <audio class="hidden-audio-element" src="${safeUrl}" preload="metadata"></audio>
          </button>
        </div>
      `;
    } else if (token.startsWith('[IMAGE:')) {
      const url = token.substring(8, token.length - 1); 
      let safeUrl = escapeHtmlServerSide(url); // Escape URL for attribute.

      // WORKAROUND for the 'ttps://' issue observed in logs.
      if (safeUrl.startsWith('ttps://')) {
          Logger.log(`WARNING: Detected 'ttps://' in image URL: ${safeUrl}. Correcting to 'https://'.`);
          safeUrl = 'h' + safeUrl; // Prepend 'h'
      } else if (safeUrl.startsWith('ttps%3A//')) { // Check for URL-encoded version
          Logger.log(`WARNING: Detected 'ttps%3A//' (encoded) in image URL: ${safeUrl}. Correcting.`);
          safeUrl = safeUrl.replace(/^ttps%3A\/\//, 'https%3A//');
      }

      resultHtml += `
        <div class="flashcard-image">
          <img src="${safeUrl}" alt="Illustration" class="centered-card-image" onerror="this.alt='Image failed to load'; this.src='https://placehold.co/300x200/eee/ccc?text=Image+Error'; console.error('Failed to load image:', this.src);">
        </div>
      `;
    } else if (token.startsWith('[Source:')) {
      // Source text is typically hidden by CSS on the flashcard.
      // If it were to be displayed, it would be handled here.
      // const sourceText = token.substring(8, token.length - 1);
      // resultHtml += `<span class="source-text">Source: ${escapeHtmlServerSide(sourceText)}</span>`;
    } else {
      // This is a plain text segment. Escape it and convert newlines.
      let textSegment = escapeHtmlServerSide(token);
      textSegment = textSegment.replace(/\r\n|\r|\n/g, '<br>'); 
      resultHtml += textSegment;
    }
  });

  return resultHtml;
}

/**
 * Server-side HTML escaping function.
 * CORRECTED VERSION
 * @param {string} str - The string to escape.
 * @return {string} The escaped string.
 */
function escapeHtmlServerSide(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;') // Correctly escape ampersands first.
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;'); // Standard HTML entity for single quote.
}

/**
 * Server-side HTML unescaping function (basic).
 * @param {string} str - The string to unescape.
 * @return {string} The unescaped string.
 */
function unescapeHtmlServerSide(str) {
  // Basic unescaping for text that might have been stored escaped.
  if (typeof str !== 'string') return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'") // Unescape single quote.
    .replace(/&amp;/g, '&'); // Unescape ampersands last.
}

/**
 * Escapes a string for use in a regular expression.
 * @param {string} str - The string to escape.
 * @return {string} The regex-escaped string.
 */
function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  // Escapes special characters so they are treated literally in a regex.
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
