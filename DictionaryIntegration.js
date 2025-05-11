/**
 * Dictionary Integration Module for Flashcard App
 * Fetches audio pronunciations and images from Merriam-Webster dictionary
 */

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
      followRedirects: true
    });
    
    // Check if request was successful
    if (response.getResponseCode() !== 200) {
      return {
        success: false,
        message: `Failed to fetch dictionary entry for "${word}". Response code: ${response.getResponseCode()}`
      };
    }
    
    // Get the page content
    const content = response.getContentText();
    
    // Extract audio URL
    const audioUrl = extractAudioUrl(content, normalizedWord);
    
    // Extract image URL
    const imageUrl = extractImageUrl(content, normalizedWord);
    
    // Log success for debugging
    Logger.log(`Dictionary content fetched for "${word}". Audio: ${audioUrl ? 'Found' : 'Not found'}, Image: ${imageUrl ? 'Found' : 'Not found'}`);
    
    return {
      success: true,
      word: word,
      audioUrl: audioUrl,
      imageUrl: imageUrl,
      sourceUrl: dictionaryUrl
    };
  } catch (error) {
    Logger.log(`Error fetching dictionary content for "${word}": ${error.message}`);
    return {
      success: false,
      message: `Error fetching dictionary content: ${error.message}`
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
    // First letter of the word for directory structure
    const firstLetter = word.charAt(0);
    
    // Pattern to match the audio URL
    // Looking for URLs like: https://www.merriam-webster.com/dictionary/dog?pronunciation&lang=en_us&dir=d&file=dog00001
    const audioPattern = new RegExp(`\\?pronunciation&lang=en_us&dir=${firstLetter}&file=(${word}\\d+)`, 'i');
    const match = content.match(audioPattern);
    
    if (match && match[1]) {
      // Construct the full audio URL
      return `https://www.merriam-webster.com/dictionary/${word}?pronunciation&lang=en_us&dir=${firstLetter}&file=${match[1]}`;
    }
    
    // Alternative pattern for more complex cases
    const altPattern = /data-file="([^"]+)"/i;
    const altMatch = content.match(altPattern);
    
    if (altMatch && altMatch[1]) {
      const audioFile = altMatch[1];
      // Construct the URL based on the file name
      return `https://www.merriam-webster.com/dictionary/${word}?pronunciation&lang=en_us&dir=${firstLetter}&file=${audioFile}`;
    }
    
    return null;
  } catch (error) {
    Logger.log(`Error extracting audio URL: ${error.message}`);
    return null;
  }
}

/**
 * Extracts the image URL from the dictionary page content
 * 
 * @param {string} content - The HTML content of the dictionary page
 * @param {string} word - The normalized word
 * @return {string|null} The image URL or null if not found
 */
function extractImageUrl(content, word) {
  try {
    // Pattern to match the image URL in the HTML
    const imagePattern = /<img\s+alt="Illustration of\s+[^"]+"\s+class="[^"]*"\s+data-src="([^"]+)"/i;
    const match = content.match(imagePattern);
    
    if (match && match[1]) {
      return match[1];
    }
    
    // Alternative pattern for different image formats
    const altPattern = /<img\s+alt="Illustration of\s+[^"]+"\s+[^>]*\s+src="([^"]+)"/i;
    const altMatch = content.match(altPattern);
    
    if (altMatch && altMatch[1]) {
      return altMatch[1];
    }
    
    return null;
  } catch (error) {
    Logger.log(`Error extracting image URL: ${error.message}`);
    return null;
  }
}

/**
 * Fetches and caches dictionary content in user properties
 * to avoid excessive API calls
 * 
 * @param {string} word - The word to look up
 * @return {Object} Dictionary content
 */
