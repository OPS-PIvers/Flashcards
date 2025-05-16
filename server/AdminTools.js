/**
 * Admin Tools Module for Flashcard App
 * Provides admin-specific functionality for managing decks, cards, and users.
 * Relies on a global isUserAdmin() function (expected from Authentication.js)
 * and getDatabaseSpreadsheet() (expected from Database.js or Code.js).
 */

/**
 * Gets admin access information.
 * This function primarily serves as a server-side check that can be called
 * by the client before attempting to load admin UI components.
 *
 * @return {Object} Admin access information
 */
function getAdminAccess() {
  try {
    const userProperties = PropertiesService.getUserProperties();
    const sessionJson = userProperties.getProperty('session');
    
    if (!sessionJson) {
      Logger.log("getAdminAccess: No session found");
      return { success: true, isAdmin: false, message: 'Admin access required. You need to log in first.' };
    }
    
    const session = JSON.parse(sessionJson);
    Logger.log(`getAdminAccess: Session data: ${JSON.stringify(session)}`);
    
    if (!session || typeof session !== 'object' || !session.isValid) {
      Logger.log("getAdminAccess: Invalid session");
      return { success: true, isAdmin: false, message: 'Admin access required. Invalid session.' };
    }
    
    const username = session.userName;
    if (!username) {
      Logger.log("getAdminAccess: No username in session");
      return { success: true, isAdmin: false, message: 'Admin access required. Invalid username.' };
    }
    
    const isAdmin = forceAdminCheck(username);
    Logger.log(`getAdminAccess: Direct admin check result for ${username}: ${isAdmin}`);
    
    return {
      success: true,
      isAdmin: isAdmin,
      message: isAdmin ? 'Admin access verified.' : 'Admin access required. You do not have sufficient permissions.'
    };
  } catch (error) {
    Logger.log(`Error in getAdminAccess: ${error.message}\nStack: ${error.stack}`);
    return { success: false, isAdmin: false, message: `Error checking admin access: ${error.message}` };
  }
}

function forceAdminCheck(username) {
  return getIsUserAdmin(username);
}

/**
 * Creates a new flashcard deck.
 * Only accessible by admin users.
 *
 * @param {string} deckName - Name for the new deck
 * @return {Object} Result of operation {success: boolean, message: string}
 */
