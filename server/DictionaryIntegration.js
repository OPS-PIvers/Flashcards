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

// Update the renderDictionaryContent function in your flashcards.js file
function renderDictionaryContent(content, cardSide) {
    console.log(`renderDictionaryContent called with content starting with: ${content.substring(0, 50)}...`);
    
    // Check if content contains image tag
    if (content.includes("[IMAGE:")) {
        // Extract the URL from between the [IMAGE:] tags
        const imageUrl = content.match(/\[IMAGE:(.*?)\]/)[1];
        console.log(`Extracted image URL: ${imageUrl}`);
        
        // Create the HTML for the image display
        const html = `
        <div class="flashcard-image">
          <img src="${imageUrl}" alt="Flashcard image" class="card-media-image">
        </div>`;
        
        console.log(`Generated image HTML: ${html.substring(0, 100)}...`);
        return html;
    }
    // Check if content contains audio tag
    else if (content.includes("[AUDIO:")) {
        // Extract the audio data URL from between the [AUDIO:] tags
        const audioUrl = content.match(/\[AUDIO:(.*?)\]/)[1];
        console.log(`Extracted audio URL length: ${audioUrl.length} characters`);
        
        // Create a unique ID for this audio button
        const buttonId = `audio-btn-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Create the HTML for the audio player with the button
        const html = `
        <div class="flashcard-audio">
          <button class="audio-play-btn" id="${buttonId}" data-audio-url="${audioUrl}">
            <i class="fas fa-play"></i> Play Audio
          </button>
          <audio class="audio-element" style="display:none;">
            <source src="${audioUrl}" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
        </div>`;
        
        console.log(`Generated audio HTML with button ID: ${buttonId}`);
        return html;
    }
    // Regular text content
    else {
        return `<div class="flashcard-text">${content}</div>`;
    }
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

// Add this function to help debug URL issues
function sanitizePixabayUrl(url) {
    // If URL is already truncated in the logs, this won't fix it
    // But if it has ...some_slug in it, this will remove it
    if (url.includes('...')) {
        console.error(`Found truncated URL: ${url}`);
        // Try to extract the base part
        const match = url.match(/(https:\/\/pixabay\.com\/get\/[a-zA-Z0-9]+)/);
        if (match) {
            // Append standard ending
            return `${match[1]}_640.jpg`;
        }
    }
    
    // Make sure URL ends with appropriate suffix
    if (!url.endsWith('.jpg') && !url.endsWith('.png')) {
        if (url.includes('_640')) {
            return `${url}.jpg`;
        } else {
            return `${url}_640.jpg`;
        }
    }
    
    return url;
}

// Then modify the renderDictionaryContent function to use this:
// Update where you extract the image URL:
const imageUrl = sanitizePixabayUrl(content.match(/\[IMAGE:(.*?)\]/)[1]);

// Add this debugging function
function debugFlashcardMedia() {
    console.log("---- DEBUGGING FLASHCARD MEDIA ----");
    
    // Check for images
    const images = document.querySelectorAll('.card-media-image');
    console.log(`Found ${images.length} card images on page`);
    
    images.forEach((img, i) => {
        console.log(`Image #${i+1} src: ${img.src}`);
        console.log(`Image #${i+1} display: ${window.getComputedStyle(img).display}`);
        console.log(`Image #${i+1} visibility: ${window.getComputedStyle(img).visibility}`);
        console.log(`Image #${i+1} dimensions: ${img.width}x${img.height}`);
        
        // Check if image loaded properly
        if (img.complete) {
            if (img.naturalWidth === 0) {
                console.error(`Image #${i+1} failed to load properly!`);
            } else {
                console.log(`Image #${i+1} loaded successfully`);
            }
        } else {
            console.log(`Image #${i+1} still loading...`);
            img.addEventListener('load', () => {
                console.log(`Image #${i+1} loaded successfully after wait`);
            });
            img.addEventListener('error', () => {
                console.error(`Image #${i+1} failed to load with error!`);
            });
        }
    });
    
    // Check for audio elements
    const audioElements = document.querySelectorAll('audio');
    console.log(`Found ${audioElements.length} audio elements on page`);
    
    audioElements.forEach((audio, i) => {
        const source = audio.querySelector('source');
        console.log(`Audio #${i+1} src: ${source ? source.src.substring(0, 50) + '...' : 'No source'}`);
        console.log(`Audio #${i+1} ready state: ${audio.readyState}`);
    });
    
    // Check for audio buttons
    const audioButtons = document.querySelectorAll('.audio-play-btn');
    console.log(`Found ${audioButtons.length} audio buttons on page`);
    
    audioButtons.forEach((btn, i) => {
        console.log(`Button #${i+1} id: ${btn.id}`);
        console.log(`Button #${i+1} visibility: ${window.getComputedStyle(btn).visibility}`);
        console.log(`Button #${i+1} has click listener: ${!!btn.onclick || 'Unknown'}`);
    });
    
    console.log("---- END DEBUGGING FLASHCARD MEDIA ----");
}

// Call this function after displaying flashcards
setTimeout(debugFlashcardMedia, 500);

// Add this helper function for audio data URLs
function ensureValidDataUrl(url) {
    // Check if it's a data URL
    if (url.startsWith('data:audio/mpeg;base64,')) {
        // It's already a valid data URL
        return url;
    }
    
    // If it contains the data URL but with extra text around it
    const match = url.match(/(data:audio\/mpeg;base64,[A-Za-z0-9+/=]+)/);
    if (match) {
        return match[1];
    }
    
    // If it's just a base64 string without the prefix
    if (/^[A-Za-z0-9+/=]+$/.test(url)) {
        return `data:audio/mpeg;base64,${url}`;
    }
    
    console.error("Unable to process audio URL:", url.substring(0, 50) + "...");
    return url;
}

// Use this in renderDictionaryContent where you extract the audio URL:
const audioUrl = ensureValidDataUrl(content.match(/\[AUDIO:(.*?)\]/)[1]);