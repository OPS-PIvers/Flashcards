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
    Logger.log('DictionaryIntegration.js: fetchAudioFromVoiceRss_ - Voice RSS API key not found.');
    return { success: false, message: 'Audio service (VoiceRSS) not configured.' };
  }

  try {
    const apiUrl = `http://api.voicerss.org/?key=${apiKey}&hl=en-us&src=${encodeURIComponent(word)}&c=MP3&f=44khz_16bit_stereo&b64=true`;
    Logger.log(`DictionaryIntegration.js: fetchAudioFromVoiceRss_ - Fetching URL: ${apiUrl.substring(0, apiUrl.indexOf("&src=") + 5)}...`);
    const response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      if (responseText.startsWith('ERROR')) {
        Logger.log(`DictionaryIntegration.js: fetchAudioFromVoiceRss_ - Voice RSS API error for "${word}": ${responseText}`);
        return { success: false, message: `Audio generation failed for "${word}": ${responseText}` };
      }
      Logger.log(`DictionaryIntegration.js: fetchAudioFromVoiceRss_ - Voice RSS audio fetched successfully for "${word}". Length: ${responseText.length}`);
      return { success: true, audioUrl: responseText };
    } else {
      Logger.log(`DictionaryIntegration.js: fetchAudioFromVoiceRss_ - Voice RSS API request failed for "${word}". Code: ${responseCode}, Response: ${responseText}`);
      return { success: false, message: `Audio service request failed (Code: ${responseCode})` };
    }
  } catch (error) {
    Logger.log(`DictionaryIntegration.js: fetchAudioFromVoiceRss_ - Error fetching audio for "${word}": ${error.message}`);
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
    Logger.log('DictionaryIntegration.js: fetchImageFromPixabay_ - Pixabay API key not found.');
    return { success: false, message: 'Image service (Pixabay) not configured.' };
  }

  try {
    const apiUrl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(word)}&image_type=photo&per_page=3&safesearch=true`;
    Logger.log(`DictionaryIntegration.js: fetchImageFromPixabay_ - Fetching URL: ${apiUrl.substring(0, apiUrl.indexOf("&q=") + 3)}...`);
    const response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const data = JSON.parse(responseText);
      if (data.hits && data.hits.length > 0) {
        const imageUrl = data.hits[0].webformatURL; 
        Logger.log(`DictionaryIntegration.js: fetchImageFromPixabay_ - Pixabay image fetched successfully for "${word}": ${imageUrl}`);
        return { success: true, imageUrl: imageUrl };
      } else {
        Logger.log(`DictionaryIntegration.js: fetchImageFromPixabay_ - No images found on Pixabay for "${word}".`);
        return { success: false, message: `No image found for "${word}".` };
      }
    } else {
      Logger.log(`DictionaryIntegration.js: fetchImageFromPixabay_ - Pixabay API request failed for "${word}". Code: ${responseCode}, Response: ${responseText}`);
      return { success: false, message: `Image service request failed (Code: ${responseCode})` };
    }
  } catch (error) {
    Logger.log(`DictionaryIntegration.js: fetchImageFromPixabay_ - Error fetching image for "${word}": ${error.message}`);
    return { success: false, message: `Error fetching image: ${error.message}` };
  }
}

/**
 * Fetches multimedia content (audio URL and image URL) for a given word using APIs.
 * @param {string} originalWord - The word to look up.
 * @return {Object} Object containing audio and image URLs, and success status.
 * @private
 */
function fetchMultimediaContentForWord_(originalWord) {
  const normalizedWord = originalWord.toLowerCase().trim();
  Logger.log(`DictionaryIntegration.js: fetchMultimediaContentForWord_ - Fetching for word: "${originalWord}" (normalized: "${normalizedWord}")`);

  const audioResult = fetchAudioFromVoiceRss_(normalizedWord);
  const imageResult = fetchImageFromPixabay_(normalizedWord);

  let overallSuccess = audioResult.success || imageResult.success;
  let messages = [];
  if (!audioResult.success && audioResult.message) messages.push(`Audio: ${audioResult.message}`);
  if (!imageResult.success && imageResult.message) messages.push(`Image: ${imageResult.message}`);
  
  const finalMessage = overallSuccess ? 
                       (messages.length > 0 ? `Partial success. ${messages.join('; ')}` : "Content fetched successfully.") :
                       (messages.length > 0 ? messages.join('; ') : "Failed to fetch any content.");

  Logger.log(`DictionaryIntegration.js: fetchMultimediaContentForWord_ - Multimedia content fetched for "${originalWord}". Audio success: ${audioResult.success}, Image success: ${imageResult.success}, Message: ${finalMessage}`);
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
 * @param {string} word - The word to look up
 * @return {Object} Multimedia content
 */
function getCachedMultimediaContent(word) {
  const normalizedWord = word.toLowerCase().trim();
  const userProperties = PropertiesService.getUserProperties();
  const cacheKey = `multimedia_v2_${normalizedWord}`; // Incremented version to force refresh if structure changes
  Logger.log(`DictionaryIntegration.js: getCachedMultimediaContent - Attempting to get from cache for: "${normalizedWord}" with key: ${cacheKey}`);

  const cachedItem = userProperties.getProperty(cacheKey);

  if (cachedItem) {
    try {
      const parsedItem = JSON.parse(cachedItem);
      if (parsedItem && parsedItem.timestamp && (Date.now() - parsedItem.timestamp < MULTIMEDIA_CACHE_DURATION_MS)) {
        Logger.log(`DictionaryIntegration.js: getCachedMultimediaContent - Cache hit for multimedia: "${normalizedWord}"`);
        return parsedItem.data;
      } else {
        Logger.log(`DictionaryIntegration.js: getCachedMultimediaContent - Cache expired or invalid for multimedia: "${normalizedWord}"`);
      }
    } catch (e) {
      Logger.log(`DictionaryIntegration.js: getCachedMultimediaContent - Error parsing cache for multimedia: "${normalizedWord}". Error: ${e.message}. Fetching fresh.`);
    }
  } else {
     Logger.log(`DictionaryIntegration.js: getCachedMultimediaContent - Cache miss for multimedia: "${normalizedWord}". Fetching fresh.`);
  }

  const content = fetchMultimediaContentForWord_(word); 

  // Cache even if only partial success to avoid re-hitting failing APIs too often for the same word
  // if (content.success || content.audioUrl || content.imageUrl) { // Modified condition to cache if anything useful was fetched
  try {
    const itemToCache = {
      data: content, // content object itself contains success, word, audioUrl, imageUrl, message
      timestamp: Date.now()
    };
    userProperties.setProperty(cacheKey, JSON.stringify(itemToCache));
    Logger.log(`DictionaryIntegration.js: getCachedMultimediaContent - Cached new/refreshed multimedia content for: "${normalizedWord}"`);
  } catch (e) {
    Logger.log(`DictionaryIntegration.js: getCachedMultimediaContent - Error stringifying multimedia content for cache (word "${normalizedWord}"). Error: ${e.message}. Content was: ${JSON.stringify(content)}`);
  }
  // }
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
  Logger.log(`DictionaryIntegration.js: previewDictionaryContent - Called for word: "${word}"`);
  try {
    const session = getUserSession();
    if (!session || !session.userName) {
      Logger.log('DictionaryIntegration.js: previewDictionaryContent - Permission denied: User not logged in.');
      return { success: false, message: 'You must be logged in to use these tools.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName); 
    if (!isAdmin) {
      Logger.log(`DictionaryIntegration.js: previewDictionaryContent - Permission denied: User "${session.userName}" is not an admin.`);
      return { success: false, message: 'Admin access required to use these tools.' };
    }

    if (!word || word.trim() === '') {
      Logger.log('DictionaryIntegration.js: previewDictionaryContent - Word is required for lookup.');
      return { success: false, message: 'Word is required for lookup.' };
    }
    const result = getCachedMultimediaContent(word.trim());
    Logger.log(`DictionaryIntegration.js: previewDictionaryContent - Result for "${word}": ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    Logger.log(`DictionaryIntegration.js: previewDictionaryContent - Error for "${word}": ${error.message}`);
    return { success: false, message: `Server error previewing content: ${error.message}` };
  }
}

