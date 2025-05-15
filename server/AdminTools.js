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
  // CRITICAL FIX: Direct admin check, bypassing isUserAdmin() which might be unreliable
  try {
    // Get current user's session
    const userProperties = PropertiesService.getUserProperties();
    const sessionJson = userProperties.getProperty('session');
    
    if (!sessionJson) {
      Logger.log("getAdminAccess: No session found");
      return {
        success: true,
        isAdmin: false,
        message: 'Admin access required. You need to log in first.'
      };
    }
    
    const session = JSON.parse(sessionJson);
    
    Logger.log(`getAdminAccess: Session data: ${JSON.stringify(session)}`);
    
    if (!session || typeof session !== 'object' || !session.isValid) {
      Logger.log("getAdminAccess: Invalid session");
      return {
        success: true,
        isAdmin: false,
        message: 'Admin access required. Invalid session.'
      };
    }
    
    // Get username from session
    const username = session.userName;
    if (!username) {
      Logger.log("getAdminAccess: No username in session");
      return {
        success: true,
        isAdmin: false,
        message: 'Admin access required. Invalid username.'
      };
    }
    
    // CRITICAL FIX: Force direct check from the Config sheet
    const isAdmin = forceAdminCheck(username);
    Logger.log(`getAdminAccess: Direct admin check result for ${username}: ${isAdmin}`);
    
    return {
      success: true,
      isAdmin: isAdmin,
      message: isAdmin ? 'Admin access verified.' : 'Admin access required. You do not have sufficient permissions.'
    };
  } catch (error) {
    Logger.log(`Error in getAdminAccess: ${error.message}\nStack: ${error.stack}`);
    return {
      success: false, 
      isAdmin: false,
      message: `Error checking admin access: ${error.message}`
    };
  }
}

/**
 * Force direct check of admin status from the Config sheet
 * This bypasses any cached session data or existing admin checks
 * 
 * @param {string} username - User to check
 * @return {boolean} True if user is admin, false otherwise
 */
function forceAdminCheck(username) {
  try {
    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    
    if (!configSheet) {
      Logger.log("CRITICAL: Config sheet not found during force admin check");
      return false;
    }
    
    // FIXED: Directly use column indices based on spreadsheet structure instead of header search
    // Column C (index 2) = UserName
    // Column E (index 4) = IsAdmin
    const usernameCol = 2;  // C column (0-indexed)
    const isAdminCol = 4;   // E column (0-indexed)
    
    Logger.log(`forceAdminCheck: Using fixed column indices: UserName at column C (index ${usernameCol}), IsAdmin at column E (index ${isAdminCol})`);
    
    // Get all data
    const allData = configSheet.getDataRange().getValues();
    
    // Verify we have headers and log them
    if (allData.length > 0) {
      Logger.log(`forceAdminCheck: Header row: ${JSON.stringify(allData[0])}`);
    }
    
    // Look for user
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      if (row[usernameCol] && row[usernameCol].toString() === username) {
        // Found user, check admin status
        const isAdminValue = row[isAdminCol];
        
        // Get direct cell for isChecked() method
        const isAdminCell = configSheet.getRange(i+1, isAdminCol+1);
        Logger.log(`forceAdminCheck: Found user ${username} in row ${i+1}. Raw isAdmin value: ${isAdminValue}, type: ${typeof isAdminValue}`);
        
        // Try checkbox checked state
        let isChecked = false;
        try {
          isChecked = isAdminCell.isChecked();
          Logger.log(`forceAdminCheck: isChecked() method result: ${isChecked}`);
        } catch (e) {
          Logger.log(`forceAdminCheck: isChecked() failed: ${e.message}`);
        }
        
        // Try all possible ways a checkbox can be represented
        const isAdmin = isAdminValue === true || 
                      String(isAdminValue).toUpperCase() === 'TRUE' ||
                      isAdminValue === 1 ||
                      isChecked === true;
        
        Logger.log(`forceAdminCheck: Final admin determination for ${username}: ${isAdmin}`);
        return isAdmin;
      }
    }
    
    Logger.log(`forceAdminCheck: User ${username} not found in Config sheet`);
    return false;
  } catch (error) {
    Logger.log(`Error in forceAdminCheck: ${error.message}\nStack: ${error.stack}`);
    return false;
  }
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
    // CRITICAL FIX: Use session username for direct admin check
    const session = getUserSession();
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

    // Sanitize deck name: remove special characters (allow alphanumeric, space, hyphen), replace spaces with underscores
    const cleanDeckName = deckName.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    if (!cleanDeckName) {
        return { success: false, message: 'Invalid deck name after sanitization. Please use alphanumeric characters, spaces, or hyphens.' };
    }


    const ss = getDatabaseSpreadsheet();
    const existingSheet = ss.getSheetByName(cleanDeckName);
    if (existingSheet) {
      return { success: false, message: `Deck "${cleanDeckName}" already exists.` };
    }

    const newSheet = ss.insertSheet(cleanDeckName);
    const headers = [
      'FlashcardID', 'FlashcardSideA', 'FlashcardSideB', 'FlashcardSideC',
      'Tags', 'DateCreated', 'CreatedBy'
      // User-specific progress columns (e.g., User_Rating, User_LastReview, User_NextDue)
      // will be added dynamically by the flashcard system when a user first interacts with the deck.
    ];
    newSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');
    headers.forEach((_, i) => newSheet.autoResizeColumn(i + 1));

    Logger.log(`Admin "${getCurrentUserInfo().userName}" created deck: ${cleanDeckName}`);
    return {
      success: true,
      message: `Deck "${cleanDeckName}" created successfully.`
    };
  } catch (error) {
    Logger.log(`Error in createDeck (Deck: ${deckName}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error creating deck: ${error.message}` };
  }
}

