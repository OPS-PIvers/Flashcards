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
  return PropertiesService.getScriptProperties().getProperty('VOICERSS_API_KEY');
}

/**
 * Retrieves the Pixabay API key from Script Properties.
 * @return {string|null} The API key or null if not found.
 * @private
 */
function getPixabayApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('PIXABAY_API_KEY');
}

/**
 * Fetches audio from Voice RSS API for a given word.
 *
 * @param {string} word - The word to get audio for.
 * @return {Object} { success: boolean, audioUrl?: string, message?: string }
 *                  audioUrl is a Base64 data URI if successful.
 * @private
 */
function fetchAudioFromVoiceRss_(word) {
  const apiKey = getVoiceRssApiKey_();
  if (!apiKey) {
    Logger.log('Voice RSS API key not found in Script Properties.');
    return { success: false, message: 'Audio service (VoiceRSS) not configured.' };
  }

  try {
    const apiUrl = `http://api.voicerss.org/?key=${apiKey}&hl=en-us&src=${encodeURIComponent(word)}&c=MP3&f=44khz_16bit_stereo&b64=true`;
    const response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      if (responseText.startsWith('ERROR')) {
        Logger.log(`Voice RSS API error for "${word}": ${responseText}`);
        return { success: false, message: `Audio generation failed for "${word}": ${responseText}` };
      }
      // responseText is already the Base64 data URI
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
  const apiKey = getPixabayApiKey_();
  if (!apiKey) {
    Logger.log('Pixabay API key not found in Script Properties.');
    return { success: false, message: 'Image service (Pixabay) not configured.' };
  }

  try {
    const apiUrl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(word)}&image_type=photo&per_page=3&safesearch=true`;
    const response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const data = JSON.parse(responseText);
      if (data.hits && data.hits.length > 0) {
        const imageUrl = data.hits[0].webformatURL; // Or .largeImageURL for higher res
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
  const normalizedWord = originalWord.toLowerCase().trim();

  const audioResult = fetchAudioFromVoiceRss_(normalizedWord);
  const imageResult = fetchImageFromPixabay_(normalizedWord);

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
    word: originalWord,
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
  const normalizedWord = word.toLowerCase().trim();
  const userProperties = PropertiesService.getUserProperties();
  const cacheKey = `multimedia_v1_${normalizedWord}`;

  const cachedItem = userProperties.getProperty(cacheKey);

  if (cachedItem) {
    try {
      const parsedItem = JSON.parse(cachedItem);
      if (parsedItem && parsedItem.timestamp && (Date.now() - parsedItem.timestamp < MULTIMEDIA_CACHE_DURATION_MS)) {
        Logger.log(`Cache hit for multimedia: "${normalizedWord}"`);
        return parsedItem.data;
      } else {
        Logger.log(`Cache expired or invalid for multimedia: "${normalizedWord}"`);
      }
    } catch (e) {
      Logger.log(`Error parsing cache for multimedia: "${normalizedWord}". Error: ${e.message}`);
    }
  } else {
     Logger.log(`Cache miss for multimedia: "${normalizedWord}"`);
  }

  const content = fetchMultimediaContentForWord_(word); // Use original word for messages

  if (content.success) { // Cache even if only partial success
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
function previewDictionaryContent(word) { // Renamed to match client calls
  try {
    const session = getUserSession();
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
  try {
    const session = getUserSession();
    if (!session || !session.userName) {
      return { success: false, message: 'You must be logged in to modify cards.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName); // From AdminTools.js
    if (!isAdmin) {
      return { success: false, message: 'Admin access required to modify cards.' };
    }

    const contentResult = getCachedMultimediaContent(word);

    if (!contentResult.success && !contentResult.audioUrl && !contentResult.imageUrl) { // Only return error if nothing was found
      return { success: false, message: contentResult.message || `No multimedia content could be fetched for "${word}".` };
    }

    const ss = getDatabaseSpreadsheet();
    const deckSheet = ss.getSheetByName(deckName);

    if (!deckSheet) {
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const data = deckSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idIndex = headers.indexOf('FlashcardID');
    const sideAIndex = headers.indexOf('FlashcardSideA'); // Needed for source tag
    const sideCIndex = headers.indexOf('FlashcardSideC');

    if (idIndex === -1) return { success: false, message: 'FlashcardID column not found in deck.' };
    if (sideAIndex === -1) return { success: false, message: 'FlashcardSideA column not found (needed for source tag).' };
    if (sideCIndex === -1) return { success: false, message: 'FlashcardSideC column not found. Cannot add content.' };

    let cardRowIndex = -1;
    let cardSideAValue = '';
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        cardRowIndex = i;
        cardSideAValue = data[i][sideAIndex] || word; // Fallback to looked-up word if SideA is empty
        break;
      }
    }

    if (cardRowIndex === -1) {
      return { success: false, message: `Card "${cardId}" not found in deck "${deckName}".` };
    }

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
    
    if (multimediaTags === '') {
        return { success: false, message: `No audio or image found for "${word}" to add.` };
    }
    
    const sourceString = sources.length > 0 ? `[Source: ${sources.join(', ')} for "${contentResult.word}"]` : '';
    multimediaTags += sourceString;

    let existingSideC = data[cardRowIndex][sideCIndex] || '';
    
    // Remove any previous multimedia tags for the same word to avoid duplicates
    const oldTagsPatternGeneric = new RegExp(
        `\\[AUDIO:[^\\]]+?\\]\\s*(\\[IMAGE:[^\\]]+?\\]\\s*)?(\\[Source:[^\\]]+?for "${escapeRegex(contentResult.word)}"\\])?|` +
        `(\\[AUDIO:[^\\]]+?\\]\\s*)?\\[IMAGE:[^\\]]+?\\]\\s*(\\[Source:[^\\]]+?for "${escapeRegex(contentResult.word)}"\\])?|` +
        `(\\[AUDIO:[^\\]]+?\\]\\s*)?(\\[IMAGE:[^\\]]+?\\]\\s*)?\\[Source:[^\\]]+?for "${escapeRegex(contentResult.word)}"\\]`, 
    'gi');
    existingSideC = existingSideC.replace(oldTagsPatternGeneric, '').trim();

    const newSideC = (existingSideC ? existingSideC + '\n' : '') + multimediaTags.trim();

    deckSheet.getRange(cardRowIndex + 1, sideCIndex + 1).setValue(newSideC.trim());

    Logger.log(`Multimedia content for "${word}" added to card "${cardId}" by admin "${session.userName}".`);
    return {
      success: true,
      message: `Multimedia content for "${word}" added to card.`,
      contentAdded: multimediaTags,
    };

  } catch (error)
  {
    Logger.log(`Error in addDictionaryContentToCard: ${error.message} (Word: ${word}, Deck: ${deckName}, Card: ${cardId})`);
    return { success: false, message: `Server error adding multimedia content: ${error.message}` };
  }
}

function renderDictionaryContent(sideCContent) {
  if (!sideCContent) return '';

  let processedHtml = escapeHtmlServerSide(sideCContent);

  // Process [AUDIO:...] tags with simplified player
  const audioPattern = /\[AUDIO:([^\]]+)\]/g;
  processedHtml = processedHtml.replace(audioPattern, (match, url) => {
    const unescapedUrl = unescapeHtmlServerSide(url);
    return `
      <div class="flashcard-audio">
        <button class="audio-play-btn" data-audio-url="${unescapedUrl}">
          <span class="material-icons">play_arrow</span>
          <audio class="hidden-audio-element" src="${unescapedUrl}" preload="auto"></audio>
        </button>
      </div>
    `;
  });

  // Process [IMAGE:...] tags with centered image
  const imagePattern = /\[IMAGE:([^\]]+)\]/g;
  processedHtml = processedHtml.replace(imagePattern, (match, url) => {
    const unescapedUrl = unescapeHtmlServerSide(url);
    return `
      <div class="flashcard-image">
        <img src="${unescapedUrl}" alt="Illustration" class="centered-card-image">
      </div>
    `;
  });
  
  // Process [Source:...] tags
  const sourcePattern = /\[Source:([^\]]+)\]/g;
  processedHtml = processedHtml.replace(sourcePattern, (match, sourceText) => {
    const unescapedSourceText = unescapeHtmlServerSide(sourceText);
    return `<span class="source-text">Source: ${unescapedSourceText}</span>`;
  });

  // Replace newlines with <br> for better display
  processedHtml = processedHtml.replace(/\n/g, '<br>');

  return processedHtml;
}

/**
 * Server-side HTML escaping function.
 * @param {string} str - The string to escape.
 * @return {string} The escaped string.
 */
function escapeHtmlServerSide(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;'); // Added apostrophe escaping
}

/**
 * Server-side HTML unescaping function (basic).
 * @param {string} str - The string to unescape.
 * @return {string} The unescaped string.
 */
function unescapeHtmlServerSide(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&/g, '&'); // Ampersand must be last
}

/**
 * Escapes a string for use in a regular expression.
 * @param {string} str - The string to escape.
 * @return {string} The regex-escaped string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}