/**
 * Adds dictionary content (audio/image tags) to a flashcard.
 * Accessible by admin users.
 * @param {string} deckName - Name of the deck
 * @param {string} cardId - ID of the flashcard
 * @param {string} word - The word whose content was looked up
 * @return {Object} Result of the operation
 */
function addDictionaryContentToCard(deckName, cardId, word) {
  Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Deck: ${deckName}, CardID: ${cardId}, Word: "${word}"`);
  try {
    const session = getUserSession();
    if (!session || !session.userName) {
      Logger.log('DictionaryIntegration.js: addDictionaryContentToCard - Permission denied: User not logged in.');
      return { success: false, message: 'You must be logged in to modify cards.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName);
    if (!isAdmin) {
      Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Permission denied: User "${session.userName}" is not an admin.`);
      return { success: false, message: 'Admin access required to modify cards.' };
    }

    const contentResult = getCachedMultimediaContent(word);
    Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Fetched/cached content for "${word}": Success=${contentResult.success}, HasAudio=${!!contentResult.audioUrl}, HasImage=${!!contentResult.imageUrl}`);

    if (!contentResult.audioUrl && !contentResult.imageUrl) { // Check if there's anything to add
      Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - No audio or image content found for "${word}". Message: ${contentResult.message}`);
      return { success: false, message: contentResult.message || `No multimedia content could be fetched or found for "${word}".` };
    }

    const ss = getDatabaseSpreadsheet();
    const deckSheet = ss.getSheetByName(deckName);

    if (!deckSheet) {
      Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Deck "${deckName}" not found.`);
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const data = deckSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idIndex = headers.indexOf('FlashcardID');
    const sideAIndex = headers.indexOf('FlashcardSideA'); // Needed for source tag if we add one
    const sideCIndex = headers.indexOf('FlashcardSideC'); // Default to add media to Side C

    // Let's find Side B as well, in case we want to intelligently place images there.
    const sideBIndex = headers.indexOf('FlashcardSideB');


    if (idIndex === -1) {
      Logger.log('DictionaryIntegration.js: addDictionaryContentToCard - FlashcardID column not found.');
      return { success: false, message: 'FlashcardID column not found in deck.' };
    }
    // Side C might not exist, or we might target Side B. We'll handle this.

    let cardRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        cardRowIndex = i; // 0-based for `data` array
        break;
      }
    }

    if (cardRowIndex === -1) {
      Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Card "${cardId}" not found in deck "${deckName}".`);
      return { success: false, message: `Card "${cardId}" not found in deck "${deckName}".` };
    }

    let multimediaTags = '';
    let sources = [];

    // Intelligently place IMAGE tag in Side B if Side B exists, otherwise Side C
    // Intelligently place AUDIO tag in Side C if Side C exists, otherwise Side B (if no image there)
    
    let targetSideBContent = (sideBIndex !== -1 && data[cardRowIndex][sideBIndex]) ? String(data[cardRowIndex][sideBIndex]) : '';
    let targetSideCContent = (sideCIndex !== -1 && data[cardRowIndex][sideCIndex]) ? String(data[cardRowIndex][sideCIndex]) : '';

    let imageAddedToSideB = false;

    if (contentResult.imageUrl) {
        const imageTag = `[IMAGE:${contentResult.imageUrl}]`;
        if (sideBIndex !== -1) { // Prefer Side B for images
            if (!targetSideBContent.includes(imageTag)) { // Avoid duplicates
                targetSideBContent = imageTag + (targetSideBContent ? '\n' + targetSideBContent.replace(imageTag, '').trim() : '');
            }
            imageAddedToSideB = true;
            Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Image tag for "${word}" prepared for Side B.`);
        } else if (sideCIndex !== -1) { // Fallback to Side C
             if (!targetSideCContent.includes(imageTag)) {
                targetSideCContent = imageTag + (targetSideCContent ? '\n' + targetSideCContent.replace(imageTag, '').trim() : '');
            }
            Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Image tag for "${word}" prepared for Side C (Side B column missing).`);
        } else {
            Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Cannot add image tag for "${word}", no Side B or Side C column.`);
        }
        sources.push('Pixabay');
    }

    if (contentResult.audioUrl) {
        const audioTag = `[AUDIO:${contentResult.audioUrl}]`;
        if (sideCIndex !== -1) { // Prefer Side C for audio
            if (!targetSideCContent.includes(audioTag)) {
                targetSideCContent = targetSideCContent.replace(audioTag, '').trim() + (targetSideCContent ? '\n' : '') + audioTag;
            }
            Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Audio tag for "${word}" prepared for Side C.`);
        } else if (sideBIndex !== -1 && !imageAddedToSideB) { // Fallback to Side B if no image already there and Side C missing
            if (!targetSideBContent.includes(audioTag)) {
                targetSideBContent = targetSideBContent.replace(audioTag, '').trim() + (targetSideBContent ? '\n' : '') + audioTag;
            }
            Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Audio tag for "${word}" prepared for Side B (Side C column missing, Side B had no image).`);
        } else if (sideBIndex !== -1 && imageAddedToSideB) { // If Side C missing and Side B has image, append audio to Side B
             if (!targetSideBContent.includes(audioTag)) {
                targetSideBContent = targetSideBContent.replace(audioTag, '').trim() + (targetSideBContent ? '\n' : '') + audioTag;
            }
            Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Audio tag for "${word}" appended to Side B (Side C column missing, Side B had image).`);
        } else {
             Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Cannot add audio tag for "${word}", no suitable Side B or Side C column.`);
        }
        sources.push('VoiceRSS');
    }
    
    // Add source tag to Side C if it exists, otherwise to Side B if it exists
    const sourceString = sources.length > 0 ? `[Source: ${sources.join(', ')} for "${contentResult.word}"]` : '';
    if (sourceString) {
        const oldSourcePattern = new RegExp(`\\[Source:[^\\]]+?for "${escapeRegex(contentResult.word)}"\\]`, 'gi');
        if (sideCIndex !== -1) {
            targetSideCContent = targetSideCContent.replace(oldSourcePattern, '').trim(); // Remove old source for this word
            targetSideCContent += (targetSideCContent ? '\n' : '') + sourceString;
            Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Source tag for "${word}" added/updated in Side C.`);
        } else if (sideBIndex !== -1) {
            targetSideBContent = targetSideBContent.replace(oldSourcePattern, '').trim(); // Remove old source for this word
            targetSideBContent += (targetSideBContent ? '\n' : '') + sourceString;
            Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Source tag for "${word}" added/updated in Side B (Side C column missing).`);
        }
    }
    
    // Write back to sheet
    if (sideBIndex !== -1) {
        deckSheet.getRange(cardRowIndex + 1, sideBIndex + 1).setValue(targetSideBContent.trim());
    }
    if (sideCIndex !== -1) {
        deckSheet.getRange(cardRowIndex + 1, sideCIndex + 1).setValue(targetSideCContent.trim());
    }

    Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Multimedia content for "${word}" processed for card "${cardId}" by admin "${session.userName}".`);
    return {
      success: true,
      message: `Multimedia content for "${word}" added/updated for the card.`,
    };

  } catch (error) {
    Logger.log(`DictionaryIntegration.js: addDictionaryContentToCard - Error: ${error.message} (Word: ${word}, Deck: ${deckName}, Card: ${cardId})`);
    return { success: false, message: `Server error adding multimedia content: ${error.message}` };
  }
}