function createDeck(deckName) {
  try {
    const session = getUserSession(); // From Authentication.js
    if (!session || !session.userName) {
      return { success: false, message: 'Permission denied: You must be logged in to create decks.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName);
    if (!isAdmin) {
      return { success: false, message: 'Permission denied: Only administrators can create decks.' };
    }

    if (!deckName || deckName.trim() === '') {
      return { success: false, message: 'Deck name cannot be empty.' };
    }

    const cleanDeckName = deckName.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    if (!cleanDeckName) {
        return { success: false, message: 'Invalid deck name after sanitization. Please use alphanumeric characters, spaces, or hyphens.' };
    }

    const ss = getDatabaseSpreadsheet(); // From Database.js
    const existingSheet = ss.getSheetByName(cleanDeckName);
    if (existingSheet) {
      return { success: false, message: `Deck "${cleanDeckName}" already exists.` };
    }

    const newSheet = ss.insertSheet(cleanDeckName);
    const headers = [
      'FlashcardID', 'FlashcardSideA', 'FlashcardSideB', 'FlashcardSideC',
      'Tags', 'DateCreated', 'CreatedBy', 'StudyConfig'
    ];
    newSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');
    headers.forEach((_, i) => newSheet.autoResizeColumn(i + 1));

    Logger.log(`Admin "${session.userName}" created deck: ${cleanDeckName}`);
    return { success: true, message: `Deck "${cleanDeckName}" created successfully.` };
  } catch (error) {
    Logger.log(`Error in createDeck (Deck: ${deckName}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error creating deck: ${error.message}` };
  }
}

/**
 * Adds a new flashcard to a specified deck.
 * Handles embedding of image and audio URLs into card data.
 * Only accessible by admin users.
 *
 * @param {string} deckName - Name of the deck
 * @param {Object} cardData - Card data {sideA, sideB, sideC, tags, showSideB, showSideC, autoplayAudio}
 * @param {string|null} imageUrlToEmbed - URL of the image to embed in Side B
 * @param {string|null} audioUrlToEmbed - URL of the audio to embed in Side C
 * @param {string|null} audioUrlToEmbedSideA - URL of the audio to embed in Side A
 * @return {Object} Result of operation {success: boolean, message: string, cardId?: string}
 */
function addFlashcard(deckName, cardData, imageUrlToEmbed, audioUrlToEmbed, audioUrlToEmbedSideA) {
  try {
    const session = getUserSession();
    if (!session || !session.userName) {
      return { success: false, message: 'Permission denied: You must be logged in to add flashcards.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName);
    if (!isAdmin) {
      return { success: false, message: 'Permission denied: Only administrators can add flashcards.' };
    }

    if (!cardData || !cardData.sideA || cardData.sideA.trim() === '') {
      return { success: false, message: 'Card Side A is required.' };
    }
    
    // Process Side A content with audio if provided
    let finalSideA = (cardData.sideA || '').trim();
    if (audioUrlToEmbedSideA) {
      const audioTagA = `[AUDIO:${audioUrlToEmbedSideA}]`;
      // Add audio tag to Side A
      if (!finalSideA.includes(audioTagA)) {
        finalSideA = audioTagA + (finalSideA ? ' ' + finalSideA : '');
      }
    }
    
    let finalSideB = (cardData.sideB || '').trim();
    let finalSideC = (cardData.sideC || '').trim();
    let sources = [];

    if (imageUrlToEmbed) {
      const imageTag = `[IMAGE:${imageUrlToEmbed}]`;
      // Prepend image tag to Side B if not already there to ensure it's visible first
      if (!finalSideB.includes(imageTag)) {
        finalSideB = imageTag + (finalSideB ? '\n' + finalSideB : '');
      }
      sources.push('Pixabay');
    }

    if (audioUrlToEmbed) {
      const audioTag = `[AUDIO:${audioUrlToEmbed}]`;
      // Append audio tag to Side C
      if (!finalSideC.includes(audioTag)) {
        finalSideC = finalSideC + (finalSideC ? '\n' : '') + audioTag;
      }
      sources.push('VoiceRSS');
    }
    
    if (sources.length > 0) {
        const sourceTag = `[Source: ${sources.join(', ')} for "${cardData.sideA.trim()}"]`;
        if (!finalSideC.includes(sourceTag)) {
            finalSideC = finalSideC + (finalSideC ? '\n' : '') + sourceTag;
        }
    }

    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(deckName);
    if (!sheet) {
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const cardId = `card_${Utilities.getUuid().substring(0, 8)}`;
    const showSideB = cardData.showSideB !== false; // Default to true if not specified
    const showSideC = cardData.showSideC !== false; // Default to true if not specified
    const autoplayAudio = cardData.autoplayAudio === true; // Default to false if not specified
    const studyConfig = JSON.stringify({ 
      showSideB, 
      showSideC, 
      autoplayAudio 
    });

    const newCardRow = [
      cardId,
      finalSideA.trim(),
      finalSideB.trim(),
      finalSideC.trim(),
      (cardData.tags || '').trim().split(',').map(tag => tag.trim()).filter(tag => tag).join(','),
      new Date(),
      session.userName,
      studyConfig // Add the updated study config
    ];

    sheet.appendRow(newCardRow);
    Logger.log(`Admin "${session.userName}" added card "${cardId}" to deck: ${deckName} with media.`);
    return { success: true, message: 'Flashcard added successfully.', cardId: cardId };
  } catch (error) {
    Logger.log(`Error in addFlashcard (Deck: ${deckName}, CardData: ${JSON.stringify(cardData)}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error adding flashcard: ${error.message}` };
  }
}

/**
 * Retrieves a list of all users from the Config sheet.
 * Only accessible by admin users.
 *
 * @return {Object} {success: boolean, users?: Array<Object>, message?: string}
 */
function getUsers() {
  try {
    const session = getUserSession();
    if (!session || !session.userName) {
      return { success: false, message: 'Permission denied: You must be logged in to view user lists.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName);
    if (!isAdmin) {
      return { success: false, message: 'Permission denied: Only administrators can view user lists.' };
    }

    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    if (!configSheet) {
        return { success: false, message: "Configuration sheet ('Config') not found."};
    }
    const data = configSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const passwordHeaderIndex = headers.indexOf('Password');

    const users = data.slice(1).map(row => {
      const user = {};
      headers.forEach((header, index) => {
        if (passwordHeaderIndex !== -1 && index === passwordHeaderIndex) {
          // Do not include password
        } else {
          // Ensure IsAdmin is boolean
          if (header === 'IsAdmin') {
             const isAdminCell = configSheet.getRange(data.indexOf(row) + 1, index + 1); // Get actual row index
             let isChecked = false;
             try { isChecked = isAdminCell.isChecked(); } catch(e){}
             user[header] = row[index] === true || String(row[index]).toUpperCase() === 'TRUE' || isChecked === true;
          } else if (row[index] instanceof Date) {
             user[header] = row[index].toISOString();
          }
          else {
            user[header] = row[index];
          }
        }
      });
      return user;
    });

    return { success: true, users: users };
  } catch (error) {
    Logger.log(`Error in getUsers: ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error retrieving users: ${error.message}` };
  }
}

/**
 * Deletes a specific flashcard from a deck.
 * Only accessible by admin users.
 *
 * @param {string} deckName - Name of the deck
 * @param {string} cardId - ID of the flashcard to delete
 * @return {Object} Result of operation {success: boolean, message: string}
 */
function deleteFlashcard(deckName, cardId) {
  try {
    const session = getUserSession();
    if (!session || !session.userName) {
      return { success: false, message: 'Permission denied: You must be logged in to delete flashcards.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName);
    if (!isAdmin) {
      return { success: false, message: 'Permission denied: Only administrators can delete flashcards.' };
    }

    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(deckName);
    if (!sheet) {
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idIndex = headers.indexOf('FlashcardID');
    if (idIndex === -1) {
      return { success: false, message: 'FlashcardID column not found in the deck.' };
    }

    let rowIndexToDelete = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        rowIndexToDelete = i + 1; 
        break;
      }
    }

    if (rowIndexToDelete === -1) {
      return { success: false, message: `Card ID "${cardId}" not found in deck "${deckName}".` };
    }

    sheet.deleteRow(rowIndexToDelete);
    Logger.log(`Admin "${session.userName}" deleted card "${cardId}" from deck: ${deckName}`);
    return { success: true, message: 'Flashcard deleted successfully.' };
  } catch (error) {
    Logger.log(`Error in deleteFlashcard (Deck: ${deckName}, CardID: ${cardId}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error deleting flashcard: ${error.message}` };
  }
}

/**
 * Updates an existing flashcard in a deck.
 * Handles embedding of image and audio URLs into card data.
 * Only accessible by admin users.
 *
 * @param {string} deckName - Name of the deck
 * @param {string} cardId - ID of the flashcard to update
 * @param {Object} cardData - Updated card data {sideA, sideB, sideC, tags, showSideB, showSideC, autoplayAudio}
 * @param {string|null} imageUrlToEmbed - URL of the image to embed in Side B
 * @param {string|null} audioUrlToEmbed - URL of the audio to embed in Side C
 * @param {string|null} audioUrlToEmbedSideA - URL of the audio to embed in Side A
 * @return {Object} Result of operation {success: boolean, message: string}
 */
function updateFlashcard(deckName, cardId, cardData, imageUrlToEmbed, audioUrlToEmbed, audioUrlToEmbedSideA) {
  try {
    const session = getUserSession();
    if (!session || !session.userName) {
      return { success: false, message: 'Permission denied: You must be logged in to update flashcards.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName);
    if (!isAdmin) {
      return { success: false, message: 'Permission denied: Only administrators can update flashcards.' };
    }
    
    if (!cardData || !cardData.sideA || cardData.sideA.trim() === '') {
      return { success: false, message: 'Card Side A is required for update.' };
    }

    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(deckName);
    if (!sheet) {
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idIndex = headers.indexOf('FlashcardID');
    const sideAIndex = headers.indexOf('FlashcardSideA');
    const sideBIndex = headers.indexOf('FlashcardSideB');
    const sideCIndex = headers.indexOf('FlashcardSideC');
    const tagsIndex = headers.indexOf('Tags');
    const studyConfigIndex = headers.indexOf('StudyConfig');

    if (idIndex === -1 || sideAIndex === -1 || sideBIndex === -1 || sideCIndex === -1 || tagsIndex === -1) {
      return { success: false, message: 'One or more required columns (FlashcardID, FlashcardSideA, FlashcardSideB, FlashcardSideC, Tags) not found in the deck.' };
    }

    let rowIndexToUpdate = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        rowIndexToUpdate = i + 1;
        break;
      }
    }

    if (rowIndexToUpdate === -1) {
      return { success: false, message: `Card ID "${cardId}" not found in deck "${deckName}" for update.` };
    }

    // Process Side A with audio if provided
    let finalSideA = (cardData.sideA || '').trim();
    if (audioUrlToEmbedSideA) {
      const audioTagA = `[AUDIO:${audioUrlToEmbedSideA}]`;
      if (!finalSideA.includes(audioTagA)) {
        finalSideA = audioTagA + (finalSideA ? ' ' + finalSideA : '');
      }
    } else {
      // Remove any existing audio tags from Side A text
      finalSideA = finalSideA.replace(/\[AUDIO:[^\]]+\]\s*/gi, '').trim();
    }

    let currentSideB = sheet.getRange(rowIndexToUpdate, sideBIndex + 1).getValue() || '';
    let currentSideC = sheet.getRange(rowIndexToUpdate, sideCIndex + 1).getValue() || '';

    // Clear old media tags from current content before adding new/updated text
    currentSideB = String(currentSideB).replace(/\[IMAGE:[^\]]+\]\s*/gi, '').trim();
    currentSideC = String(currentSideC).replace(/\[AUDIO:[^\]]+\]\s*/gi, '').replace(/\[Source:[^\]]+\]\s*/gi, '').trim();
    
    // Prepend/Append user-provided text
    let finalSideB = (cardData.sideB || '').trim();
    let finalSideC = (cardData.sideC || '').trim();
    
    // If user text for SideB/SideC was provided, use it, otherwise use the cleaned current content
    finalSideB = cardData.sideB !== undefined ? (cardData.sideB || '').trim() : currentSideB;
    finalSideC = cardData.sideC !== undefined ? (cardData.sideC || '').trim() : currentSideC;

    let sources = [];

    if (imageUrlToEmbed) {
      const imageTag = `[IMAGE:${imageUrlToEmbed}]`;
      if (!finalSideB.includes(imageTag)) { // Avoid duplicate tags if user manually added one
         finalSideB = imageTag + (finalSideB ? '\n' + finalSideB : '');
      }
      sources.push('Pixabay');
    }

    if (audioUrlToEmbed) {
      const audioTag = `[AUDIO:${audioUrlToEmbed}]`;
       if (!finalSideC.includes(audioTag)) {
          finalSideC = finalSideC + (finalSideC ? '\n' : '') + audioTag;
       }
      sources.push('VoiceRSS');
    }
    
    if (sources.length > 0) {
        const sourceTag = `[Source: ${sources.join(', ')} for "${cardData.sideA.trim()}"]`;
        if (!finalSideC.includes(sourceTag)) {
            finalSideC = finalSideC + (finalSideC ? '\n' : '') + sourceTag;
        }
    }

    sheet.getRange(rowIndexToUpdate, sideAIndex + 1).setValue(finalSideA.trim());
    sheet.getRange(rowIndexToUpdate, sideBIndex + 1).setValue(finalSideB.trim());
    sheet.getRange(rowIndexToUpdate, sideCIndex + 1).setValue(finalSideC.trim());
    
    const normalizedTags = (cardData.tags || '').trim().split(',').map(tag => tag.trim()).filter(tag => tag).join(',');
    sheet.getRange(rowIndexToUpdate, tagsIndex + 1).setValue(normalizedTags);
    
    // Update study configuration
    if (studyConfigIndex !== -1) {
      const showSideB = cardData.showSideB !== false;
      const showSideC = cardData.showSideC !== false;
      const autoplayAudio = cardData.autoplayAudio === true;
      const studyConfig = JSON.stringify({
        showSideB,
        showSideC,
        autoplayAudio
      });
      sheet.getRange(rowIndexToUpdate, studyConfigIndex + 1).setValue(studyConfig);
    }

    Logger.log(`Admin "${session.userName}" updated card "${cardId}" in deck: ${deckName} with media.`);
    return { success: true, message: 'Flashcard updated successfully.' };
  } catch (error) {
    Logger.log(`Error in updateFlashcard (Deck: ${deckName}, CardID: ${cardId}, Data: ${JSON.stringify(cardData)}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error updating flashcard: ${error.message}` };
  }
}

/**
 * Deletes an entire deck (sheet).
 * Only accessible by admin users. System sheets cannot be deleted.
 *
 * @param {string} deckName - Name of the deck to delete
 * @return {Object} Result of operation {success: boolean, message: string}
 */
function deleteDeck(deckName) {
  try {
    const session = getUserSession();
    if (!session || !session.userName) {
      return { success: false, message: 'Permission denied: You must be logged in to delete decks.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName);
    if (!isAdmin) {
      return { success: false, message: 'Permission denied: Only administrators can delete decks.' };
    }

    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(deckName);
    if (!sheet) {
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const systemSheets = ['Config', 'Classes']; 
    if (systemSheets.includes(deckName)) {
      return { success: false, message: `Cannot delete system sheet "${deckName}".` };
    }

    ss.deleteSheet(sheet);
    Logger.log(`Admin "${session.userName}" deleted deck: ${deckName}`);
    return { success: true, message: `Deck "${deckName}" deleted successfully.` };
  } catch (error) {
    Logger.log(`Error in deleteDeck (Deck: ${deckName}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error deleting deck: ${error.message}` };
  }
}

function debugAdminStatus(username) {
  try {
    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    
    if (!configSheet) {
      return { error: "Config sheet not found" };
    }
    
    const data = configSheet.getDataRange().getValues();
    const headers = data[0];
    const usernameIndex = headers.indexOf('UserName');
    const isAdminIndex = headers.indexOf('IsAdmin');
    
    if (usernameIndex === -1 || isAdminIndex === -1) {
      return { error: `Required columns not found. UserName: ${usernameIndex}, IsAdmin: ${isAdminIndex}` };
    }
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[usernameIndex] && row[usernameIndex].toString().toLowerCase() === username.toLowerCase()) {
        const isAdminCell = configSheet.getRange(i + 1, isAdminIndex + 1);
        
        return {
          found: true,
          row: i + 1,
          rawValue: row[isAdminIndex],
          rawType: typeof row[isAdminIndex],
          cellValue: isAdminCell.getValue(),
          cellValueType: typeof isAdminCell.getValue(),
          valueAsString: String(row[isAdminIndex]),
          isUppercaseTrue: String(row[isAdminIndex]).toUpperCase() === 'TRUE',
          a1Notation: isAdminCell.getA1Notation()
        };
      }
    }
    
    return { found: false, message: `User ${username} not found in Config sheet` };
  } catch (error) {
    return { error: error.message, stack: error.stack };
  }
}

/**
 * Diagnostic function to examine the Config sheet structure
 * Call this from the server console to debug configuration issues
 */
function diagnoseConfigSheet() {
  try {
    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    
    if (!configSheet) {
      Logger.log("DIAGNOSIS: Config sheet not found");
      return { error: "Config sheet not found" };
    }
    
    const numRows = configSheet.getLastRow();
    const numCols = configSheet.getLastColumn();
    Logger.log(`DIAGNOSIS: Config sheet dimensions: ${numRows} rows × ${numCols} columns`);
    
    // Get headers
    const headers = configSheet.getRange(1, 1, 1, numCols).getValues()[0];
    Logger.log(`DIAGNOSIS: Config sheet headers: ${JSON.stringify(headers)}`);
    
    // Check for admin user row
    const allData = configSheet.getDataRange().getValues();
    let adminRowIndex = -1;
    let adminRowData = null;
    
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][2]).toLowerCase() === 'admin') {  // Assuming UserName is in column 3 (index 2)
        adminRowIndex = i;
        adminRowData = allData[i];
        break;
      }
    }
    
    if (adminRowIndex === -1) {
      Logger.log("DIAGNOSIS: Admin user not found in Config sheet");
      return { error: "Admin user not found" };
    }
    
    Logger.log(`DIAGNOSIS: Admin user found at row ${adminRowIndex + 1}`);
    Logger.log(`DIAGNOSIS: Admin row data: ${JSON.stringify(adminRowData)}`);
    
    // Return comprehensive diagnosis
    return {
      sheetExists: true,
      dimensions: { rows: numRows, columns: numCols },
      headers: headers,
      adminUser: {
        found: true,
        rowIndex: adminRowIndex + 1,
        rowData: adminRowData
      }
    };
  } catch (error) {
    Logger.log(`DIAGNOSIS ERROR: ${error.message}\nStack: ${error.stack}`);
    return { error: error.message, stack: error.stack };
  }
}