/**
 * Adds a new flashcard to a specified deck.
 * Only accessible by admin users.
 *
 * @param {string} deckName - Name of the deck
 * @param {Object} cardData - Card data {sideA: string, sideB: string, sideC?: string, tags?: string}
 * @return {Object} Result of operation {success: boolean, message: string, cardId?: string}
 */
function addFlashcard(deckName, cardData) {
  try {
    // CRITICAL FIX: Use session username for direct admin check
    const session = getUserSession();
    if (!session || !session.userName) {
      return { success: false, message: 'Permission denied: You must be logged in to add flashcards.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName);
    if (!isAdmin) {
      return { success: false, message: 'Permission denied: Only administrators can add flashcards.' };
    }

    if (!cardData || !cardData.sideA || cardData.sideA.trim() === '' || !cardData.sideB || cardData.sideB.trim() === '') {
      return { success: false, message: 'Card Side A and Side B are required.' };
    }

    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(deckName);
    if (!sheet) {
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const cardId = `card_${Utilities.getUuid().substring(0, 8)}`;
    const currentUser = getCurrentUserInfo(); // Assumes getCurrentUserInfo is available
    const newCardRow = [
      cardId,
      cardData.sideA.trim(),
      cardData.sideB.trim(),
      (cardData.sideC || '').trim(),
      (cardData.tags || '').trim().split(',').map(tag => tag.trim()).filter(tag => tag).join(','), // Normalize tags
      new Date(),
      currentUser ? currentUser.userName : 'admin_fallback'
    ];

    sheet.appendRow(newCardRow);
    Logger.log(`Admin "${currentUser ? currentUser.userName : 'Unknown'}" added card "${cardId}" to deck: ${deckName}`);
    return {
      success: true,
      message: 'Flashcard added successfully.',
      cardId: cardId
    };
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
    // CRITICAL FIX: Use session username for direct admin check
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
    const headers = data[0];
    
    // Filter out password from being sent to client
    const passwordHeaderIndex = headers.indexOf('Password');

    const users = data.slice(1).map(row => {
      const user = {};
      headers.forEach((header, index) => {
        if (passwordHeaderIndex !== -1 && index === passwordHeaderIndex) {
          // Do not include password
        } else {
          user[header] = row[index];
        }
      });
      return user;
    });

    return {
      success: true,
      users: users
    };
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
    // CRITICAL FIX: Use session username for direct admin check
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
    const headers = data[0];
    const idIndex = headers.indexOf('FlashcardID');
    if (idIndex === -1) {
      return { success: false, message: 'FlashcardID column not found in the deck.' };
    }

    let rowIndexToDelete = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        rowIndexToDelete = i + 1; // Sheet rows are 1-indexed
        break;
      }
    }

    if (rowIndexToDelete === -1) {
      return { success: false, message: `Card ID "${cardId}" not found in deck "${deckName}".` };
    }

    sheet.deleteRow(rowIndexToDelete);
    const currentUser = getCurrentUserInfo();
    Logger.log(`Admin "${currentUser ? currentUser.userName : 'Unknown'}" deleted card "${cardId}" from deck: ${deckName}`);
    return {
      success: true,
      message: 'Flashcard deleted successfully.'
    };
  } catch (error)
  {
    Logger.log(`Error in deleteFlashcard (Deck: ${deckName}, CardID: ${cardId}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error deleting flashcard: ${error.message}` };
  }
}

/**
 * Updates an existing flashcard in a deck.
 * Only accessible by admin users.
 *
 * @param {string} deckName - Name of the deck
 * @param {string} cardId - ID of the flashcard to update
 * @param {Object} cardData - Updated card data {sideA, sideB, sideC, tags}
 * @return {Object} Result of operation {success: boolean, message: string}
 */
function updateFlashcard(deckName, cardId, cardData) {
  try {
    // CRITICAL FIX: Use session username for direct admin check
    const session = getUserSession();
    if (!session || !session.userName) {
      return { success: false, message: 'Permission denied: You must be logged in to update flashcards.' };
    }
    
    const isAdmin = forceAdminCheck(session.userName);
    if (!isAdmin) {
      return { success: false, message: 'Permission denied: Only administrators can update flashcards.' };
    }
    
    if (!cardData || !cardData.sideA || cardData.sideA.trim() === '' || !cardData.sideB || cardData.sideB.trim() === '') {
      return { success: false, message: 'Card Side A and Side B are required for update.' };
    }

    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(deckName);
    if (!sheet) {
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('FlashcardID');
    const sideAIndex = headers.indexOf('FlashcardSideA');
    const sideBIndex = headers.indexOf('FlashcardSideB');
    const sideCIndex = headers.indexOf('FlashcardSideC'); // Optional
    const tagsIndex = headers.indexOf('Tags'); // Optional

    if (idIndex === -1 || sideAIndex === -1 || sideBIndex === -1) {
      return { success: false, message: 'Required columns (FlashcardID, FlashcardSideA, FlashcardSideB) not found in the deck.' };
    }

    let rowIndexToUpdate = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        rowIndexToUpdate = i + 1; // Sheet rows are 1-indexed
        break;
      }
    }

    if (rowIndexToUpdate === -1) {
      return { success: false, message: `Card ID "${cardId}" not found in deck "${deckName}" for update.` };
    }

    sheet.getRange(rowIndexToUpdate, sideAIndex + 1).setValue(cardData.sideA.trim());
    sheet.getRange(rowIndexToUpdate, sideBIndex + 1).setValue(cardData.sideB.trim());
    if (sideCIndex !== -1) {
      sheet.getRange(rowIndexToUpdate, sideCIndex + 1).setValue((cardData.sideC || '').trim());
    }
    if (tagsIndex !== -1) {
      const normalizedTags = (cardData.tags || '').trim().split(',').map(tag => tag.trim()).filter(tag => tag).join(',');
      sheet.getRange(rowIndexToUpdate, tagsIndex + 1).setValue(normalizedTags);
    }

    const currentUser = getCurrentUserInfo();
    Logger.log(`Admin "${currentUser ? currentUser.userName : 'Unknown'}" updated card "${cardId}" in deck: ${deckName}`);
    return {
      success: true,
      message: 'Flashcard updated successfully.'
    };
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
    // CRITICAL FIX: Use session username for direct admin check
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

    const systemSheets = ['Config', 'Classes']; // Sheets protected from deletion
    if (systemSheets.includes(deckName)) {
      return { success: false, message: `Cannot delete system sheet "${deckName}".` };
    }

    ss.deleteSheet(sheet);
    const currentUser = getCurrentUserInfo();
    Logger.log(`Admin "${currentUser ? currentUser.userName : 'Unknown'}" deleted deck: ${deckName}`);
    return {
      success: true,
      message: `Deck "${deckName}" deleted successfully.`
    };
  } catch (error) {
    Logger.log(`Error in deleteDeck (Deck: ${deckName}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error deleting deck: ${error.message}` };
  }
}