/**
 * Renders content string with [AUDIO], [IMAGE], and [Source] tags into HTML.
 * @param {string} contentString - The raw content string from the sheet.
 * @return {string} HTML string with media tags rendered.
 */
function renderDictionaryContent(contentString) {
  // PHASE 3 LOGGING: Log input
  Logger.log(`DictionaryIntegration.js: renderDictionaryContent - Received contentString: "${contentString}"`);

  if (!contentString || typeof contentString !== 'string') {
    Logger.log("DictionaryIntegration.js: renderDictionaryContent - Empty or invalid contentString, returning empty string.");
    return '';
  }

  const splitRegex = /(\[AUDIO:[^\]]+\]|\[IMAGE:[^\]]+\]|\[Source:[^\]]+\])/g;
  const tokens = contentString.split(splitRegex).filter(Boolean); 
  Logger.log(`DictionaryIntegration.js: renderDictionaryContent - Tokens after split: ${JSON.stringify(tokens)}`);

  let resultHtml = '';

  tokens.forEach(token => {
    Logger.log(`DictionaryIntegration.js: renderDictionaryContent - Tokenizing. Current token: "${token}"`);
    if (token.startsWith('[AUDIO:')) {
      let url = token.substring(7, token.length - 1); 
      Logger.log(`DictionaryIntegration.js: renderDictionaryContent - Matched [AUDIO:]. Raw URL: "${url}"`);
      const safeUrl = escapeHtmlServerSide(url); 
      resultHtml += `
        <div class="flashcard-audio">
          <button class="audio-play-btn" data-audio-url="${safeUrl}">
            <span class="material-icons">play_arrow</span>
            <audio class="hidden-audio-element" src="${safeUrl}" preload="metadata"></audio>
          </button>
        </div>
      `;
      Logger.log(`DictionaryIntegration.js: renderDictionaryContent - Added AUDIO HTML for URL: "${safeUrl}"`);
    } else if (token.startsWith('[IMAGE:')) {
      let url = token.substring(8, token.length - 1); 
      Logger.log(`DictionaryIntegration.js: renderDictionaryContent - Matched [IMAGE:]. Raw URL: "${url}"`);
      
      if (url.startsWith('ttps://')) {
        Logger.log(`DictionaryIntegration.js: renderDictionaryContent - WARNING: Detected 'ttps://' in image URL: ${url}. Attempting correction.`);
        url = 'h' + url; 
        Logger.log(`DictionaryIntegration.js: renderDictionaryContent - Corrected image URL to: ${url}`);
      } else if (url.startsWith('ttp://')) { // Log http urls too, they might cause mixed content issues
        Logger.log(`DictionaryIntegration.js: renderDictionaryContent - INFO: Image URL uses 'http://': ${url}. Consider 'https://'.`);
      }
      
      const safeUrl = escapeHtmlServerSide(url); 
      const altText = "Illustration for card content"; // More generic alt
      const onErrorJs = `this.alt='Image failed to load'; this.style.display='none'; this.parentElement.innerHTML='<p style=\\'color:red; font-size:small; text-align:center; padding:10px; border:1px dashed red;\\'>Image failed to load.<br><span style=\\'font-size:x-small;\\'>URL: ${escapeHtmlServerSide(url.length > 60 ? url.substring(0,60)+'...' : url)}</span></p>'; console.error('Failed to load image (onerror event):', this.src);`;

      resultHtml += `
        <div class="flashcard-image">
          <img src="${safeUrl}" alt="${escapeHtmlServerSide(altText)}" class="centered-card-image" onerror="${escapeHtmlServerSide(onErrorJs)}">
        </div>
      `;
      Logger.log(`DictionaryIntegration.js: renderDictionaryContent - Added IMAGE HTML for URL: "${safeUrl}"`);
    } else if (token.startsWith('[Source:')) {
      const sourceText = token.substring(8, token.length - 1); 
      Logger.log(`DictionaryIntegration.js: renderDictionaryContent - Matched [Source:]. Text: "${sourceText}" (CSS will hide this on flashcard)`);
      resultHtml += `<span class="source-text">Source: ${escapeHtmlServerSide(sourceText)}</span>`;
    } else {
      let textSegment = escapeHtmlServerSide(token);
      textSegment = textSegment.replace(/\r\n|\r|\n/g, '<br>'); 
      resultHtml += textSegment;
      Logger.log(`DictionaryIntegration.js: renderDictionaryContent - Matched plain text (after escaping and <br>): "${textSegment}"`);
    }
  });
  // PHASE 3 LOGGING: Log output
  Logger.log(`DictionaryIntegration.js: renderDictionaryContent - Producing HTML: "${resultHtml}"`);
  return resultHtml;
}

function escapeHtmlServerSide(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

function unescapeHtmlServerSide(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&/g, '&'); 
}

function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}