function getCachedDictionaryContent(word) {
  const normalizedWord = word.toLowerCase().trim();
  const userProperties = PropertiesService.getUserProperties();
  const cacheKey = `dict_${normalizedWord}`;
  
  // Check if word is in cache
  const cachedContent = userProperties.getProperty(cacheKey);
  
  if (cachedContent) {
    try {
      return JSON.parse(cachedContent);
    } catch (e) {
      // Invalid cache, will fetch fresh data
    }
  }
  
  // Fetch fresh content
  const content = fetchDictionaryContent(normalizedWord);
  
  // Cache successful results for 7 days
  if (content.success) {
    userProperties.setProperty(cacheKey, JSON.stringify(content));
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
 * Adds dictionary content to a flashcard
 * 
 * @param {string} deckName - Name of the deck
 * @param {string} cardId - ID of the flashcard
 * @param {string} word - The word to add content for
 * @return {Object} Result of the operation
 */
function addDictionaryContentToCard(deckName, cardId, word) {
  try {
    // Check admin permissions
    if (!isUserAdmin()) {
      return { success: false, message: 'Only admins can modify cards' };
    }
    
    // Get dictionary content
    const content = getCachedDictionaryContent(word);
    
    if (!content.success) {
      return content; // Return the error
    }
    
    // Get the database spreadsheet
    const ss = getDatabaseSpreadsheet();
    const deckSheet = ss.getSheetByName(deckName);
    
    if (!deckSheet) {
      return { success: false, message: `Deck "${deckName}" not found` };
    }
    
    // Find the card
    const data = deckSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const idIndex = headers.indexOf('FlashcardID');
    const sideAIndex = headers.indexOf('FlashcardSideA');
    const sideBIndex = headers.indexOf('FlashcardSideB');
    const sideCIndex = headers.indexOf('FlashcardSideC');
    
    if (idIndex === -1 || sideAIndex === -1 || sideBIndex === -1) {
      return { success: false, message: 'Required columns not found' };
    }
    
    // Find the card row
    let cardRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        cardRow = i + 1; // +1 for 1-based indexing
        break;
      }
    }
    
    if (cardRow === -1) {
      return { success: false, message: `Card "${cardId}" not found` };
    }
    
    // Construct the dictionary content
    let dictionaryContent = '';
    
    if (content.audioUrl) {
      dictionaryContent += `[AUDIO:${content.audioUrl}] `;
    }
    
    if (content.imageUrl) {
      dictionaryContent += `[IMAGE:${content.imageUrl}] `;
    }
    
    dictionaryContent += `[Source: Merriam-Webster]`;
    
    // Update the flashcard
    deckSheet.getRange(cardRow, sideCIndex + 1).setValue(dictionaryContent);
    
    return {
      success: true,
      message: 'Dictionary content added to card',
      content: content
    };
  } catch (error) {
    Logger.log(`Error adding dictionary content: ${error.message}`);
    return { success: false, message: `Error adding dictionary content: ${error.message}` };
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
  
  let processedContent = sideC;
  
  // Process audio tags
  const audioPattern = /\[AUDIO:([^\]]+)\]/g;
  processedContent = processedContent.replace(audioPattern, (match, url) => {
    return `
      <div class="flashcard-audio">
        <audio controls>
          <source src="${url}" type="audio/mpeg">
          Your browser does not support audio.
        </audio>
      </div>
    `;
  });
  
  // Process image tags
  const imagePattern = /\[IMAGE:([^\]]+)\]/g;
  processedContent = processedContent.replace(imagePattern, (match, url) => {
    return `
      <div class="flashcard-image">
        <img src="${url}" alt="Dictionary illustration" style="max-width: 100%; height: auto;">
      </div>
    `;
  });
  
  return processedContent;
}

/**
 * Checks a word in the dictionary and returns content for preview
 * 
 * @param {string} word - The word to look up
 * @return {Object} Dictionary content for preview
 */
function previewDictionaryContent(word) {
  try {
    // Check admin permissions
    if (!isUserAdmin()) {
      return { success: false, message: 'Only admins can access dictionary tools' };
    }
    
    // Validate word
    if (!word || word.trim() === '') {
      return { success: false, message: 'Word is required' };
    }
    
    // Get dictionary content
    return getCachedDictionaryContent(word.trim());
  } catch (error) {
    Logger.log(`Error previewing dictionary content: ${error.message}`);
    return { success: false, message: `Error previewing dictionary content: ${error.message}` };
  }
}